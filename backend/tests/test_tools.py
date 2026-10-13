"""
Tests for agent tools (grade_evidence, rewrite_query, verify_answer, search_documents).
LLM, Qdrant, and embedding services are mocked.
"""

import json
import os
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

os.environ.setdefault("GROQ_API_KEY", "test-key")


# ---------------------------------------------------------------------------
# grade_evidence
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_grade_evidence_sufficient():
    """grade_evidence should return sufficient=True when LLM confirms evidence."""
    payload = json.dumps({
        "sufficient": True,
        "relevant_chunk_ids": ["c1"],
        "reason": "The document clearly answers the question.",
        "confidence": 0.9,
    })

    with patch("services.llm.llm_service") as mock_llm:
        mock_llm.complete = AsyncMock(return_value=payload)

        from agent.tools import grade_evidence
        result = await grade_evidence(
            question="What year did Apollo 11 land on the Moon?",
            chunks=[MagicMock(chunk_id="c1", text="Apollo 11 landed in 1969.")],
        )

    assert result.sufficient is True
    assert "c1" in result.relevant_chunk_ids
    assert result.confidence >= 0.8


@pytest.mark.asyncio
async def test_grade_evidence_insufficient():
    """grade_evidence should return sufficient=False when LLM says evidence is lacking."""
    payload = json.dumps({
        "sufficient": False,
        "relevant_chunk_ids": [],
        "reason": "The documents do not contain information about this topic.",
        "confidence": 0.2,
    })

    with patch("services.llm.llm_service") as mock_llm:
        mock_llm.complete = AsyncMock(return_value=payload)

        from agent.tools import grade_evidence
        result = await grade_evidence(
            question="What is the population of Jupiter?",
            chunks=[MagicMock(chunk_id="c2", text="Jupiter is a gas giant.")],
        )

    assert result.sufficient is False
    assert result.relevant_chunk_ids == []


@pytest.mark.asyncio
async def test_grade_evidence_llm_failure():
    """grade_evidence should return a safe default (sufficient=False) when LLM raises."""
    with patch("services.llm.llm_service") as mock_llm:
        mock_llm.complete = AsyncMock(side_effect=RuntimeError("LLM timeout"))

        from agent.tools import grade_evidence
        result = await grade_evidence(
            question="When was the ISS launched?",
            chunks=[MagicMock(chunk_id="c3", text="ISS was launched in 1998.")],
        )

    assert result.sufficient is False


# ---------------------------------------------------------------------------
# rewrite_query
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_rewrite_query_returns_string():
    """rewrite_query should return a non-empty string even when LLM returns plain text."""
    with patch("services.llm.llm_service") as mock_llm:
        mock_llm.complete = AsyncMock(
            return_value="history of human spaceflight milestones chronology"
        )

        from agent.tools import rewrite_query
        result = await rewrite_query(
            original_query="Tell me about space history",
            iteration=1,
        )

    assert isinstance(result, str)
    assert len(result) > 0


# ---------------------------------------------------------------------------
# verify_answer
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_verify_answer_valid():
    """verify_answer should return a structured result from valid LLM JSON."""
    payload = json.dumps({
        "verified": True,
        "confidence": 0.95,
        "issues": [],
    })

    with patch("services.llm.llm_service") as mock_llm:
        mock_llm.complete = AsyncMock(return_value=payload)

        from agent.tools import verify_answer
        result = await verify_answer(
            question="What is a black hole?",
            answer="A black hole is a region of spacetime with gravity so strong that nothing can escape.",
            chunks=[MagicMock(chunk_id="c4", text="Black holes have extreme gravity.")],
        )

    assert result.verified is True
    assert result.confidence >= 0.9


# ---------------------------------------------------------------------------
# search_documents
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_search_documents():
    """search_documents should embed the query and return ChunkMeta objects."""
    fake_embedding = [0.1] * 384
    fake_chunk = MagicMock()
    fake_chunk.chunk_id = "chunk_abc"
    fake_chunk.text = "Mars has two moons: Phobos and Deimos."
    fake_chunk.document_id = "doc_001"
    fake_chunk.score = 0.92

    with patch("services.embeddings.embedding_service") as mock_emb, \
         patch("services.qdrant_service.qdrant_service") as mock_qdrant:

        mock_emb.embed = AsyncMock(return_value=fake_embedding)
        mock_qdrant.search = AsyncMock(return_value=[fake_chunk])

        from agent.tools import search_documents
        results = await search_documents(query="moons of Mars", top_k=5)

    assert len(results) == 1
    assert results[0].chunk_id == "chunk_abc"
    assert "Mars" in results[0].text
