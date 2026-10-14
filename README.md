# Agentic Research Assistant

An agentic Retrieval-Augmented Generation (RAG) application that answers questions from uploaded documents using evidence retrieval, conditional query rewriting, citation verification, and explicit abstention when the available information is insufficient.

Rather than relying on a single retrieve-and-generate step, the system uses **LangGraph** to manage a bounded decision workflow. It checks retrieved evidence before generating an answer and can retry retrieval when the initial results are inadequate.

**Live application:** https://agentic-research-assistant-99ri.vercel.app/

**Architecture diagram:** [View on Excalidraw](https://excalidraw.com/#json=zNOgC_LnYtxj7gu3tKHD4,tWFWUJJend8stjDkvAzccA)

## What I Built

The application allows users to upload documents and ask questions grounded in their contents.

The workflow consists of two main pipelines:

**Document ingestion**

1. Accept PDF, TXT, and Markdown files through the FastAPI backend.
2. Extract text using PyMuPDF for PDFs and Python's standard library for text-based formats.
3. Split extracted text into chunks.
4. Generate embeddings using `sentence-transformers/all-MiniLM-L6-v2`.
5. Store document chunks and vectors in Qdrant for semantic retrieval.

**Research agent**

1. Analyze the user's question to prepare it for retrieval.
2. Retrieve the top five relevant chunks from Qdrant.
3. Grade whether the retrieved evidence is sufficient.
4. If the evidence is insufficient, rewrite the query and retrieve again.
5. Stop after a maximum of three retrieval iterations.
6. Generate an answer grounded in the retrieved evidence.
7. Verify citations against retrieved chunks.
8. Abstain when the available evidence does not support an answer.

The bounded retrieval loop prevents the agent from continuing indefinitely.

## Architecture

```text
                     Next.js Frontend
                            |
                            v
                      FastAPI API
                            |
             +--------------+--------------+
             |                             |
             v                             v
      Document Ingestion              Research Agent
             |                             |
             v                             v
       Text Extraction               Query Analysis
             |                             |
             v                             v
          Chunking                    Qdrant Search
             |                             |
             v                             v
      SentenceTransformers           Evidence Grading
             |                             |
             v                       +-----+------+
       Qdrant Storage                |            |
                                     |            |
                                 Sufficient   Insufficient
                                     |            |
                                     v            v
                               Generate Answer  Rewrite Query
                                     |            |
                                     v            |
                               Verify Citations   |
                                     |            |
                                     v            |
                                Final Response <--+
                               or Abstention
```

The research workflow is orchestrated using LangGraph. Qdrant handles vector retrieval, while Groq provides LLM inference for query analysis, evidence grading, rewriting, answer generation, and verification.

## Technology Stack

| Component | Technology |
|---|---|
| Frontend | Next.js 14, TypeScript, Tailwind CSS |
| Backend | Python 3.11, FastAPI, Pydantic v2 |
| Agent orchestration | LangGraph |
| LLM inference | Groq API |
| Default LLM | `llama-3.1-8b-instant` |
| Embeddings | SentenceTransformers, `all-MiniLM-L6-v2` |
| Vector database | Qdrant |
| PDF extraction | PyMuPDF |
| Testing | pytest, pytest-mock |
| CI | GitHub Actions |
| Frontend hosting | Vercel |
| Backend hosting | Render |
| Production vector storage | Qdrant Cloud |

## Agent Decision Flow

```text
START
  |
  v
Analyze Question
  |
  v
Retrieve Top-5 Chunks
  |
  v
Grade Evidence
  |
  +---- Sufficient ----> Generate Answer
  |                            |
  |                            v
  |                      Verify Citations
  |                            |
  |                            v
  |                      Return Response
  |
  +---- Insufficient
           |
           v
     Retry limit reached?
           |
      +----+----+
      |         |
      No       Yes
      |         |
      v         v
  Rewrite    Abstain
    Query
      |
      v
  Retrieve Again
```

The maximum number of retrieval iterations is configurable and defaults to three.

## API Endpoints

| Endpoint | Purpose |
|---|---|
| `POST /documents/upload` | Upload and ingest a document |
| `POST /research` | Run a document-grounded research query |
| `POST /evals/run` | Execute the evaluation suite |
| `GET /evals/results` | Retrieve evaluation results |

Interactive API documentation is available at `/docs` when the backend is running.

## Evaluation Framework

I built a pytest-based evaluation framework to test both retrieval quality and agent behaviour.

The benchmark contains **15 cases across five scenario types**.

| Scenario | Cases | What it tests |
|---|---:|---|
| Answerable | 3 | Questions clearly supported by the documents |
| Unanswerable | 3 | Questions with no supporting evidence |
| Ambiguous | 3 | Questions with partial or unclear evidence |
| Multi-document | 3 | Questions requiring information from multiple documents |
| Conflicting evidence | 3 | Questions involving contradictory information |
| **Total** | **15** | |

### Metrics

**Precision@K:** Measures the proportion of retrieved chunks considered relevant.

**Recall@K:** Measures the proportion of relevant chunks successfully retrieved.

**Abstention accuracy:** Measures whether the agent correctly answers supported questions and abstains on unsupported ones.

**Citation validity:** Checks whether cited chunk references correspond to evidence actually retrieved.

**Answer accuracy:** Checks generated answers against expected answer keywords in the benchmark.

**Average latency:** Measures end-to-end execution time.

Retrieval relevance is evaluated using deterministic keyword matching against benchmark annotations, rather than an LLM judge.

### Evaluation Results

The repository includes an evaluation runner and benchmark dataset. To obtain reproducible results for a configured environment, run:

```bash
cd backend
python -m evals.runner
```

Results are saved to:

```text
backend/evals/eval_results.json
```

**Note:** I have intentionally not published estimated scores as measured results. Actual evaluation metrics depend on the uploaded document corpus, model configuration, and test execution. The benchmark is currently small and should be expanded before treating its results as representative of production performance.

## Running Locally

### Prerequisites

- Python 3.11+
- Node.js 18+
- Docker and Docker Compose
- Groq API key

### 1. Clone the repository

```bash
git clone https://github.com/vigasinii/agentic-research-assistant.git
cd agentic-research-assistant
```

### 2. Configure environment variables

```bash
cp .env.example backend/.env
```

Add your Groq API key to `backend/.env`:

```env
GROQ_API_KEY=your_groq_api_key
```

Keep `.env` files out of version control.

### 3. Start Qdrant

```bash
docker-compose up -d
```

### 4. Start the backend

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Backend:

```text
http://localhost:8000
```

API documentation:

```text
http://localhost:8000/docs
```

### 5. Start the frontend

Open another terminal:

```bash
cd frontend
npm install
npm run dev
```

Frontend:

```text
http://localhost:3000
```

### 6. Upload a document

```bash
curl -X POST http://localhost:8000/documents/upload \
  -F "file=@your_document.pdf"
```

### 7. Ask a research question

```bash
curl -X POST http://localhost:8000/research \
  -H "Content-Type: application/json" \
  -d '{"question": "What are the main findings in the uploaded document?"}'
```

## Running Tests

```bash
cd backend
pytest
```

The test suite includes coverage for document ingestion, agent tools, evaluation metrics, and agent termination behaviour.

## Security and Reliability

The application includes several controls intended to make agent behaviour more predictable:

- API keys are loaded through environment variables rather than hardcoded.
- Retrieved document text is treated as untrusted input.
- Evaluation endpoints require an API key.
- Document uploads have server-side size limits.
- CORS origins are configurable.
- The research endpoint includes IP-based rate limiting.
- Retrieval retries are bounded to prevent indefinite agent execution.
- The agent can abstain when retrieved evidence is insufficient.

These controls reduce risk but do not eliminate hallucinations, prompt injection, or retrieval errors.



## Project Links

**Live application:** https://agentic-research-assistant-99ri.vercel.app/

**GitHub:** https://github.com/vigasinii/agentic-research-assistant

**Architecture diagram:** https://excalidraw.com/#json=zNOgC_LnYtxj7gu3tKHD4,tWFWUJJend8stjDkvAzccA

---

Built as a practical exploration of agentic RAG systems, with a focus on evidence-grounded answers, explicit decision paths, bounded execution, and measurable evaluation.
