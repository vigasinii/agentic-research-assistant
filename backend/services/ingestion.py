import hashlib
import uuid
from datetime import datetime, timezone
from typing import Optional

from config import settings
from models import UploadResponse
from .embeddings import EmbeddingService, embedding_service
from .qdrant_service import QdrantService, qdrant_service


def _ts() -> str:
    return datetime.now(timezone.utc).isoformat()


class IngestionService:
    def __init__(self, qdrant: QdrantService, embedder: EmbeddingService) -> None:
        self._qdrant = qdrant
        self._embedder = embedder

    def ingest_file(self, filename: str, content: bytes, file_type: str) -> UploadResponse:
        file_type = file_type.lower().lstrip(".")
        if file_type not in ("pdf", "txt", "md"):
            raise ValueError(f"Unsupported file type: {file_type}. Must be pdf, txt, or md.")

        max_bytes = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
        if len(content) > max_bytes:
            raise ValueError(
                f"File size {len(content)} bytes exceeds limit of {settings.MAX_UPLOAD_SIZE_MB} MB."
            )

        document_id = hashlib.sha256(content).hexdigest()[:16]
        print(f"[{_ts()}] [ingestion] Processing '{filename}' (doc_id={document_id})")

        self._qdrant.ensure_collection()

        if self._qdrant.document_exists(document_id):
            chunks = self._qdrant.get_chunks_by_document(document_id)
            print(f"[{_ts()}] [ingestion] Document already exists with {len(chunks)} chunks")
            return UploadResponse(
                document_id=document_id,
                filename=filename,
                chunk_count=len(chunks),
                message="Document already exists; skipping re-ingestion.",
            )

        if file_type == "pdf":
            pages = self._extract_pdf(content)
            raw_chunks: list[dict] = []
            for page_data in pages:
                raw_chunks.extend(
                    self._chunk_text(page_data["text"], page_number=page_data["page_number"])
                )
        else:
            text = self._extract_text(content)
            raw_chunks = self._chunk_text(text, page_number=None)

        if not raw_chunks:
            raise ValueError("No text could be extracted from the document.")

        # Assign chunk IDs — Qdrant requires UUID or unsigned int
        for i, chunk in enumerate(raw_chunks):
            chunk["chunk_index"] = i
            chunk["chunk_id"] = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"{document_id}_{i}"))

        texts = [c["text"] for c in raw_chunks]
        vectors = self._embedder.embed_batch(texts)

        uploaded_at = datetime.now(timezone.utc).isoformat()
        points = []
        for chunk, vector in zip(raw_chunks, vectors):
            points.append(
                {
                    "chunk_id": chunk["chunk_id"],
                    "document_id": document_id,
                    "source_filename": filename,
                    "page_number": chunk.get("page_number"),
                    "chunk_index": chunk["chunk_index"],
                    "text": chunk["text"],
                    "vector": vector,
                    "uploaded_at": uploaded_at,
                    "file_type": file_type,
                    "size_bytes": len(content),
                }
            )

        self._qdrant.upsert_chunks(points)
        print(f"[{_ts()}] [ingestion] Ingested {len(points)} chunks for '{filename}'")

        return UploadResponse(
            document_id=document_id,
            filename=filename,
            chunk_count=len(points),
            message=f"Successfully ingested {len(points)} chunks.",
        )

    def _extract_pdf(self, content: bytes) -> list[dict]:
        try:
            import fitz  # PyMuPDF
        except ImportError:
            raise ImportError("PyMuPDF (fitz) is required for PDF extraction. Install with: pip install pymupdf")

        pages = []
        doc = fitz.open(stream=content, filetype="pdf")
        for page_num in range(len(doc)):
            page = doc[page_num]
            text = page.get_text("text")
            if text.strip():
                pages.append({"text": text, "page_number": page_num + 1})
        doc.close()
        return pages

    def _extract_text(self, content: bytes) -> str:
        return content.decode("utf-8", errors="replace")

    def _chunk_text(self, text: str, page_number: Optional[int] = None) -> list[dict]:
        words = text.split()
        if not words:
            return []

        chunk_size = 512
        overlap = 64
        chunks = []
        start = 0
        chunk_index = 0

        while start < len(words):
            end = min(start + chunk_size, len(words))
            chunk_words = words[start:end]
            chunk_text = " ".join(chunk_words)
            chunks.append(
                {
                    "text": chunk_text,
                    "page_number": page_number,
                    "chunk_index": chunk_index,
                }
            )
            chunk_index += 1
            if end == len(words):
                break
            start = end - overlap

        return chunks


ingestion_service = IngestionService(qdrant=qdrant_service, embedder=embedding_service)
