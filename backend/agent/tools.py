from datetime import datetime, timezone

from ..models import ChunkMeta
from ..services.embeddings import embedding_service
from ..services.llm import llm_service
from ..services.qdrant_service import qdrant_service
from ..config import settings


def _ts() -> str:
    return datetime.now(timezone.utc).isoformat()


def search_documents(query: str, top_k: int = 5) -> list[ChunkMeta]:
    """Search Qdrant for chunks semantically similar to query. Returns top_k chunks with
    text, document_id, source_filename, page_number, chunk_id, score."""
    print(f"[{_ts()}] [TOOL:search_documents] query='{query[:80]}' top_k={top_k}")
    try:
        vector = embedding_service.embed(query)
        results = qdrant_service.search(query_vector=vector, top_k=top_k)
        print(f"[{_ts()}] [TOOL:search_documents] Returned {len(results)} chunks")
        return results
    except Exception as e:
        print(f"[{_ts()}] [TOOL:search_documents] Error: {e}")
        return []


def get_document_context(chunk_id: str) -> list[ChunkMeta]:
    """Retrieve the chunk plus its immediate neighbors (chunk_index ± 1) from the same document
    for additional context."""
    print(f"[{_ts()}] [TOOL:get_document_context] chunk_id='{chunk_id}'")
    try:
        target = qdrant_service.get_chunk_by_id(chunk_id)
        if target is None:
            print(f"[{_ts()}] [TOOL:get_document_context] Chunk not found: {chunk_id}")
            return []

        all_chunks = qdrant_service.get_chunks_by_document(target.document_id)
        by_index = {c.chunk_index: c for c in all_chunks}

        neighbors = []
        for idx in (target.chunk_index - 1, target.chunk_index, target.chunk_index + 1):
            if idx in by_index:
                neighbors.append(by_index[idx])

        print(f"[{_ts()}] [TOOL:get_document_context] Returned {len(neighbors)} neighbor chunks")
        return neighbors
    except Exception as e:
        print(f"[{_ts()}] [TOOL:get_document_context] Error: {e}")
        return []


def grade_evidence(question: str, chunks: list[ChunkMeta]) -> dict:
    """Assess whether retrieved evidence is sufficient to answer the question.
    Returns: {sufficient: bool, relevant_chunk_ids: list[str], reason: str, confidence: float}"""
    print(f"[{_ts()}] [TOOL:grade_evidence] question='{question[:80]}' chunks={len(chunks)}")
    if not chunks:
        return {
            "sufficient": False,
            "relevant_chunk_ids": [],
            "reason": "No chunks retrieved.",
            "confidence": 0.0,
        }

    evidence_text = "\n\n".join(
        f"[chunk_id: {c.chunk_id}]\n{c.text[:400]}" for c in chunks
    )
    messages = [
        {
            "role": "system",
            "content": (
                "You are an evidence grader. Respond only with valid JSON. "
                "Do not include any explanation outside the JSON object."
            ),
        },
        {
            "role": "user",
            "content": (
                f"Question: {question}\n\n"
                f"Evidence chunks:\n{evidence_text}\n\n"
                "Assess whether the above evidence is sufficient to answer the question. "
                "Return a JSON object with these exact fields:\n"
                '{"sufficient": true or false, "relevant_chunk_ids": ["chunk_id1", ...], '
                '"reason": "brief explanation", "confidence": 0.0 to 1.0}'
            ),
        },
    ]
    try:
        result = llm_service.chat_json(messages=messages, temperature=0.0, max_tokens=512)
        result.setdefault("sufficient", False)
        result.setdefault("relevant_chunk_ids", [])
        result.setdefault("reason", "")
        result.setdefault("confidence", 0.0)
        print(
            f"[{_ts()}] [TOOL:grade_evidence] sufficient={result['sufficient']} "
            f"relevant={len(result['relevant_chunk_ids'])} confidence={result['confidence']}"
        )
        return result
    except Exception as e:
        print(f"[{_ts()}] [TOOL:grade_evidence] Error: {e}")
        return {
            "sufficient": False,
            "relevant_chunk_ids": [],
            "reason": f"Grading failed: {e}",
            "confidence": 0.0,
        }


def rewrite_search_query(question: str, previous_results: list[ChunkMeta]) -> str:
    """Generate an improved search query when previous retrieval was insufficient.
    Returns a new query string optimized for semantic search."""
    print(
        f"[{_ts()}] [TOOL:rewrite_search_query] question='{question[:80]}' "
        f"previous_chunks={len(previous_results)}"
    )
    found_topics = ", ".join(
        {c.source_filename for c in previous_results}
    ) or "nothing relevant"

    messages = [
        {
            "role": "system",
            "content": (
                "You are a search query optimizer. Generate a single improved semantic search "
                "query string. Return only the query string, no explanation or quotes."
            ),
        },
        {
            "role": "user",
            "content": (
                f"Original question: {question}\n\n"
                f"Previous search found: {found_topics}\n\n"
                "The previous results were insufficient. Generate a new, more targeted search "
                "query that might find better evidence. Return only the query string."
            ),
        },
    ]
    try:
        new_query = llm_service.chat(messages=messages, temperature=0.3, max_tokens=128).strip()
        new_query = new_query.strip('"').strip("'")
        if not new_query:
            new_query = question
        print(f"[{_ts()}] [TOOL:rewrite_search_query] new_query='{new_query[:80]}'")
        return new_query
    except Exception as e:
        print(f"[{_ts()}] [TOOL:rewrite_search_query] Error: {e}")
        return question


def verify_answer(answer: str, citations: list[dict], evidence: list[ChunkMeta]) -> dict:
    """Verify cited chunks exist and that the answer's claims are supported by evidence.
    Returns: {valid: bool, verified_citations: list[str], unsupported_claims: list[str], confidence: float}
    IMPORTANT: citation existence alone does not prove factual correctness."""
    print(
        f"[{_ts()}] [TOOL:verify_answer] answer_len={len(answer)} "
        f"citations={len(citations)} evidence_chunks={len(evidence)}"
    )

    evidence_text = "\n\n".join(
        f"[chunk_id: {c.chunk_id}]\n{c.text[:400]}" for c in evidence
    )
    citation_ids = [c.get("chunk_id", "") for c in citations]

    messages = [
        {
            "role": "system",
            "content": (
                "You are a fact-verification assistant. Respond only with valid JSON. "
                "Do not include any explanation outside the JSON object."
            ),
        },
        {
            "role": "user",
            "content": (
                f"Answer to verify:\n{answer}\n\n"
                f"Cited chunk IDs: {citation_ids}\n\n"
                f"Available evidence:\n{evidence_text}\n\n"
                "Verify that the answer's claims are supported by the evidence. "
                "Note: citation existence alone does NOT prove factual correctness. "
                "Return a JSON object with these exact fields:\n"
                '{"valid": true or false, "verified_citations": ["chunk_id1", ...], '
                '"unsupported_claims": ["claim1", ...], "confidence": 0.0 to 1.0}'
            ),
        },
    ]
    try:
        result = llm_service.chat_json(messages=messages, temperature=0.0, max_tokens=512)
        result.setdefault("valid", False)
        result.setdefault("verified_citations", [])
        result.setdefault("unsupported_claims", [])
        result.setdefault("confidence", 0.0)
        print(
            f"[{_ts()}] [TOOL:verify_answer] valid={result['valid']} "
            f"confidence={result['confidence']}"
        )
        return result
    except Exception as e:
        print(f"[{_ts()}] [TOOL:verify_answer] Error: {e}")
        return {
            "valid": False,
            "verified_citations": [],
            "unsupported_claims": ["Verification failed due to an error."],
            "confidence": 0.0,
        }
