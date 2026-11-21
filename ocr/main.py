import logging
import os

import cv2
import numpy as np
from fastapi import FastAPI, HTTPException, Request
from paddleocr import PaddleOCR

MAX_IMAGE_BYTES = 10 * 1024 * 1024
MAX_IMAGE_PIXELS = 50_000_000
MAX_IMAGE_SIDE = 4096
logger = logging.getLogger("paddle-ocr")

ocr_engine = PaddleOCR(
    use_angle_cls=True,
    lang=os.getenv("PADDLE_OCR_LANG", "en"),
    show_log=False,
)
app = FastAPI()


@app.get("/health")
def health():
    return {"status": "UP"}


@app.post("/ocr")
async def extract_text(request: Request):
    content_type = request.headers.get("content-type", "")
    if content_type not in {"image/png", "image/jpeg"}:
        raise HTTPException(status_code=415, detail="Only PNG and JPEG images are supported.")

    content_length = request.headers.get("content-length")
    if content_length:
        try:
            declared_size = int(content_length)
        except ValueError as error:
            raise HTTPException(status_code=400, detail="Invalid image content length.") from error
        if declared_size > MAX_IMAGE_BYTES:
            logger.warning("Rejected OCR request: declared bytes=%d", declared_size)
            raise HTTPException(status_code=413, detail="Image must be 10 MB or smaller.")

    image_bytes = await request.body()
    if not image_bytes or len(image_bytes) > MAX_IMAGE_BYTES:
        logger.warning("Rejected OCR request: received bytes=%d", len(image_bytes))
        raise HTTPException(status_code=413, detail="Image must be between 1 byte and 10 MB.")

    image = cv2.imdecode(np.frombuffer(image_bytes, dtype=np.uint8), cv2.IMREAD_COLOR)
    if image is None:
        raise HTTPException(status_code=400, detail="The uploaded image could not be decoded.")
    height, width = image.shape[:2]
    pixels = height * width
    if pixels > MAX_IMAGE_PIXELS:
        logger.warning("Rejected OCR image dimensions: width=%d height=%d pixels=%d", width, height, pixels)
        raise HTTPException(status_code=413, detail="Image dimensions are too large for OCR.")
    if max(height, width) > MAX_IMAGE_SIDE:
        scale = MAX_IMAGE_SIDE / max(height, width)
        image = cv2.resize(
            image,
            (int(width * scale), int(height * scale)),
            interpolation=cv2.INTER_AREA,
        )

    try:
        result = ocr_engine.ocr(image, cls=True)
    except Exception as error:
        logger.exception("PaddleOCR failed to process an image")
        raise HTTPException(status_code=500, detail="Image OCR failed.") from error

    lines = []
    for page in result or []:
        for item in page or []:
            if item and len(item) > 1 and item[1] and item[1][0]:
                lines.append(item[1][0].strip())
    return {"text": "\n".join(line for line in lines if line)}
