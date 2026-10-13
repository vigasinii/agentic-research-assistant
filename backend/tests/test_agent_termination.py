"""
Tests for agent termination behaviour:
- Terminates after MAX_RETRIEVAL_ITERATIONS when evidence is never sufficient.
- Answers successfully when evidence is sufficient on the first try.
- Uses query expansion (two iterations) when first search is insufficient.
"""

import os
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

os.environ.setdefault("GROQ_API_KEY", "test-key")


def _make_chunk(chunk_id: str = "c1", text: str = "Space exploration content.") -> MagicMock:
    chunk = MagicMock()
    chunk.chunk_id = chunk_id
    chunk.text = text
    chunk.document_id = "doc_001"
    chunk.score = 0.85
    return chunk


def _make_grade_result(sufficient: bool, chunk_ids: list[str] | None = None) -> MagicMock:
    grade = MagicMock()
    grade.sufficient = sufficient
    grade.relevant_chunk_ids = chunk_ids or []
    grade.reason = "Test grade"
    grade.confidence = 0.9 if sufficient else 0.2
    return grade


# ---------------------------------------------------------------------------
# test_agent_terminates_after_max_iterations
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_agent_terminates_after_max_iterations():
    """
    When grade_evidence always returns insufficient the agent must stop
    after MAX_RETRIEVAL_ITERATIONS and set abstained=True.
    """
    from config import settings

    chunks = [_make_chunk()]
    insufficient_grade = _make_grade_result(sufficient=False)

    with patch("agent.tools.search_documents", new=AsyncMock(return_value=chunks)), \
         patch("agent.tools.grade_evidence", new=AsyncMock(return_value=insufficient_grade)), \
         patch("agent.tools.rewrite_query", new=AsyncMock(return_value="expanded query")):

        from agent.graph import run_agent
        response = await run_agent("What is the airspeed velocity of an unladen swallow?")

    assert response.abstained is True
    assert response.retrieval_iterations <= settings.MAX_RETRIEVAL_ITERATIONS


# ---------------------------------------------------------------------------
# test_agent_answers_when_sufficient
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_agent_answers_when_sufficient():
    """
    When grade_evidence returns sufficient=True on the first try the agent
    should produce an answer and NOT abstain.
    """
    chunks = [_make_chunk(text="Apollo 11 landed on the Moon in July 1969.")]
    sufficient_grade = _make_grade_result(sufficient=True, chunk_ids=["c1"])

    fake_answer = MagicMock()
    fake_answer.answer = "Apollo 11 landed on the Moon in 1969."
    fake_answer.abstained = False
    fake_answer.citations = []
    fake_answer.retrieved_chunks = chunks

    with patch("agent.tools.search_documents", new=AsyncMock(return_value=chunks)), \
         patch("agent.tools.grade_evidence", new=AsyncMock(return_value=sufficient_grade)), \
         patch("agent.tools.generate_answer", new=AsyncMock(return_value=fake_answer)):

        from agent.graph import run_agent
        response = await run_agent("When did Apollo 11 land on the Moon?")

    assert response.abstained is False
    assert response.answer is not None and len(response.answer) > 0


# ---------------------------------------------------------------------------
# test_agent_uses_expansion
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_agent_uses_expansion():
    """
    When the first search is insufficient but the second is sufficient,
    retrieval_iterations should equal 2 (one expansion happened).
    """
    chunks = [_make_chunk()]
    insufficient = _make_grade_result(sufficient=False)
    sufficient = _make_grade_result(sufficient=True, chunk_ids=["c1"])

    # Return insufficient on first call, sufficient on second
    grade_side_effects = [insufficient, sufficient]

    fake_answer = MagicMock()
    fake_answer.answer = "Mars has two moons."
    fake_answer.abstained = False
    fake_answer.citations = []
    fake_answer.retrieved_chunks = chunks

    with patch("agent.tools.search_documents", new=AsyncMock(return_value=chunks)), \
         patch("agent.tools.grade_evidence", new=AsyncMock(side_effect=grade_side_effects)), \
         patch("agent.tools.rewrite_query", new=AsyncMock(return_value="Mars moons Phobos Deimos")), \
         patch("agent.tools.generate_answer", new=AsyncMock(return_value=fake_answer)):

        from agent.graph import run_agent
        response = await run_agent("How many moons does Mars have?")

    assert response.retrieval_iterations == 2
