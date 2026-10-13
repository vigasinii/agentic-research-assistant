import time
import httpx
from config import settings


HF_API_URL = "https://api-inference.huggingface.co/models/sentence-transformers/all-MiniLM-L6-v2"


def _call_hf(texts: list[str], retries: int = 4) -> list[list[float]]:
    headers = {}
    if settings.HF_API_TOKEN:
        headers["Authorization"] = f"Bearer {settings.HF_API_TOKEN}"
    payload = {"inputs": texts, "options": {"wait_for_model": True}}
    last_exc: Exception = RuntimeError("No attempts made")
    for attempt in range(retries):
        try:
            with httpx.Client(timeout=60.0) as client:
                resp = client.post(HF_API_URL, json=payload, headers=headers)
                resp.raise_for_status()
            return resp.json()
        except Exception as exc:
            last_exc = exc
            if attempt < retries - 1:
                time.sleep(2 ** attempt)  # 1s, 2s, 4s
    raise last_exc


class EmbeddingService:
    def embed(self, text: str) -> list[float]:
        result = _call_hf([text])
        return result[0]

    def embed_batch(self, texts: list[str]) -> list[list[float]]:
        # HF free tier has a payload size limit; batch in chunks of 32
        all_vecs: list[list[float]] = []
        for i in range(0, len(texts), 32):
            batch = texts[i:i + 32]
            all_vecs.extend(_call_hf(batch))
        return all_vecs


embedding_service = EmbeddingService()
