"""
Pure metric functions for evaluating the research agent.
All functions are free of side effects and can be unit-tested without mocks.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from models import EvalResult


def precision_at_k(retrieved_ids: list[str], relevant_ids: list[str]) -> float:
    """
    Compute Precision@K.

    Formula: |retrieved ∩ relevant| / |retrieved|

    Returns 0.0 when nothing was retrieved, to avoid division-by-zero.
    A high value means most retrieved chunks were actually relevant.
    """
    if not retrieved_ids:
        return 0.0
    relevant_set = set(relevant_ids)
    tp = sum(1 for rid in retrieved_ids if rid in relevant_set)
    return tp / len(retrieved_ids)


def recall_at_k(retrieved_ids: list[str], relevant_ids: list[str]) -> float:
    """
    Compute Recall@K.

    Formula: |retrieved ∩ relevant| / |relevant|

    Returns 1.0 vacuously when there are no relevant items (nothing to miss).
    A high value means most relevant chunks were successfully retrieved.
    """
    if not relevant_ids:
        return 1.0
    relevant_set = set(relevant_ids)
    tp = sum(1 for rid in retrieved_ids if rid in relevant_set)
    return tp / len(relevant_ids)


def abstention_accuracy(results: list[EvalResult]) -> float:
    """
    Fraction of cases where the agent's abstention decision was correct.

    Formula: cases where abstention_correct == True / total cases

    abstention_correct is True when:
      - The question was answerable and the agent did NOT abstain, OR
      - The question was unanswerable and the agent DID abstain.
    """
    if not results:
        return 0.0
    correct = sum(1 for r in results if r.abstention_correct)
    return correct / len(results)


def citation_validity_rate(results: list[EvalResult]) -> float:
    """
    Fraction of cited chunk IDs that appeared in the agent's retrieved chunks.

    Formula: citations found in retrieved_chunk_ids / total citations across all cases

    A high value means the agent only cites chunks it actually retrieved (not hallucinated IDs).
    Returns 1.0 if no citations were made at all (vacuously valid).
    """
    total_citations = 0
    valid_citations = 0
    for r in results:
        retrieved_set = set(r.retrieved_chunk_ids)
        for cid in r.citation_ids:
            total_citations += 1
            if cid in retrieved_set:
                valid_citations += 1
    if total_citations == 0:
        return 1.0
    return valid_citations / total_citations


def answer_accuracy(results: list[EvalResult]) -> float:
    """
    Fraction of answerable cases where the agent's answer was correct.

    Formula: answerable cases where answer_correct == True / total answerable cases

    Returns 1.0 if there are no answerable cases (vacuously correct).
    """
    answerable = [r for r in results if r.expected_answerable]
    if not answerable:
        return 1.0
    correct = sum(1 for r in answerable if r.answer_correct)
    return correct / len(answerable)


def compute_all_metrics(results: list[EvalResult], k: int = 5) -> dict:
    """
    Compute all evaluation metrics and return them as a single dict.

    Aggregates precision and recall by averaging per-case values.
    All other metrics are computed over the full results list.

    Args:
        results: List of EvalResult objects from the eval runner.
        k: The retrieval depth used for precision/recall labels (informational only).

    Returns:
        dict with keys:
          precision_at_k, recall_at_k, abstention_accuracy,
          citation_validity_rate, answer_accuracy, avg_latency_ms, k
    """
    if not results:
        return {
            "precision_at_k": 0.0,
            "recall_at_k": 0.0,
            "abstention_accuracy": 0.0,
            "citation_validity_rate": 1.0,
            "answer_accuracy": 1.0,
            "avg_latency_ms": 0.0,
            "k": k,
        }

    per_case_precision = [
        precision_at_k(r.retrieved_chunk_ids, r.relevant_chunk_ids) for r in results
    ]
    per_case_recall = [
        recall_at_k(r.retrieved_chunk_ids, r.relevant_chunk_ids) for r in results
    ]

    latencies = [r.latency_ms for r in results if r.latency_ms is not None]

    return {
        "precision_at_k": sum(per_case_precision) / len(per_case_precision),
        "recall_at_k": sum(per_case_recall) / len(per_case_recall),
        "abstention_accuracy": abstention_accuracy(results),
        "citation_validity_rate": citation_validity_rate(results),
        "answer_accuracy": answer_accuracy(results),
        "avg_latency_ms": sum(latencies) / len(latencies) if latencies else 0.0,
        "k": k,
    }
