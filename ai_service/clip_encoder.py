import hashlib
import io
import os
import time
from typing import Any, Callable, Dict, List, Optional, Tuple

import numpy as np
from PIL import Image, ImageOps


class ClipImageEncoder:
    """
    Bộ trích xuất vector đặc trưng ảnh bìa sách chuẩn hóa L2 (||v||_2 = 1).
    Ưu tiên nạp CLIP ViT-B/32 (open_clip trên CPU, chỉ giữ nhánh visual encoder để tiết kiệm RAM).
    """

    def __init__(self, model_name: str = "ViT-B-32", pretrained: str = "laion2b_s34b_b79k") -> None:
        self.model_name = model_name
        self.pretrained = pretrained
        self.backend = "uninitialized"
        self.model_version = f"clip-{model_name.lower()}-{pretrained}"
        self.dimension = 512
        self._model: Optional[Any] = None
        self._preprocess: Optional[Callable[[Image.Image], Any]] = None
        self._torch: Optional[Any] = None
        self.load_time_ms = 0.0
        self._init_encoder()

    def _init_encoder(self) -> None:
        start = time.perf_counter()
        force_light = os.environ.get("AI_FORCE_LIGHT_ENCODER", "").lower() == "true"
        if not force_light:
            try:
                import gc
                import open_clip
                import torch

                os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS_WARNING", "1")
                torch.set_num_threads(max(1, min(4, os.cpu_count() or 2)))
                model, _, preprocess = open_clip.create_model_and_transforms(
                    self.model_name,
                    pretrained=self.pretrained,
                    device="cpu",
                )
                model.eval()
                # Giải phóng nhánh Text Transformer không cần thiết cho bài toán Image-to-Image
                for attr in ("transformer", "token_embedding", "ln_final", "text_projection", "positional_embedding"):
                    if hasattr(model, attr):
                        delattr(model, attr)
                gc.collect()

                self._model = model
                self._preprocess = preprocess
                self._torch = torch
                self.backend = "open_clip_cpu"
                self.dimension = 512
                self.load_time_ms = round((time.perf_counter() - start) * 1000.0, 2)
                return
            except Exception as exc:
                print(f"[clip_encoder] open_clip unavailable ({exc}); falling back to multiscale visual descriptor")

        self.backend = "multiscale_visual_v1"
        self.model_version = "visual-descriptor-512-v1"
        self.dimension = 512
        self.load_time_ms = round((time.perf_counter() - start) * 1000.0, 2)

    @staticmethod
    def sha256_bytes(data: bytes) -> str:
        return hashlib.sha256(data).hexdigest()

    @staticmethod
    def load_pil_image(data: bytes) -> Image.Image:
        img = Image.open(io.BytesIO(data))
        img = ImageOps.exif_transpose(img)
        return img.convert("RGB")

    def encode_pil(self, img: Image.Image) -> np.ndarray:
        if (
            self.backend == "open_clip_cpu"
            and self._model is not None
            and self._preprocess is not None
            and self._torch is not None
        ):
            with self._torch.no_grad():
                tensor = self._preprocess(img).unsqueeze(0)
                features = self._model.encode_image(tensor)
                vec = features[0].detach().cpu().numpy().astype(np.float32)
        else:
            vec = self._encode_multiscale_fallback(img)

        norm = float(np.linalg.norm(vec))
        if norm > 1e-12:
            vec = vec / norm
        return vec.astype(np.float32)

    def encode_bytes(self, data: bytes) -> Tuple[np.ndarray, float]:
        t0 = time.perf_counter()
        img = self.load_pil_image(data)
        vec = self.encode_pil(img)
        elapsed_ms = round((time.perf_counter() - t0) * 1000.0, 2)
        return vec, elapsed_ms

    def encode_batch_bytes(self, items: List[bytes]) -> Tuple[List[np.ndarray], float]:
        t0 = time.perf_counter()
        if not items:
            return [], 0.0
        imgs = [self.load_pil_image(raw) for raw in items]
        if (
            self.backend == "open_clip_cpu"
            and self._model is not None
            and self._preprocess is not None
            and self._torch is not None
        ):
            with self._torch.no_grad():
                batch = self._torch.stack([self._preprocess(img) for img in imgs], dim=0)
                features = self._model.encode_image(batch).detach().cpu().numpy().astype(np.float32)
                norms = np.linalg.norm(features, axis=1, keepdims=True)
                norms = np.where(norms > 1e-12, norms, 1.0)
                features = features / norms
                vecs = [features[i].astype(np.float32) for i in range(len(items))]
        else:
            vecs = [self.encode_pil(img) for img in imgs]
        elapsed_ms = round((time.perf_counter() - t0) * 1000.0, 2)
        return vecs, elapsed_ms

    @staticmethod
    def _encode_multiscale_fallback(img: Image.Image) -> np.ndarray:
        """
        Bộ mô tả đặc trưng thị giác 512 chiều chuẩn hóa L2 (dự phòng khi không có PyTorch).
        Kết hợp: lưới màu không gian 8x8x3 (192) + biểu đồ hướng gradient Sobel 4x4x8 (128)
        + tần số DCT 8x8x3 (192) = 512 chiều.
        """
        resized = img.resize((128, 128), Image.Resampling.BILINEAR)
        arr = np.asarray(resized, dtype=np.float32) / 255.0

        # 1. Spatial color grid 8x8x3 = 192
        grid = arr.reshape(8, 16, 8, 16, 3).mean(axis=(1, 3)).reshape(-1)

        # 2. Gradient orientation histogram 4x4 cells x 8 bins = 128
        gray = 0.299 * arr[:, :, 0] + 0.587 * arr[:, :, 1] + 0.114 * arr[:, :, 2]
        gx = np.zeros_like(gray)
        gy = np.zeros_like(gray)
        gx[:, 1:-1] = gray[:, 2:] - gray[:, :-2]
        gy[1:-1, :] = gray[2:, :] - gray[:-2, :]
        mag = np.hypot(gx, gy)
        ang = (np.arctan2(gy, gx) + np.pi) / (2.0 * np.pi)
        bins = np.clip((ang * 8).astype(np.int32), 0, 7)
        hog = np.zeros((4, 4, 8), dtype=np.float32)
        for cy in range(4):
            for cx in range(4):
                cell_mag = mag[cy * 32:(cy + 1) * 32, cx * 32:(cx + 1) * 32]
                cell_bin = bins[cy * 32:(cy + 1) * 32, cx * 32:(cx + 1) * 32]
                for b in range(8):
                    hog[cy, cx, b] = float(cell_mag[cell_bin == b].sum())
        hog_flat = hog.reshape(-1)
        if np.linalg.norm(hog_flat) > 1e-9:
            hog_flat = hog_flat / np.linalg.norm(hog_flat)

        # 3. Low-frequency spatial contrast 8x8x3 = 192
        small = np.asarray(img.resize((8, 8), Image.Resampling.BICUBIC), dtype=np.float32) / 255.0
        centered = (small - small.mean(axis=(0, 1), keepdims=True)).reshape(-1)

        vec = np.concatenate([grid, hog_flat, centered]).astype(np.float32)
        return vec[:512]

    def info(self) -> Dict[str, object]:
        return {
            "backend": self.backend,
            "model_name": self.model_name,
            "pretrained": self.pretrained,
            "model_version": self.model_version,
            "dimension": self.dimension,
            "load_time_ms": self.load_time_ms,
        }


_ENCODER_INSTANCE: Optional[ClipImageEncoder] = None


def get_clip_encoder() -> ClipImageEncoder:
    global _ENCODER_INSTANCE
    if _ENCODER_INSTANCE is None:
        _ENCODER_INSTANCE = ClipImageEncoder()
    return _ENCODER_INSTANCE
