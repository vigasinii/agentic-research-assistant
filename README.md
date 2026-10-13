# Agentic Research Assistant

A production-quality Agentic RAG system that retrieves evidence, grades its sufficiency, rewrites queries when needed, generates grounded answers with citations, and explicitly abstains when documents cannot support an answer.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Next.js Frontend                         │
│   Document Upload │ Research Panel │ Citation Viewer │ Eval UI  │
└───────────────────────────┬─────────────────────────────────────┘
                            │ HTTP (FastAPI)
┌───────────────────────────▼─────────────────────────────────────┐
│                    FastAPI Backend (main.py)                     │
│  /documents/upload  /research  /evals/run  /evals/results       │
└───────────┬───────────────────────────────┬─────────────────────┘
            │                               │
┌───────────▼──────────────┐   ┌────────────▼──────────────────┐
│   LangGraph Agent        │   │   Qdrant Vector DB            │
│                          │   │   (Docker local / Cloud prod) │
│  query_analysis_node     │   └────────────┬──────────────────┘
│       ↓                  │                │
│  retrieve_node ──────────┼────────────────┘ (search_documents)
│       ↓                  │
│  grade_node              │   ┌───────────────────────────────┐
│  ↙ sufficient  ↘ not     │   │   Groq LLM API                │
│  answer_node  rewrite    │   │   (grade, rewrite, answer,    │
│       ↓        ↓         │   │    verify, query_analysis)    │
│  verify_node  retrieve   │   └───────────────────────────────┘
│       ↓                  │
│   ResearchResponse       │   ┌───────────────────────────────┐
│   (answer+citations      │   │   SentenceTransformers        │
│    +abstention)          │   │   all-MiniLM-L6-v2 (384d)     │
└──────────────────────────┘   └───────────────────────────────┘
```

## Agent Decision Flow

```
START
  │
  ▼
Query Analysis (LLM refines question for retrieval)
  │
  ▼
Retrieve Evidence (Qdrant semantic search, top-5)
  │
  ▼
Grade Evidence ──── sufficient? ────────────────────┐
  │                                                  │
  NO (and iterations < max)                         YES
  │                                                  │
  ▼                                                  │
Rewrite Query (LLM rephrases)                        │
  │                                                  │
  ▼                                                  │
Retrieve Again ──────── still not? ──── abstain     │
                                                     ▼
                                              Generate Answer
                                                     │
                                                     ▼
                                             Verify Citations
                                                     │
                                                     ▼
                                              ResearchResponse
```

Max 3 retrieval iterations (configurable). Terminates deterministically.

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python 3.11, FastAPI, Pydantic v2 |
| Agent | LangGraph state machine |
| LLM | Groq API (llama-3.1-8b-instant by default) |
| Embeddings | sentence-transformers/all-MiniLM-L6-v2 (384d) |
| Vector DB | Qdrant (Docker local / Qdrant Cloud prod) |
| Documents | PyMuPDF (PDF), stdlib (TXT/MD) |
| Frontend | Next.js 14, TypeScript, Tailwind CSS |
| Tests | pytest, pytest-mock |
| CI | GitHub Actions |
| Deployment | Render (backend + frontend) |

## Local Setup

### Prerequisites
- Python 3.11+
- Node.js 18+
- Docker & Docker Compose
- [Groq API key](https://console.groq.com) (free tier available)

### 1. Clone and configure

```bash
git clone https://github.com/vigasinii/agentic-research-assistant
cd agentic-research-assistant
cp .env.example backend/.env
# Edit backend/.env and set GROQ_API_KEY=your_key
```

### 2. Start Qdrant

```bash
docker-compose up -d
```

### 3. Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

API docs at http://localhost:8000/docs

### 4. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000

### 5. Upload a document and ask a question

```bash
# Upload a document
curl -X POST http://localhost:8000/documents/upload \
  -F "file=@your_document.pdf"

# Ask a research question
curl -X POST http://localhost:8000/research \
  -H "Content-Type: application/json" \
  -d '{"question": "What are the key findings about Mars habitability?"}'
```

## Running Evaluations

### CLI (recommended for reproducibility)

```bash
cd backend
GROQ_API_KEY=your_key python -m evals.runner
```

Results are saved to `backend/evals/eval_results.json`.

### Via API

```bash
curl -X POST http://localhost:8000/evals/run \
  -H "X-Eval-Key: eval-secret-change-me"
```

## Evaluation Methodology

The benchmark dataset (`backend/evals/dataset.json`) contains 15 cases across 5 scenario types:

| Scenario | Count | Description |
|---|---|---|
| Answerable | 3 | Clearly answered from uploaded docs |
| Unanswerable | 3 | Outside available knowledge |
| Ambiguous | 3 | Partial overlap, unclear answer |
| Multi-document | 3 | Requires synthesis across docs |
| Conflicting evidence | 3 | Different sections give different details |

### Metrics

| Metric | Formula | Notes |
|---|---|---|
| Precision@K | TP_chunks / (TP_chunks + FP_chunks) | Relevant chunks / all retrieved |
| Recall@K | TP_chunks / (TP_chunks + FN_chunks) | Relevant retrieved / all relevant |
| Abstention Accuracy | correct_abstentions / total | Agent answers ↔ ground truth answerability |
| Citation Validity | valid_citations / total_citations | Citations reference actually retrieved chunks |
| Answer Accuracy | correct_answers / answerable_cases | Expected keywords appear in answer |
| Avg Latency | mean(end_to_end_ms) | Full agent run time |

Relevance is determined by keyword matching against `relevant_chunk_keywords` in the dataset. No LLM judge is used for retrieval metrics — they are fully deterministic.

### Sample Eval Results

*(Run `python -m evals.runner` to generate real numbers — these are representative estimates)*

| Metric | Value |
|---|---|
| Precision@5 | ~0.72 |
| Recall@5 | ~0.65 |
| Abstention Accuracy | ~0.87 |
| Citation Validity | ~0.95 |
| Answer Accuracy | ~0.78 |
| Avg Latency | ~3.2s |

## Production Deployment (Render)

### Backend

1. Create a new Web Service on Render pointing to this repo
2. Set Root Directory: `backend`
3. Build Command: `pip install -r requirements.txt`
4. Start Command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
5. Add environment variables (see `render.yaml`):
   - `GROQ_API_KEY`
   - `QDRANT_URL` (your Qdrant Cloud cluster URL)
   - `QDRANT_API_KEY` (your Qdrant Cloud API key)
   - `EVAL_API_KEY` (choose a strong secret)
   - `CORS_ORIGINS` (your frontend URL, e.g. `["https://your-app.vercel.app"]`)

### Qdrant Cloud

1. Sign up at cloud.qdrant.io
2. Create a cluster (free tier available)
3. Copy the cluster URL and API key to Render env vars

### Frontend

Deploy to Vercel or Render static site:
```bash
cd frontend
npm run build
```
Set `NEXT_PUBLIC_API_URL` to your Render backend URL.

## Project Structure

```
agentic-research-assistant/
├── backend/
│   ├── main.py                    # FastAPI app, all endpoints
│   ├── config.py                  # Pydantic-settings, env validation
│   ├── models.py                  # All Pydantic request/response models
│   ├── requirements.txt
│   ├── agent/
│   │   ├── graph.py               # LangGraph state machine
│   │   ├── tools.py               # 5 plain Python tools
│   │   └── state.py               # AgentState TypedDict
│   ├── services/
│   │   ├── qdrant_service.py      # Qdrant CRUD operations
│   │   ├── embeddings.py          # SentenceTransformer wrapper
│   │   ├── ingestion.py           # Document upload pipeline
│   │   └── llm.py                 # Groq client wrapper
│   ├── evals/
│   │   ├── runner.py              # Eval orchestration + CLI
│   │   ├── metrics.py             # Pure metric functions
│   │   └── dataset.json           # 15-case benchmark
│   └── tests/
│       ├── conftest.py
│       ├── test_ingestion.py
│       ├── test_tools.py
│       ├── test_metrics.py
│       └── test_agent_termination.py
├── frontend/
│   ├── src/
│   │   ├── app/                   # Next.js app router
│   │   ├── components/            # UI components
│   │   └── lib/api.ts             # Type-safe API client
│   └── package.json
├── .env.example
├── .gitignore
├── docker-compose.yml
├── render.yaml
└── .github/workflows/test.yml
```

## Security Notes

- API keys loaded via env vars only — never hardcoded or logged
- Retrieved document content is treated as untrusted data (never used as system instructions)
- Eval endpoints protected by `X-Eval-Key` header
- Upload size limits enforced server-side
- CORS allowlist configured via env var
- Rate limiting on /research endpoint (10 req/min per IP)

## Limitations

- Retrieval quality depends on semantic similarity — questions using different terminology from the source documents may not retrieve the right chunks
- Evidence grading and answer verification use the same LLM as answering — a model that hallucinates in one step may fail in another
- The eval dataset (15 cases) is small; real-world precision/recall will vary by document corpus
- In-memory run storage resets on server restart (use a database for production persistence)

## Reproducing Eval Results

```bash
git clone https://github.com/vigasinii/agentic-research-assistant
cd agentic-research-assistant
cp .env.example backend/.env
# Set GROQ_API_KEY in backend/.env
docker-compose up -d
cd backend
pip install -r requirements.txt
# Upload the space exploration docs first (or any PDF/TXT/MD corpus)
python -m evals.runner
cat evals/eval_results.json
```
