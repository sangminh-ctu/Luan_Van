import glob
import json
import os
import platform
import time
from pathlib import Path
from typing import Dict, List

import numpy as np
import psutil

from clip_encoder import ClipImageEncoder


def rss_mb() -> float:
    return round(psutil.Process(os.getpid()).memory_info().rss / (1024 * 1024), 2)


def run_benchmark() -> Dict[str, object]:
    root = Path(__file__).resolve().parent.parent
    books_dir = root / "backend" / "uploads" / "books"
    image_paths = sorted(
        [
            p
            for ext in ("*.jpg", "*.jpeg", "*.png", "*.webp")
            for p in glob.glob(str(books_dir / ext))
        ]
    )
    if not image_paths:
        raise RuntimeError(f"Không tìm thấy ảnh bìa nào trong {books_dir}")

    raw_images: List[bytes] = [Path(p).read_bytes() for p in image_paths]

    mem_before_load = rss_mb()
    t_load0 = time.perf_counter()
    encoder = ClipImageEncoder()
    load_ms = round((time.perf_counter() - t_load0) * 1000.0, 2)
    mem_after_load = rss_mb()

    # Warm-up 2 lượt để ổn định bộ nhớ cache CPU
    for i in range(min(2, len(raw_images))):
        encoder.encode_bytes(raw_images[i])
    mem_after_warmup = rss_mb()

    # Đo 20 lượt suy luận đơn lẻ trên các ảnh bìa thực tế
    latencies: List[float] = []
    vectors: List[np.ndarray] = []
    rounds = 20
    for r in range(rounds):
        raw = raw_images[r % len(raw_images)]
        vec, elapsed_ms = encoder.encode_bytes(raw)
        latencies.append(elapsed_ms)
        if r < len(raw_images):
            vectors.append(vec)

    peak_mem = rss_mb()

    # Đo thời gian nhân ma trận Cosine Similarity với kho giả lập N = 100, 1.000, 10.000 vector 512 chiều
    matrix_timings: Dict[str, float] = {}
    q = vectors[0]
    for size in (len(vectors), 100, 1000, 10000):
        rng = np.random.default_rng(42)
        mat = rng.standard_normal((size, encoder.dimension), dtype=np.float32)
        mat /= np.linalg.norm(mat, axis=1, keepdims=True)
        t_m0 = time.perf_counter()
        for _ in range(50):
            _ = mat @ q
        avg_mat_ms = round(((time.perf_counter() - t_m0) / 50.0) * 1000.0, 4)
        matrix_timings[f"cosine_{size}_vectors_ms"] = avg_mat_ms

    # Kiểm tra độ phân biệt (Self-similarity vs Cross-similarity) trên các ảnh bìa thật
    mat_real = np.stack(vectors, axis=0)
    sim_matrix = mat_real @ mat_real.T
    off_diag = sim_matrix[~np.eye(len(vectors), dtype=bool)]

    report = {
        "hardware": {
            "platform": platform.platform(),
            "processor": platform.processor(),
            "python_version": platform.python_version(),
            "cpu_count_logical": os.cpu_count(),
            "total_system_ram_gb": round(psutil.virtual_memory().total / (1024**3), 2),
        },
        "encoder": encoder.info(),
        "memory_mb": {
            "before_model_load_rss_mb": mem_before_load,
            "after_model_load_rss_mb": mem_after_load,
            "after_warmup_rss_mb": mem_after_warmup,
            "peak_inference_rss_mb": peak_mem,
            "model_delta_rss_mb": round(mem_after_warmup - mem_before_load, 2),
        },
        "latency_single_image_ms": {
            "samples": rounds,
            "real_images_count": len(raw_images),
            "model_load_time_ms": load_ms,
            "mean_ms": round(float(np.mean(latencies)), 2),
            "median_p50_ms": round(float(np.percentile(latencies, 50)), 2),
            "p95_ms": round(float(np.percentile(latencies, 95)), 2),
            "min_ms": round(float(np.min(latencies)), 2),
            "max_ms": round(float(np.max(latencies)), 2),
        },
        "cosine_search_in_memory_ms": matrix_timings,
        "discrimination_on_real_covers": {
            "self_similarity_mean": round(float(np.diag(sim_matrix).mean()), 4),
            "different_books_similarity_mean": round(float(off_diag.mean()), 4),
            "different_books_similarity_max": round(float(off_diag.max()), 4),
        },
    }

    reports_dir = Path(__file__).resolve().parent / "reports"
    reports_dir.mkdir(parents=True, exist_ok=True)
    out_file = reports_dir / "stage2_clip_benchmark.json"
    out_file.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    print(json.dumps(report, indent=2, ensure_ascii=False))
    return report


if __name__ == "__main__":
    run_benchmark()
