from fastembed import TextEmbedding

_model: TextEmbedding | None = None


def _get_model() -> TextEmbedding:
    global _model
    if _model is None:
        _model = TextEmbedding("sentence-transformers/all-MiniLM-L6-v2")
    return _model


class EmbeddingService:
    def embed(self, text: str) -> list[float]:
        return next(iter(_get_model().embed([text]))).tolist()

    def embed_batch(self, texts: list[str]) -> list[list[float]]:
        return [v.tolist() for v in _get_model().embed(texts)]


embedding_service = EmbeddingService()
