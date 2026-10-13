from datetime import datetime
from typing import Optional
from pydantic import BaseModel, field_validator


class DocumentMeta(BaseModel):
    id: str
    filename: str
    file_type: str
    size_bytes: int
    chunk_count: int
    uploaded_at: datetime
    collection: str


class ChunkMeta(BaseModel):
    chunk_id: str
    document_id: str
    source_filename: str
    page_number: Optional[int] = None
    chunk_index: int
    text: str
    score: Optional[float] = None


class ResearchRequest(BaseModel):
    question: str

    @field_validator("question")
    @classmethod
    def validate_question(cls, v: str) -> str:
        if len(v) < 3:
            raise ValueError("question must be at least 3 characters")
        if len(v) > 2000:
            raise ValueError("question must be at most 2000 characters")
        return v


class Citation(BaseModel):
    chunk_id: str
    source_filename: str
    page_number: Optional[int] = None
    excerpt: str  # first 200 chars of chunk text


class ExecutionStep(BaseModel):
    step_name: str
    input_summary: str
    output_summary: str
    latency_ms: float


class ResearchResponse(BaseModel):
    run_id: str
    question: str
    answer: str
    citations: list[Citation]
    abstained: bool
    abstention_reason: Optional[str] = None
    retrieval_iterations: int
    execution_steps: list[ExecutionStep]
    total_latency_ms: float
    created_at: datetime


class EvalRequest(BaseModel):
    pass


class EvalResult(BaseModel):
    question_id: str
    question: str
    expected_answerable: bool
    agent_abstained: bool
    abstention_correct: bool
    retrieved_chunk_ids: list[str]
    relevant_chunk_ids: list[str]
    answer: str
    expected_answer_contains: list[str]
    answer_correct: bool
    citation_ids: list[str]
    latency_ms: float


class EvalSummary(BaseModel):
    run_id: str
    timestamp: datetime
    precision_at_k: float
    recall_at_k: float
    abstention_accuracy: float
    citation_validity: float
    avg_latency_ms: float
    total_cases: int
    results: list[EvalResult]


class UploadResponse(BaseModel):
    document_id: str
    filename: str
    chunk_count: int
    message: str


class ErrorResponse(BaseModel):
    detail: str
