"""
Shared pytest fixtures and environment setup.
Sets GROQ_API_KEY before any project imports so config validation passes.
"""

import os

# Must be set before importing any project module that reads settings
os.environ.setdefault("GROQ_API_KEY", "test-key")

import pytest
from unittest.mock import AsyncMock, MagicMock, patch


@pytest.fixture
def mock_llm_service():
    """Patch the llm_service singleton used across agent tools."""
    with patch("services.llm.llm_service") as mock:
        mock.complete = AsyncMock(return_value='{"result": "ok"}')
        mock.chat = AsyncMock(return_value="ok")
        yield mock


@pytest.fixture
def mock_qdrant_service():
    """Patch the qdrant_service singleton."""
    with patch("services.qdrant_service.qdrant_service") as mock:
        mock.search = AsyncMock(return_value=[])
        mock.upsert_chunks = AsyncMock(return_value=None)
        mock.list_documents = AsyncMock(return_value=[])
        mock.delete_document = AsyncMock(return_value=0)
        mock.ensure_collection = AsyncMock(return_value=None)
        mock.document_exists = AsyncMock(return_value=False)
        yield mock


@pytest.fixture
def mock_embedding_service():
    """Patch the embedding_service singleton."""
    with patch("services.embeddings.embedding_service") as mock:
        mock.embed = AsyncMock(return_value=[0.1] * 384)
        mock.embed_batch = AsyncMock(return_value=[[0.1] * 384])
        yield mock
