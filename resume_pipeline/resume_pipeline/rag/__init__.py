# RAG (Retrieval Augmented Generation) Module
# Provides intelligent Q&A about the Career Guidance AI application
"""
Components:
- DocumentProcessor: Loads and chunks markdown documentation
- VectorStore: BM25 + TF-IDF hybrid retrieval
- QueryEngine: Query processing, re-ranking, abuse prevention
- RAGService: Main orchestration with Groq API integration
"""

from .document_processor import DocumentProcessor, DocumentChunk
from .vector_store import VectorStore, SearchResult
from .query_engine import QueryEngine, QueryResult
from .rag_service import RAGService, RAGResponse, get_rag_service

__all__ = [
    # Main service
    'RAGService',
    'get_rag_service',
    'RAGResponse',
    
    # Components
    'DocumentProcessor', 
    'DocumentChunk',
    'VectorStore',
    'SearchResult',
    'QueryEngine',
    'QueryResult',
]
