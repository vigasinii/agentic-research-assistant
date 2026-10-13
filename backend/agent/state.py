from typing import TypedDict


class AgentState(TypedDict):
    run_id: str
    question: str
    current_query: str
    retrieved_chunks: list[dict]       # serialized ChunkMeta dicts
    relevant_chunk_ids: list[str]
    evidence_sufficient: bool
    iteration_count: int
    max_iterations: int
    answer: str
    citations: list[dict]              # serialized Citation dicts
    abstained: bool
    abstention_reason: str
    execution_steps: list[dict]        # serialized ExecutionStep dicts
    verification_result: dict
    total_latency_ms: float
    _step_start_time: float            # internal timing
