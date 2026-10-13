import logging
from datetime import datetime, timezone
from typing import Optional

from qdrant_client import QdrantClient
from qdrant_client.http import models as qdrant_models
from qdrant_client.http.models import (
    Distance,
    FieldCondition,
    Filter,
    MatchValue,
    PointStruct,
    VectorParams,
)

from config import settings
from models import ChunkMeta, DocumentMeta

logger = logging.getLogger(__name__)


def _ts() -> str:
    return datetime.now(timezone.utc).isoformat()


class QdrantService:
    VECTOR_DIM = 384

    def __init__(self) -> None:
        kwargs: dict = {"url": settings.QDRANT_URL}
        if settings.QDRANT_API_KEY:
            kwargs["api_key"] = settings.QDRANT_API_KEY
        self._client = QdrantClient(**kwargs)
        print(f"[{_ts()}] [qdrant_service] Connected to Qdrant at {settings.QDRANT_URL}")

    def ensure_collection(self) -> None:
        existing = [c.name for c in self._client.get_collections().collections]
        if settings.QDRANT_COLLECTION not in existing:
            self._client.create_collection(
                collection_name=settings.QDRANT_COLLECTION,
                vectors_config=VectorParams(
                    size=self.VECTOR_DIM,
                    distance=Distance.COSINE,
                ),
            )
            print(f"[{_ts()}] [qdrant_service] Created collection '{settings.QDRANT_COLLECTION}'")
        else:
            print(f"[{_ts()}] [qdrant_service] Collection '{settings.QDRANT_COLLECTION}' already exists")

    def upsert_chunks(self, chunks: list[dict]) -> None:
        points = [
            PointStruct(
                id=c["chunk_id"],
                vector=c["vector"],
                payload={
                    "chunk_id": c["chunk_id"],
                    "document_id": c["document_id"],
                    "source_filename": c["source_filename"],
                    "page_number": c.get("page_number"),
                    "chunk_index": c["chunk_index"],
                    "text": c["text"],
                    "uploaded_at": c.get("uploaded_at", datetime.now(timezone.utc).isoformat()),
                    "file_type": c.get("file_type", ""),
                    "size_bytes": c.get("size_bytes", 0),
                },
            )
            for c in chunks
        ]
        self._client.upsert(collection_name=settings.QDRANT_COLLECTION, points=points)
        print(f"[{_ts()}] [qdrant_service] Upserted {len(points)} chunks")

    def search(
        self,
        query_vector: list[float],
        top_k: int,
        filter_doc_id: Optional[str] = None,
    ) -> list[ChunkMeta]:
        query_filter = None
        if filter_doc_id:
            query_filter = Filter(
                must=[FieldCondition(key="document_id", match=MatchValue(value=filter_doc_id))]
            )
        results = self._client.query_points(
            collection_name=settings.QDRANT_COLLECTION,
            query=query_vector,
            limit=top_k,
            query_filter=query_filter,
            with_payload=True,
        ).points
        print(f"[{_ts()}] [qdrant_service] search returned {len(results)} raw results")
        chunks = []
        for r in results:
            p = r.payload or {}
            chunks.append(
                ChunkMeta(
                    chunk_id=p.get("chunk_id", str(r.id)),
                    document_id=p.get("document_id", ""),
                    source_filename=p.get("source_filename", ""),
                    page_number=p.get("page_number"),
                    chunk_index=p.get("chunk_index", 0),
                    text=p.get("text", ""),
                    score=r.score,
                )
            )
        return chunks

    def get_chunk_by_id(self, chunk_id: str) -> Optional[ChunkMeta]:
        try:
            results = self._client.retrieve(
                collection_name=settings.QDRANT_COLLECTION,
                ids=[chunk_id],
                with_payload=True,
            )
            if not results:
                return None
            p = results[0].payload or {}
            return ChunkMeta(
                chunk_id=p.get("chunk_id", chunk_id),
                document_id=p.get("document_id", ""),
                source_filename=p.get("source_filename", ""),
                page_number=p.get("page_number"),
                chunk_index=p.get("chunk_index", 0),
                text=p.get("text", ""),
            )
        except Exception as e:
            print(f"[{_ts()}] [qdrant_service] Error retrieving chunk {chunk_id}: {e}")
            return None

    def get_chunks_by_document(self, document_id: str) -> list[ChunkMeta]:
        chunks: list[ChunkMeta] = []
        offset = None
        while True:
            records, offset = self._client.scroll(
                collection_name=settings.QDRANT_COLLECTION,
                scroll_filter=Filter(
                    must=[FieldCondition(key="document_id", match=MatchValue(value=document_id))]
                ),
                limit=100,
                offset=offset,
                with_payload=True,
            )
            for r in records:
                p = r.payload or {}
                chunks.append(
                    ChunkMeta(
                        chunk_id=p.get("chunk_id", str(r.id)),
                        document_id=p.get("document_id", document_id),
                        source_filename=p.get("source_filename", ""),
                        page_number=p.get("page_number"),
                        chunk_index=p.get("chunk_index", 0),
                        text=p.get("text", ""),
                    )
                )
            if offset is None:
                break
        return chunks

    def delete_document(self, document_id: str) -> int:
        chunks = self.get_chunks_by_document(document_id)
        if not chunks:
            return 0
        ids = [c.chunk_id for c in chunks]
        self._client.delete(
            collection_name=settings.QDRANT_COLLECTION,
            points_selector=qdrant_models.PointIdsList(points=ids),
        )
        print(f"[{_ts()}] [qdrant_service] Deleted {len(ids)} chunks for document {document_id}")
        return len(ids)

    def list_documents(self) -> list[DocumentMeta]:
        docs: dict[str, dict] = {}
        offset = None
        while True:
            records, offset = self._client.scroll(
                collection_name=settings.QDRANT_COLLECTION,
                limit=100,
                offset=offset,
                with_payload=True,
            )
            for r in records:
                p = r.payload or {}
                doc_id = p.get("document_id", "")
                if doc_id not in docs:
                    docs[doc_id] = {
                        "id": doc_id,
                        "filename": p.get("source_filename", ""),
                        "file_type": p.get("file_type", ""),
                        "size_bytes": p.get("size_bytes", 0),
                        "chunk_count": 0,
                        "uploaded_at": p.get("uploaded_at", datetime.now(timezone.utc).isoformat()),
                        "collection": settings.QDRANT_COLLECTION,
                    }
                docs[doc_id]["chunk_count"] += 1
            if offset is None:
                break

        result = []
        for d in docs.values():
            try:
                result.append(
                    DocumentMeta(
                        id=d["id"],
                        filename=d["filename"],
                        file_type=d["file_type"],
                        size_bytes=d["size_bytes"],
                        chunk_count=d["chunk_count"],
                        uploaded_at=datetime.fromisoformat(d["uploaded_at"]),
                        collection=d["collection"],
                    )
                )
            except Exception as e:
                print(f"[{_ts()}] [qdrant_service] Error building DocumentMeta: {e}")
        return result

    def document_exists(self, document_id: str) -> bool:
        records, _ = self._client.scroll(
            collection_name=settings.QDRANT_COLLECTION,
            scroll_filter=Filter(
                must=[FieldCondition(key="document_id", match=MatchValue(value=document_id))]
            ),
            limit=1,
            with_payload=False,
        )
        return len(records) > 0


qdrant_service = QdrantService()
