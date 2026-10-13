import httpx
from datetime import datetime, timezone
from config import settings


def _ts() -> str:
    return datetime.now(timezone.utc).isoformat()


HF_API_URL = "https://api-inference.huggingface.co/models/sentence-transformers/all-MiniLM-L6-v2"


def _call_hf(texts: list[str]) -> list[list[float]]:
    headers = {}
    if settings.HF_API_TOKEN:
        headers["Authorization"] = f"Bearer {settings.HF_API_TOKEN}"
    payload = {"inputs": texts, "options": {"wait_for_model": True}}
    with httpx.Client(timeout=60.0) as client:
        resp = client.post(HF_API_URL, json=payload, headers=headers)
        resp.raise_for_status()
    return resp.json()


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
