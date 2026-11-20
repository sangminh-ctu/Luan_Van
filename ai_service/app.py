import os
import time
from typing import Dict, List

import psutil
from fastapi import FastAPI, File, HTTPException, UploadFile

from clip_encoder import get_clip_encoder

app = FastAPI(title="MiSa Book Visual AI Service", version="1.0.0")


def current_memory_mb() -> Dict[str, float]:
    proc = psutil.Process(os.getpid())
    mem = proc.memory_info()
    return {
        "rss_mb": round(mem.rss / (1024 * 1024), 2),
        "vms_mb": round(mem.vms / (1024 * 1024), 2),
    }


@app.get("/health")
def health() -> Dict[str, object]:
    encoder = get_clip_encoder()
    return {
        "status": "ok",
        "encoder": encoder.info(),
        "memory": current_memory_mb(),
    }


@app.post("/embed-image")
async def embed_image(file: UploadFile = File(...)) -> Dict[str, object]:
    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="File ảnh rỗng.")
    if len(raw) > 8 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Kích thước ảnh tối đa 8MB.")
    try:
        encoder = get_clip_encoder()
        image_hash = encoder.sha256_bytes(raw)
        vec, elapsed_ms = encoder.encode_bytes(raw)
        return {
            "image_hash": image_hash,
            "model_version": encoder.model_version,
            "dimension": encoder.dimension,
            "elapsed_ms": elapsed_ms,
            "embedding": [round(float(x), 6) for x in vec.tolist()],
            "memory": current_memory_mb(),
        }
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Không thể xử lý file ảnh: {exc}") from exc


@app.post("/embed-batch")
async def embed_batch(files: List[UploadFile] = File(...)) -> Dict[str, object]:
    if not files:
        raise HTTPException(status_code=400, detail="Danh sách ảnh rỗng.")
    encoder = get_clip_encoder()
    raw_items: List[bytes] = []
    hashes: List[str] = []
    names: List[str] = []
    for f in files:
        raw = await f.read()
        if not raw:
            raise HTTPException(status_code=400, detail=f"File {f.filename} rỗng.")
        raw_items.append(raw)
        hashes.append(encoder.sha256_bytes(raw))
        names.append(f.filename or "")

    try:
        vecs, elapsed_ms = encoder.encode_batch_bytes(raw_items)
        items = [
            {
                "filename": names[i],
                "image_hash": hashes[i],
                "embedding": [round(float(x), 6) for x in vecs[i].tolist()],
            }
            for i in range(len(vecs))
        ]
        return {
            "model_version": encoder.model_version,
            "dimension": encoder.dimension,
            "count": len(items),
            "elapsed_ms": elapsed_ms,
            "items": items,
            "memory": current_memory_mb(),
        }
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Không thể xử lý batch ảnh: {exc}") from exc
