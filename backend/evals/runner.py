"""
Eval runner for the agentic research assistant.
Loads dataset.json, runs each case through the agent, computes metrics,
saves results to eval_results.json, and prints a formatted report.
"""

from __future__ import annotations

import asyncio
import json
import os
import time
from pathlib import Path
from typing import Any

from models import EvalResult, EvalSummary
from evals.metrics import compute_all_metrics
from agent.graph import run_agent

DATASET_PATH = Path(__file__).parent / "dataset.json"
RESULTS_PATH = Path(__file__).parent / "eval_results.json"


class EvalRunner:
    def __init__(self) -> None:
        with open(DATASET_PATH, "r", encoding="utf-8") as f:
            self.dataset: list[dict[str, Any]] = json.load(f)

    async def run_eval_suite(self) -> EvalSummary:
        results: list[EvalResult] = []

        for case in self.dataset:
            case_id: str = case["id"]
            question: str = case["question"]
            expected_answerable: bool = case["expected_answerable"]
            expected_contains: list[str] = case.get("expected_answer_contains", [])
            relevant_keywords: list[str] = case.get("relevant_chunk_keywords", [])

            start = time.monotonic()
            try:
                response = await run_agent(question)
                latency_ms = (time.monotonic() - start) * 1000

                agent_abstained: bool = response.abstained
                answer_text: str = response.answer or ""

                # Retrieve chunk IDs from citations
                citation_ids: list[str] = [
                    c.chunk_id for c in (response.citations or []) if c.chunk_id
                ]
                retrieved_chunk_ids: list[str] = [
                    c.chunk_id for c in (response.retrieved_chunks or []) if c.chunk_id
                ]

                # Determine which retrieved chunks are "relevant" by keyword presence
                relevant_retrieved: list[str] = []
                for chunk in (response.retrieved_chunks or []):
                    chunk_text = (chunk.text or "").lower()
                    if any(kw.lower() in chunk_text for kw in relevant_keywords):
                        relevant_retrieved.append(chunk.chunk_id)

                # Abstention correctness
                abstention_correct = agent_abstained != expected_answerable

                # Answer correctness (only for answerable cases)
                answer_correct = False
                if expected_answerable and not agent_abstained:
                    answer_lower = answer_text.lower()
                    answer_correct = all(
                        kw.lower() in answer_lower for kw in expected_contains
                    )

                result = EvalResult(
                    case_id=case_id,
                    question=question,
                    expected_answerable=expected_answerable,
                    agent_abstained=agent_abstained,
                    abstention_correct=abstention_correct,
                    answer_correct=answer_correct,
                    retrieved_chunk_ids=retrieved_chunk_ids,
                    relevant_chunk_ids=relevant_retrieved,
                    citation_ids=citation_ids,
                    latency_ms=latency_ms,
                    scenario=case.get("scenario", ""),
                )
            except Exception as exc:
                latency_ms = (time.monotonic() - start) * 1000
                result = EvalResult(
                    case_id=case_id,
                    question=question,
                    expected_answerable=expected_answerable,
                    agent_abstained=True,
                    abstention_correct=not expected_answerable,
                    answer_correct=False,
                    retrieved_chunk_ids=[],
                    relevant_chunk_ids=[],
                    citation_ids=[],
                    latency_ms=latency_ms,
                    scenario=case.get("scenario", ""),
                    error=str(exc),
                )

            results.append(result)

        metrics = compute_all_metrics(results)
        summary = EvalSummary(
            total_cases=len(results),
            results=results,
            precision_at_k=metrics["precision_at_k"],
            recall_at_k=metrics["recall_at_k"],
            abstention_accuracy=metrics["abstention_accuracy"],
            citation_validity_rate=metrics["citation_validity_rate"],
            answer_accuracy=metrics["answer_accuracy"],
            avg_latency_ms=metrics["avg_latency_ms"],
        )

        # Save to disk
        with open(RESULTS_PATH, "w", encoding="utf-8") as f:
            json.dump(summary.model_dump(), f, indent=2)

        self._print_report(summary)
        return summary

    def _print_report(self, summary: EvalSummary) -> None:
        print("\n" + "=" * 60)
        print("EVAL RESULTS SUMMARY")
        print("=" * 60)
        metrics = [
            ("Total cases", str(summary.total_cases)),
            ("Precision@K", f"{summary.precision_at_k:.3f}"),
            ("Recall@K", f"{summary.recall_at_k:.3f}"),
            ("Abstention accuracy", f"{summary.abstention_accuracy:.3f}"),
            ("Citation validity rate", f"{summary.citation_validity_rate:.3f}"),
            ("Answer accuracy", f"{summary.answer_accuracy:.3f}"),
            ("Avg latency (ms)", f"{summary.avg_latency_ms:.1f}"),
        ]
        for metric, value in metrics:
            print(f"  {metric:<28} {value}")

        print("\n" + "-" * 60)
        print("PER-CASE RESULTS")
        print("-" * 60)
        print(f"  {'ID':<10} {'Scenario':<22} {'Abstain OK':<12} {'Answer OK':<10} {'ms':>8}")
        print("  " + "-" * 56)
        for r in summary.results:
            abstain_ok = "PASS" if r.abstention_correct else "FAIL"
            answer_ok = "PASS" if r.answer_correct else ("N/A" if not r.expected_answerable else "FAIL")
            print(
                f"  {r.case_id:<10} {r.scenario:<22} {abstain_ok:<12} {answer_ok:<10} {r.latency_ms:>8.0f}"
            )
        print("=" * 60 + "\n")


def run_eval_cli() -> None:
    """Entry point for `python -m evals.runner`."""
    runner = EvalRunner()
    asyncio.run(runner.run_eval_suite())


if __name__ == "__main__":
    run_eval_cli()
