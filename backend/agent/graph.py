import time
import uuid
from datetime import datetime, timezone
from typing import Literal

from langgraph.graph import END, StateGraph

from config import settings
from models import Citation, ExecutionStep, ResearchResponse
from services.llm import llm_service
from .state import AgentState
from .tools import (
    grade_evidence,
    rewrite_search_query,
    search_documents,
    verify_answer,
)


def _ts() -> str:
    return datetime.now(timezone.utc).isoformat()


def _chunks_from_state(state: AgentState):
    """Deserialize retrieved_chunks list of dicts back to ChunkMeta-like objects for tools."""
    from models import ChunkMeta
    chunks = []
    for c in state.get("retrieved_chunks", []):
        try:
            chunks.append(ChunkMeta(**c))
        except Exception:
            pass
    return chunks


def _record_step(
    state: AgentState,
    step_name: str,
    input_summary: str,
    output_summary: str,
    start_time: float,
) -> list[dict]:
    latency_ms = (time.monotonic() - start_time) * 1000
    step = ExecutionStep(
        step_name=step_name,
        input_summary=input_summary,
        output_summary=output_summary,
        latency_ms=round(latency_ms, 2),
    )
    steps = list(state.get("execution_steps", []))
    steps.append(step.model_dump())
    return steps


# ---------------------------------------------------------------------------
# Node: query_analysis
# ---------------------------------------------------------------------------

def query_analysis_node(state: AgentState) -> AgentState:
    t0 = time.monotonic()
    question = state["question"]
    print(f"[{_ts()}] [graph:query_analysis] question='{question[:80]}'")

    messages = [
        {
            "role": "system",
            "content": (
                "You are a search query specialist. Rewrite the user's question as an "
                "optimized semantic search query. Return only the query string, no quotes."
            ),
        },
        {
            "role": "user",
            "content": f"Question: {question}\n\nOptimized search query:",
        },
    ]
    try:
        current_query = llm_service.chat(messages=messages, temperature=0.0, max_tokens=128).strip()
        current_query = current_query.strip('"').strip("'") or question
    except Exception as e:
        print(f"[{_ts()}] [graph:query_analysis] Error: {e}; using original question")
        current_query = question

    steps = _record_step(
        state,
        "query_analysis",
        f"question: {question[:100]}",
        f"refined_query: {current_query[:100]}",
        t0,
    )
    return {**state, "current_query": current_query, "execution_steps": steps}


# ---------------------------------------------------------------------------
# Node: retrieve
# ---------------------------------------------------------------------------

def retrieve_node(state: AgentState) -> AgentState:
    t0 = time.monotonic()
    query = state["current_query"]
    iteration = state.get("iteration_count", 0) + 1
    print(f"[{_ts()}] [graph:retrieve] iteration={iteration} query='{query[:80]}'")

    new_chunks = search_documents(query, top_k=settings.TOP_K)
    new_chunk_dicts = [c.model_dump() for c in new_chunks]

    # Merge with existing, deduplicate by chunk_id
    existing = {c["chunk_id"]: c for c in state.get("retrieved_chunks", [])}
    for c in new_chunk_dicts:
        existing[c["chunk_id"]] = c
    merged = list(existing.values())

    steps = _record_step(
        state,
        "retrieve",
        f"query: {query[:100]}, iteration: {iteration}",
        f"found {len(new_chunks)} new chunks, total {len(merged)}",
        t0,
    )
    return {
        **state,
        "retrieved_chunks": merged,
        "iteration_count": iteration,
        "execution_steps": steps,
    }


# ---------------------------------------------------------------------------
# Node: grade
# ---------------------------------------------------------------------------

def grade_node(state: AgentState) -> AgentState:
    t0 = time.monotonic()
    question = state["question"]
    chunks = _chunks_from_state(state)
    print(f"[{_ts()}] [graph:grade] grading {len(chunks)} chunks")

    grading = grade_evidence(question, chunks)
    sufficient = grading.get("sufficient", False)
    relevant_ids = grading.get("relevant_chunk_ids", [])

    # Check if we've hit max iterations — force abstain if not sufficient
    iteration_count = state.get("iteration_count", 0)
    max_iter = state.get("max_iterations", settings.MAX_RETRIEVAL_ITERATIONS)
    will_abstain = not sufficient and iteration_count >= max_iter

    steps = _record_step(
        state,
        "grade_evidence",
        f"chunks: {len(chunks)}, question: {question[:80]}",
        f"sufficient={sufficient}, relevant={len(relevant_ids)}, reason={grading.get('reason','')[:80]}",
        t0,
    )
    updates: dict = {
        **state,
        "evidence_sufficient": sufficient,
        "relevant_chunk_ids": relevant_ids,
        "execution_steps": steps,
    }
    if will_abstain:
        updates["abstained"] = True
        updates["abstention_reason"] = (
            f"Evidence insufficient after {iteration_count} retrieval iterations. "
            f"Grader reason: {grading.get('reason', 'N/A')}"
        )
    return updates


def _route_after_grade(
    state: AgentState,
) -> Literal["answer_node", "rewrite_node"]:
    sufficient = state.get("evidence_sufficient", False)
    iteration_count = state.get("iteration_count", 0)
    max_iter = state.get("max_iterations", settings.MAX_RETRIEVAL_ITERATIONS)
    if sufficient or iteration_count >= max_iter:
        return "answer_node"
    return "rewrite_node"


# ---------------------------------------------------------------------------
# Node: rewrite
# ---------------------------------------------------------------------------

def rewrite_node(state: AgentState) -> AgentState:
    t0 = time.monotonic()
    question = state["question"]
    chunks = _chunks_from_state(state)
    print(f"[{_ts()}] [graph:rewrite] rewriting query")

    new_query = rewrite_search_query(question, chunks)

    steps = _record_step(
        state,
        "rewrite_query",
        f"question: {question[:80]}, prev_chunks: {len(chunks)}",
        f"new_query: {new_query[:100]}",
        t0,
    )
    return {**state, "current_query": new_query, "execution_steps": steps}


# ---------------------------------------------------------------------------
# Node: answer
# ---------------------------------------------------------------------------

def answer_node(state: AgentState) -> AgentState:
    t0 = time.monotonic()
    question = state["question"]
    abstained = state.get("abstained", False)

    if abstained:
        answer = (
            "I was unable to find sufficient evidence in the available documents to answer "
            "this question confidently."
        )
        steps = _record_step(
            state,
            "generate_answer",
            f"question: {question[:80]}, abstained=True",
            "abstained; no answer generated",
            t0,
        )
        return {**state, "answer": answer, "citations": [], "execution_steps": steps}

    all_chunks = _chunks_from_state(state)
    relevant_ids = set(state.get("relevant_chunk_ids", []))
    relevant_chunks = [c for c in all_chunks if c.chunk_id in relevant_ids] or all_chunks

    context = "\n\n".join(
        f"[Source: {c.source_filename}, page {c.page_number}, chunk_id: {c.chunk_id}]\n{c.text}"
        for c in relevant_chunks[:10]
    )

    messages = [
        {
            "role": "system",
            "content": (
                "You are a research assistant. Answer the question based strictly on the "
                "provided context. Cite chunk_ids in your answer using [chunk_id: X] notation. "
                "If the context does not contain enough information, say so."
            ),
        },
        {
            "role": "user",
            "content": f"Question: {question}\n\nContext:\n{context}\n\nAnswer:",
        },
    ]
    try:
        answer = llm_service.chat(messages=messages, temperature=0.1, max_tokens=1024)
    except Exception as e:
        print(f"[{_ts()}] [graph:answer] Error generating answer: {e}")
        answer = "An error occurred while generating the answer."

    # Build citations from relevant chunks
    citations = []
    for c in relevant_chunks:
        citations.append(
            Citation(
                chunk_id=c.chunk_id,
                source_filename=c.source_filename,
                page_number=c.page_number,
                excerpt=c.text[:200],
            ).model_dump()
        )

    steps = _record_step(
        state,
        "generate_answer",
        f"question: {question[:80]}, context_chunks: {len(relevant_chunks)}",
        f"answer_len={len(answer)}, citations={len(citations)}",
        t0,
    )
    return {**state, "answer": answer, "citations": citations, "execution_steps": steps}


# ---------------------------------------------------------------------------
# Node: verify
# ---------------------------------------------------------------------------

def verify_node(state: AgentState) -> AgentState:
    t0 = time.monotonic()
    answer = state.get("answer", "")
    citations = state.get("citations", [])
    chunks = _chunks_from_state(state)
    abstained = state.get("abstained", False)

    if abstained or not answer:
        steps = _record_step(
            state,
            "verify_answer",
            "skipped (abstained or no answer)",
            "skipped",
            t0,
        )
        return {**state, "verification_result": {}, "execution_steps": steps}

    verification = verify_answer(answer, citations, chunks)

    final_answer = answer
    final_abstained = abstained
    final_abstention_reason = state.get("abstention_reason", "")

    if not verification.get("valid", True):
        unsupported = verification.get("unsupported_claims", [])
        if unsupported:
            final_answer = (
                answer + "\n\n[Note: Some claims in this answer could not be fully verified "
                "against the source documents. Please review the cited sources directly.]"
            )

    steps = _record_step(
        state,
        "verify_answer",
        f"answer_len={len(answer)}, citations={len(citations)}",
        f"valid={verification.get('valid')}, confidence={verification.get('confidence')}",
        t0,
    )
    return {
        **state,
        "answer": final_answer,
        "abstained": final_abstained,
        "abstention_reason": final_abstention_reason,
        "verification_result": verification,
        "execution_steps": steps,
    }


# ---------------------------------------------------------------------------
# Build graph
# ---------------------------------------------------------------------------

def build_graph():
    builder = StateGraph(AgentState)

    builder.add_node("query_analysis_node", query_analysis_node)
    builder.add_node("retrieve_node", retrieve_node)
    builder.add_node("grade_node", grade_node)
    builder.add_node("rewrite_node", rewrite_node)
    builder.add_node("answer_node", answer_node)
    builder.add_node("verify_node", verify_node)

    builder.set_entry_point("query_analysis_node")
    builder.add_edge("query_analysis_node", "retrieve_node")
    builder.add_edge("retrieve_node", "grade_node")
    builder.add_conditional_edges(
        "grade_node",
        _route_after_grade,
        {"answer_node": "answer_node", "rewrite_node": "rewrite_node"},
    )
    builder.add_edge("rewrite_node", "retrieve_node")
    builder.add_edge("answer_node", "verify_node")
    builder.add_edge("verify_node", END)

    return builder.compile()


_graph = None


def _get_graph():
    global _graph
    if _graph is None:
        _graph = build_graph()
    return _graph


def run_agent(question: str) -> ResearchResponse:
    run_id = str(uuid.uuid4())
    wall_start = time.monotonic()
    created_at = datetime.now(timezone.utc)
    print(f"[{_ts()}] [graph] Starting agent run_id={run_id} question='{question[:80]}'")

    initial_state: AgentState = {
        "run_id": run_id,
        "question": question,
        "current_query": question,
        "retrieved_chunks": [],
        "relevant_chunk_ids": [],
        "evidence_sufficient": False,
        "iteration_count": 0,
        "max_iterations": settings.MAX_RETRIEVAL_ITERATIONS,
        "answer": "",
        "citations": [],
        "abstained": False,
        "abstention_reason": "",
        "execution_steps": [],
        "verification_result": {},
        "total_latency_ms": 0.0,
        "_step_start_time": wall_start,
    }

    try:
        graph = _get_graph()
        final_state = graph.invoke(initial_state)
    except Exception as e:
        print(f"[{_ts()}] [graph] Agent error: {e}")
        total_ms = (time.monotonic() - wall_start) * 1000
        return ResearchResponse(
            run_id=run_id,
            question=question,
            answer="An error occurred while processing your question.",
            citations=[],
            abstained=True,
            abstention_reason=f"Agent error: {e}",
            retrieval_iterations=0,
            execution_steps=[],
            total_latency_ms=round(total_ms, 2),
            created_at=created_at,
        )

    total_ms = (time.monotonic() - wall_start) * 1000

    citations = [Citation(**c) for c in final_state.get("citations", [])]
    steps = [ExecutionStep(**s) for s in final_state.get("execution_steps", [])]

    return ResearchResponse(
        run_id=run_id,
        question=question,
        answer=final_state.get("answer", ""),
        citations=citations,
        abstained=final_state.get("abstained", False),
        abstention_reason=final_state.get("abstention_reason") or None,
        retrieval_iterations=final_state.get("iteration_count", 0),
        execution_steps=steps,
        total_latency_ms=round(total_ms, 2),
        created_at=created_at,
    )
