from dotenv import load_dotenv
load_dotenv(".env")

import logging
import json
import uuid
from collections import defaultdict
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Optional

from fastapi import FastAPI, UploadFile, HTTPException, Header, Depends
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from models import ResearchRequest, ResearchResponse, UploadResponse, DocumentMeta, EvalSummary, ErrorResponse
from services.qdrant_service import qdrant_service
from services.ingestion import ingestion_service
from agent.graph import run_agent

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# In-memory stores
# ---------------------------------------------------------------------------
_research_results: dict[str, ResearchResponse] = {}

# Rate limiting: (ip, minute_bucket) -> count
_rate_limit_counters: dict[tuple, int] = defaultdict(int)
MAX_REQUESTS_PER_MINUTE = 10


def _check_rate_limit(ip: str) -> bool:
    """Return True if request is allowed, False if rate limited."""
    minute_bucket = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M")
    key = (ip, minute_bucket)
    _rate_limit_counters[key] += 1
    return _rate_limit_counters[key] <= MAX_REQUESTS_PER_MINUTE


# ---------------------------------------------------------------------------
# Lifespan
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting agentic-research-assistant backend")
    try:
        qdrant_service.ensure_collection()
        logger.info("Qdrant collection ready")
    except Exception as exc:
        logger.error("Failed to connect to Qdrant on startup: %s", exc)
    logger.info("Model: %s | Qdrant: %s", settings.GROQ_MODEL, settings.QDRANT_URL)
    yield
    logger.info("Shutting down")


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------
app = FastAPI(title="Agentic Research Assistant", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)


# ---------------------------------------------------------------------------
# Auth helper
# ---------------------------------------------------------------------------
def _require_eval_key(x_eval_key: Optional[str] = Header(default=None)) -> None:
    if x_eval_key != settings.EVAL_API_KEY:
        raise HTTPException(status_code=401, detail="Invalid or missing X-Eval-Key header")


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get("/health")
async def health():
    qdrant_status = "ok"
    try:
        qdrant_service.ensure_collection()
    except Exception as exc:
        logger.warning("Qdrant health check failed: %s", exc)
        qdrant_status = "error"
    return {"status": "ok", "qdrant": qdrant_status, "model": settings.GROQ_MODEL}


@app.post("/documents/upload", response_model=UploadResponse)
async def upload_document(file: UploadFile):
    filename = file.filename or ""
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext not in ("pdf", "txt", "md"):
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '.{ext}'. Allowed: pdf, txt, md",
        )

    content = await file.read()
    max_bytes = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
    if len(content) > max_bytes:
        raise HTTPException(
            status_code=400,
            detail=f"File exceeds maximum size of {settings.MAX_UPLOAD_SIZE_MB} MB",
        )

    try:
        result = ingestion_service.ingest_file(filename, content, ext)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        logger.exception("Unexpected error during ingestion")
        raise HTTPException(status_code=500, detail=str(exc))

    return result


@app.get("/documents", response_model=list[DocumentMeta])
async def list_documents():
    return qdrant_service.list_documents()


@app.delete("/documents/{document_id}")
async def delete_document(document_id: str):
    count = qdrant_service.delete_document(document_id)
    if count == 0:
        raise HTTPException(status_code=404, detail=f"Document '{document_id}' not found")
    return {"deleted": count, "document_id": document_id}


@app.post("/research", response_model=ResearchResponse)
async def research(request: ResearchRequest, x_forwarded_for: Optional[str] = Header(default=None)):
    from fastapi import Request
    # Use X-Forwarded-For or fall back to a placeholder
    ip = (x_forwarded_for or "unknown").split(",")[0].strip()

    if not _check_rate_limit(ip):
        raise HTTPException(
            status_code=429,
            detail="Rate limit exceeded. Maximum 10 research requests per minute.",
        )

    run_id = str(uuid.uuid4())
    try:
        response = run_agent(request.question)
        response.run_id = run_id
        _research_results[run_id] = response
        return response
    except Exception as exc:
        logger.exception("Unexpected error in /research run_id=%s", run_id)
        raise HTTPException(status_code=500, detail=f"Internal error (run_id={run_id}): {exc}")


@app.get("/research/{run_id}", response_model=ResearchResponse)
async def get_research(run_id: str):
    result = _research_results.get(run_id)
    if result is None:
        raise HTTPException(status_code=404, detail=f"Run '{run_id}' not found")
    return result


@app.post("/evals/run", response_model=EvalSummary)
async def run_evals(_: None = Depends(_require_eval_key)):
    from evals.runner import EvalRunner
    runner = EvalRunner()
    return runner.run_eval_suite()


@app.get("/evals/results", response_model=EvalSummary)
async def get_eval_results(_: None = Depends(_require_eval_key)):
    import os
    results_path = os.path.join(os.path.dirname(__file__), "evals", "eval_results.json")
    if not os.path.exists(results_path):
        raise HTTPException(status_code=404, detail="No eval results found. Run /evals/run first.")
    with open(results_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    return EvalSummary(**data)
