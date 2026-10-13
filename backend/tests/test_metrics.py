"""
Unit tests for pure metric functions in evals/metrics.py.
No mocks needed — all functions are deterministic and side-effect-free.
"""

import os
import pytest

os.environ.setdefault("GROQ_API_KEY", "test-key")

from evals.metrics import (
    precision_at_k,
    recall_at_k,
    abstention_accuracy,
    citation_validity_rate,
    answer_accuracy,
    compute_all_metrics,
)
from models import EvalResult


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_result(
    *,
    abstention_correct: bool = True,
    answer_correct: bool = False,
    expected_answerable: bool = True,
    retrieved_chunk_ids: list[str] | None = None,
    relevant_chunk_ids: list[str] | None = None,
    citation_ids: list[str] | None = None,
    latency_ms: float = 100.0,
) -> EvalResult:
    return EvalResult(
        case_id="test",
        question="test question?",
        expected_answerable=expected_answerable,
        agent_abstained=not expected_answerable if abstention_correct else expected_answerable,
        abstention_correct=abstention_correct,
        answer_correct=answer_correct,
        retrieved_chunk_ids=retrieved_chunk_ids or [],
        relevant_chunk_ids=relevant_chunk_ids or [],
        citation_ids=citation_ids or [],
        latency_ms=latency_ms,
        scenario="answerable",
    )


# ---------------------------------------------------------------------------
# precision_at_k
# ---------------------------------------------------------------------------

def test_precision_perfect():
    """All retrieved chunks are relevant → precision == 1.0."""
    assert precision_at_k(["a", "b", "c"], ["a", "b", "c"]) == pytest.approx(1.0)


def test_precision_half():
    """Half of retrieved chunks are relevant → precision == 0.5."""
    assert precision_at_k(["a", "b", "c", "d"], ["a", "c"]) == pytest.approx(0.5)


def test_precision_empty_retrieved():
    """No retrieved chunks → precision == 0.0."""
    assert precision_at_k([], ["a", "b"]) == pytest.approx(0.0)


def test_precision_none_relevant():
    """Retrieved chunks with no relevant ones → precision == 0.0."""
    assert precision_at_k(["a", "b"], ["c", "d"]) == pytest.approx(0.0)


# ---------------------------------------------------------------------------
# recall_at_k
# ---------------------------------------------------------------------------

def test_recall_perfect():
    """Retrieved all relevant chunks → recall == 1.0."""
    assert recall_at_k(["a", "b", "c"], ["a", "b", "c"]) == pytest.approx(1.0)


def test_recall_partial():
    """Retrieved 2 of 4 relevant chunks → recall == 0.5."""
    assert recall_at_k(["a", "b"], ["a", "b", "c", "d"]) == pytest.approx(0.5)


def test_recall_empty_relevant():
    """No relevant chunks defined → recall == 1.0 (vacuously true)."""
    assert recall_at_k(["a", "b"], []) == pytest.approx(1.0)


def test_recall_extra_retrieved():
    """Extra retrieved chunks beyond relevant set don't hurt recall."""
    assert recall_at_k(["a", "b", "c", "extra1", "extra2"], ["a", "b", "c"]) == pytest.approx(1.0)


# ---------------------------------------------------------------------------
# abstention_accuracy
# ---------------------------------------------------------------------------

def test_abstention_accuracy_all_correct():
    results = [_make_result(abstention_correct=True) for _ in range(4)]
    assert abstention_accuracy(results) == pytest.approx(1.0)


def test_abstention_accuracy_half():
    results = [
        _make_result(abstention_correct=True),
        _make_result(abstention_correct=True),
        _make_result(abstention_correct=False),
        _make_result(abstention_correct=False),
    ]
    assert abstention_accuracy(results) == pytest.approx(0.5)


def test_abstention_accuracy_empty():
    assert abstention_accuracy([]) == pytest.approx(0.0)


# ---------------------------------------------------------------------------
# citation_validity_rate
# ---------------------------------------------------------------------------

def test_citation_validity_all_valid():
    """All citations are in retrieved chunks → 1.0."""
    results = [
        _make_result(
            retrieved_chunk_ids=["c1", "c2"],
            citation_ids=["c1", "c2"],
        )
    ]
    assert citation_validity_rate(results) == pytest.approx(1.0)


def test_citation_validity_half():
    """Half of citations are in retrieved chunks → 0.5."""
    results = [
        _make_result(
            retrieved_chunk_ids=["c1"],
            citation_ids=["c1", "c2"],  # c2 not retrieved
        )
    ]
    assert citation_validity_rate(results) == pytest.approx(0.5)


def test_citation_validity_no_citations():
    """No citations at all → 1.0 (vacuously valid)."""
    results = [_make_result(citation_ids=[])]
    assert citation_validity_rate(results) == pytest.approx(1.0)


def test_citation_validity_across_cases():
    """Validity computed across multiple cases."""
    results = [
        _make_result(retrieved_chunk_ids=["c1"], citation_ids=["c1"]),  # 1/1 valid
        _make_result(retrieved_chunk_ids=["c2"], citation_ids=["c2", "c3"]),  # 1/2 valid
    ]
    # total valid: 2, total citations: 3
    assert citation_validity_rate(results) == pytest.approx(2 / 3)


# ---------------------------------------------------------------------------
# compute_all_metrics
# ---------------------------------------------------------------------------

def test_compute_all_metrics_returns_all_keys():
    results = [
        _make_result(
            abstention_correct=True,
            answer_correct=True,
            expected_answerable=True,
            retrieved_chunk_ids=["a"],
            relevant_chunk_ids=["a"],
            citation_ids=["a"],
            latency_ms=200.0,
        )
    ]
    metrics = compute_all_metrics(results, k=5)
    expected_keys = {
        "precision_at_k", "recall_at_k", "abstention_accuracy",
        "citation_validity_rate", "answer_accuracy", "avg_latency_ms", "k",
    }
    assert set(metrics.keys()) == expected_keys


def test_compute_all_metrics_empty():
    metrics = compute_all_metrics([])
    assert metrics["precision_at_k"] == pytest.approx(0.0)
    assert metrics["abstention_accuracy"] == pytest.approx(0.0)
