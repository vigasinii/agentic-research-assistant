from datetime import datetime, timezone
from typing import Optional


def _ts() -> str:
    return datetime.now(timezone.utc).isoformat()


class EmbeddingService:
    def __init__(self) -> None:
        self._model = None

    def _load_model(self):
        if self._model is None:
            print(f"[{_ts()}] [embeddings] Loading SentenceTransformer model...")
            from sentence_transformers import SentenceTransformer
            self._model = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")
            print(f"[{_ts()}] [embeddings] Model loaded")
        return self._model

    def embed(self, text: str) -> list[float]:
        model = self._load_model()
        vector = model.encode(text, convert_to_numpy=True)
        return vector.tolist()

    def embed_batch(self, texts: list[str]) -> list[list[float]]:
        model = self._load_model()
        vectors = model.encode(texts, convert_to_numpy=True, batch_size=64, show_progress_bar=False)
        return [v.tolist() for v in vectors]


embedding_service = EmbeddingService()
