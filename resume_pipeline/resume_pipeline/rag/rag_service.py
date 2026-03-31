"""
RAG Service - Main orchestration layer
Integrates document processing, vector store, query engine, and Gemini API.

Features:
- Automatic document indexing with file watcher
- Query processing with abuse prevention
- Gemini API integration
- Response caching
- Thread-safe concurrent query handling during rebuilds
- Content-based cache invalidation
"""

import os
import json
import time
import hashlib
import requests
import asyncio
import threading
from typing import List, Dict, Any, Optional, Tuple, Callable
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
import logging
from concurrent.futures import ThreadPoolExecutor

from .document_processor import DocumentProcessor, DocumentChunk
from .vector_store import VectorStore
from .query_engine import QueryEngine, QueryResult
from .file_watcher import FileWatcher, get_file_watcher
from ..config import settings

logger = logging.getLogger(__name__)


@dataclass
class RAGResponse:
    """Response from the RAG system"""
    query: str
    answer: str
    sources: List[Dict[str, Any]]
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'query': self.query,
            'answer': self.answer,
            'sources': self.sources,
            'metadata': self.metadata
        }


class GeminiRAGClient:
    """
    Gemini API client for RAG responses.
    Uses the same Gemini API as the resume parser.
    """
    
    MODEL = settings.GEMINI_SMALL_MODEL  # Reuse configured default model
    
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or settings.GEMINI_API_KEY
        self.base_url = settings.GEMINI_API_URL
        if not self.api_key:
            logger.warning("GEMINI_API_KEY not set. RAG responses will use fallback mode.")
    
    async def generate(
        self,
        system_prompt: str,
        user_message: str,
        max_tokens: int = 2048,
        temperature: float = 0.3
    ) -> Tuple[Optional[str], Optional[str]]:
        """
        Generate a response using Gemini API (async wrapper for sync call).
        Returns (response, error).
        """
        # Gemini doesn't have native async, so we call sync version
        return self.generate_sync(system_prompt, user_message, max_tokens, temperature)
    
    def generate_sync(
        self,
        system_prompt: str,
        user_message: str,
        max_tokens: int = 2048,
        temperature: float = 0.3
    ) -> Tuple[Optional[str], Optional[str]]:
        """
        Generate a response using Gemini API.
        Returns (response, error).
        """
        if not self.api_key:
            return None, "Gemini API key not configured"
        
        # Check for mock mode
        if settings.GEMINI_MOCK_MODE:
            return self._mock_response(user_message), None
        
        url = f"{self.base_url}/models/{self.MODEL}:generateContent?key={self.api_key}"
        headers = {"Content-Type": "application/json"}
        
        # Combine system prompt and user message
        full_prompt = f"{system_prompt}\n\n{user_message}"
        
        body = {
            "contents": [{
                "parts": [{
                    "text": full_prompt
                }]
            }],
            "generationConfig": {
                "temperature": temperature,
                "topK": 40,
                "topP": 0.95,
                "maxOutputTokens": max_tokens,
            },
            "safetySettings": [
                {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
                {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
                {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
                {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
            ]
        }
        
        try:
            start = time.time()
            response = requests.post(url, headers=headers, json=body, timeout=60)
            latency = time.time() - start
            
            if response.status_code != 200:
                error_detail = response.text
                logger.error(f"Gemini API error: {response.status_code} - {error_detail}")
                return None, f"API error: {response.status_code}"
            
            result = response.json()
            
            # Extract the generated text from Gemini response
            if 'candidates' in result and len(result['candidates']) > 0:
                candidate = result['candidates'][0]
                if 'content' in candidate and 'parts' in candidate['content']:
                    generated_text = candidate['content']['parts'][0].get('text', '')
                    logger.info(f"Gemini RAG response generated in {latency:.2f}s")
                    return generated_text, None
            
            return None, "No response generated"
            
        except requests.Timeout:
            logger.error("Gemini API timeout")
            return None, "Request timed out. Please try again."
        except Exception as e:
            logger.error(f"Gemini API error: {e}")
            return None, f"An error occurred: {str(e)}"
    
    def _mock_response(self, user_message: str) -> str:
        """Generate a mock response for testing"""
        return f"""Based on the documentation, here's what I found:

This is a **mock response** for testing purposes. The actual Gemini API is not being called.

Your question was about: {user_message[:100]}...

To get real responses, set `GEMINI_MOCK_MODE=false` in your environment.

---
*This is a mock response for development/testing.*"""


class RAGService:
    """
    Main RAG service that orchestrates the entire pipeline.
    
    Features:
    - Automatic document indexing
    - Query processing with abuse prevention
    - Gemini API integration
    - Response caching
    """
    
    # System prompt for the LLM
    SYSTEM_PROMPT = """You are a helpful assistant for the Career Guidance AI application.
Your role is to answer questions about the app based on the provided documentation.

Response Format Guidelines:
1. For longer answers, start with a brief 1-2 sentence summary
2. Use clear bullet points (•) for all lists and key information
3. Keep responses concise and scannable
4. Use bold (**text**) for important terms or headings
5. Include code examples in markdown code blocks when relevant
6. For step-by-step instructions, use numbered lists

Important Rules:
- Only answer based on the provided context
- Do NOT mention or cite source documents, sections, or file names
- Do NOT include phrases like "according to the documentation" or "the docs say"
- Write as if you have direct knowledge of the application
- If the information isn't available, simply say you don't have that information

Keep the tone helpful and direct.
"""
    
    def __init__(
        self,
        docs_path: Optional[str] = None,
        cache_path: Optional[str] = None,
        gemini_api_key: Optional[str] = None,
        enable_file_watcher: bool = True
    ):
        """
        Initialize RAG service.
        
        Args:
            docs_path: Path to documentation folder
            cache_path: Path to store index cache
            gemini_api_key: Gemini API key (uses settings.GEMINI_API_KEY if not provided)
            enable_file_watcher: Whether to enable file watching for auto-rebuild
        """
        # Set paths
        base_path = Path(__file__).parent.parent.parent.parent
        self.docs_path = docs_path or str(base_path / "docs")
        self.cache_path = cache_path or str(base_path / "resume_pipeline" / ".rag_cache")
        
        # Ensure cache directory exists
        Path(self.cache_path).mkdir(parents=True, exist_ok=True)
        
        # Initialize components
        self.document_processor = DocumentProcessor(docs_directory=self.docs_path)
        self.vector_store = VectorStore()
        self.query_engine: Optional[QueryEngine] = None
        self.gemini_client = GeminiRAGClient(gemini_api_key)
        
        # Response cache
        self._response_cache: Dict[str, RAGResponse] = {}
        self._cache_ttl = 3600  # 1 hour
        
        # File watcher for auto-rebuild
        self.file_watcher: Optional[FileWatcher] = None
        self.enable_file_watcher = enable_file_watcher
        
        # Rebuild state management (for concurrent query handling)
        self._rebuild_in_progress = False
        # Create event loop if needed and initialize async event
        try:
            loop = asyncio.get_event_loop()
            self._rebuild_event: Optional[asyncio.Event] = asyncio.Event()
        except RuntimeError:
            # No event loop in this thread - will be created when needed
            self._rebuild_event: Optional[asyncio.Event] = None
        self._rebuild_lock = threading.RLock()
        self._rebuild_executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="rag_rebuild")
        
        # Rebuild metrics
        self._rebuild_stats = {
            'total_rebuilds': 0,
            'last_rebuild_time': None,
            'rebuild_duration': 0,
            'chunks_indexed': 0
        }
        
        # State
        self._is_initialized = False
        self._docs_hash: Optional[str] = None
        self._file_hashes: Dict[str, str] = {}  # Per-file content hashes
    
    def _compute_docs_hash(self) -> str:
        """
        Compute hash of all documentation files for cache invalidation.
        
        Uses content-based MD5 hashing with mtime fallback for robustness.
        Tracks per-file hashes in .rag_cache/file_hashes.json for future delta updates.
        """
        hasher = hashlib.md5()
        docs_path = Path(self.docs_path)
        file_hashes = {}
        
        if docs_path.exists():
            for md_file in sorted(docs_path.glob("*.md")):
                try:
                    # Primary: content-based hash
                    with open(md_file, 'rb') as f:
                        content = f.read()
                        content_hash = hashlib.md5(content).hexdigest()
                        file_hashes[md_file.name] = content_hash
                        hasher.update(md_file.name.encode())
                        hasher.update(content_hash.encode())
                except (IOError, OSError) as e:
                    # Fallback: mtime-based hash if file cannot be read
                    logger.warning(f"Failed to read {md_file} for hashing, using mtime fallback: {e}")
                    try:
                        mtime = md_file.stat().st_mtime
                        mtime_hash = hashlib.md5(str(mtime).encode()).hexdigest()
                        file_hashes[md_file.name] = mtime_hash
                        hasher.update(md_file.name.encode())
                        hasher.update(mtime_hash.encode())
                    except Exception as e2:
                        logger.error(f"Failed to compute fallback hash for {md_file}: {e2}")
        
        # Persist per-file hashes for future incremental indexing support
        self._file_hashes = file_hashes
        self._save_file_hashes()
        
        return hasher.hexdigest()
    
    def _save_file_hashes(self) -> None:
        """Persist per-file hashes to cache for future delta updates"""
        try:
            hash_file = Path(self.cache_path) / "file_hashes.json"
            with open(hash_file, 'w') as f:
                json.dump(self._file_hashes, f, indent=2)
        except Exception as e:
            logger.warning(f"Failed to save file hashes: {e}")
    
    def _load_file_hashes(self) -> Dict[str, str]:
        """Load previously persisted file hashes"""
        try:
            hash_file = Path(self.cache_path) / "file_hashes.json"
            if hash_file.exists():
                with open(hash_file, 'r') as f:
                    return json.load(f)
        except Exception as e:
            logger.warning(f"Failed to load file hashes: {e}")
        return {}
    
    def _load_cached_index(self) -> bool:
        """Try to load cached vector store index"""
        cache_file = Path(self.cache_path) / "vector_store.pkl"
        hash_file = Path(self.cache_path) / "docs_hash.txt"
        
        if not cache_file.exists() or not hash_file.exists():
            return False
        
        # Check if docs have changed
        current_hash = self._compute_docs_hash()
        cached_hash = hash_file.read_text().strip()
        
        if current_hash != cached_hash:
            logger.info("Documentation changed, rebuilding index...")
            return False
        
        try:
            self.vector_store.load(str(cache_file))
            self._docs_hash = current_hash
            logger.info("Loaded cached vector store index")
            return True
        except Exception as e:
            logger.warning(f"Failed to load cached index: {e}")
            return False
    
    def _save_index_cache(self) -> None:
        """Save vector store index to cache"""
        try:
            cache_file = Path(self.cache_path) / "vector_store.pkl"
            hash_file = Path(self.cache_path) / "docs_hash.txt"
            
            self.vector_store.save(str(cache_file))
            hash_file.write_text(self._docs_hash or "")
            
            logger.info("Saved vector store index to cache")
        except Exception as e:
            logger.warning(f"Failed to save index cache: {e}")
    
    def initialize(self, force_rebuild: bool = False) -> bool:
        """
        Initialize the RAG system by loading and indexing documents.
        
        Args:
            force_rebuild: Force rebuilding the index even if cached
            
        Returns:
            True if initialization successful
        """
        if self._is_initialized and not force_rebuild:
            return True
        
        try:
            # Try to load from cache
            if not force_rebuild and self._load_cached_index():
                self.query_engine = QueryEngine(self.vector_store)
                self._is_initialized = True
                return True
            
            # Process documents
            logger.info("Processing documentation...")
            chunks = self.document_processor.process_documents()
            
            if not chunks:
                logger.error("No documents found to index")
                return False
            
            logger.info(f"Processed {len(chunks)} chunks from documentation")
            
            # Build vector store
            logger.info("Building vector store index...")
            self.vector_store.add_chunks(chunks)
            
            # Initialize query engine
            self.query_engine = QueryEngine(self.vector_store)
            
            # Cache the index
            self._docs_hash = self._compute_docs_hash()
            self._save_index_cache()
            
            self._is_initialized = True
            logger.info("RAG system initialized successfully")
            return True
            
        except Exception as e:
            logger.error(f"Failed to initialize RAG system: {e}")
            return False
    
    async def _wait_for_rebuild(self, timeout: float = 30.0) -> bool:
        """
        Wait for any in-progress rebuild to complete.
        
        Non-blocking wait using asyncio.Event.
        Used to pause queries briefly during index rebuild.
        
        Args:
            timeout: Maximum time to wait in seconds
            
        Returns:
            True if rebuild completed, False if timeout
        """
        if not self._rebuild_in_progress:
            return True
        
        try:
            if self._rebuild_event:
                await asyncio.wait_for(self._rebuild_event.wait(), timeout=timeout)
            return True
        except asyncio.TimeoutError:
            logger.warning(f"Query timed out waiting for rebuild (timeout={timeout}s)")
            return False
        except Exception as e:
            logger.error(f"Error waiting for rebuild: {e}")
            return True  # Continue anyway
    
    def _trigger_rebuild_if_needed(self) -> None:
        """
        Check if documents have changed and trigger rebuild if needed.
        
        Called by file watcher when changes detected.
        Offloads rebuild to background thread to avoid blocking queries.
        """
        with self._rebuild_lock:
            if self._rebuild_in_progress:
                logger.debug("Rebuild already in progress, skipping")
                return
            
            self._rebuild_in_progress = True
        
        # Clear the rebuild event so queries will wait
        if self._rebuild_event:
            self._rebuild_event.clear()
        
        # Offload to background executor
        future = self._rebuild_executor.submit(self._rebuild_index_sync)
        future.add_done_callback(self._on_rebuild_complete)
    
    def _rebuild_index_sync(self) -> bool:
        """
        Synchronous index rebuild (runs in background thread).
        
        Returns:
            True if rebuild succeeded
        """
        start_time = time.time()
        logger.info("Starting background index rebuild...")
        
        try:
            # Process documents
            chunks = self.document_processor.process_documents()
            
            if not chunks:
                logger.error("No documents found during rebuild")
                return False
            
            logger.info(f"Processed {len(chunks)} chunks during rebuild")
            
            # Rebuild vector store with lock protection
            with self._rebuild_lock:
                self.vector_store.add_chunks(chunks)
                self._rebuild_stats['chunks_indexed'] = len(chunks)
            
            # Update hash and cache
            self._docs_hash = self._compute_docs_hash()
            self._save_index_cache()
            
            duration = time.time() - start_time
            self._rebuild_stats['last_rebuild_time'] = datetime.now().isoformat()
            self._rebuild_stats['rebuild_duration'] = duration
            self._rebuild_stats['total_rebuilds'] += 1
            
            logger.info(f"Index rebuild completed in {duration:.2f}s")
            return True
            
        except Exception as e:
            logger.error(f"Error during index rebuild: {e}")
            return False
    
    def _on_rebuild_complete(self, future) -> None:
        """
        Callback when rebuild task completes.
        Signals waiting queries to resume.
        """
        with self._rebuild_lock:
            self._rebuild_in_progress = False
        
        try:
            success = future.result()
            if success:
                logger.info("Index rebuild completed successfully")
            else:
                logger.warning("Index rebuild completed with errors")
        except Exception as e:
            logger.error(f"Rebuild task failed: {e}")
        
        # Signal waiting queries
        if self._rebuild_event:
            self._rebuild_event.set()
    
    def _get_cache_key(self, query: str) -> str:
        """Generate cache key for a query"""
        return hashlib.md5(query.lower().strip().encode()).hexdigest()
    
    def _get_cached_response(self, query: str) -> Optional[RAGResponse]:
        """Get cached response if available and not expired"""
        cache_key = self._get_cache_key(query)
        
        if cache_key in self._response_cache:
            cached = self._response_cache[cache_key]
            cached_time = cached.metadata.get('cached_at', 0)
            
            if time.time() - cached_time < self._cache_ttl:
                return cached
            else:
                del self._response_cache[cache_key]
        
        return None
    
    def _cache_response(self, query: str, response: RAGResponse) -> None:
        """Cache a response"""
        cache_key = self._get_cache_key(query)
        response.metadata['cached_at'] = time.time()
        self._response_cache[cache_key] = response
        
        # Limit cache size
        if len(self._response_cache) > 100:
            # Remove oldest entries
            sorted_keys = sorted(
                self._response_cache.keys(),
                key=lambda k: self._response_cache[k].metadata.get('cached_at', 0)
            )
            for key in sorted_keys[:20]:
                del self._response_cache[key]
    
    def start_file_watcher(self) -> bool:
        """
        Start monitoring documentation for changes.
        
        Initializes FileWatcher if enabled. Safe to call multiple times.
        
        Returns:
            True if watcher started successfully or already running
        """
        if not self.enable_file_watcher:
            logger.debug("File watcher disabled")
            return True
        
        if self.file_watcher and self.file_watcher._is_running:
            logger.debug("File watcher already running")
            return True
        
        try:
            if not self.file_watcher:
                self.file_watcher = FileWatcher(
                    docs_path=self.docs_path,
                    cache_path=self.cache_path,
                    on_change_callback=self._trigger_rebuild_if_needed,
                    debounce_seconds=2.0
                )
            
            started = self.file_watcher.start()
            if started:
                logger.info("Documentation file watcher started")
            else:
                logger.warning("Failed to start file watcher (watchdog may not be installed)")
            
            return started
            
        except Exception as e:
            logger.error(f"Error starting file watcher: {e}")
            return False
    
    def stop_file_watcher(self) -> None:
        """
        Stop monitoring documentation for changes.
        
        Called during graceful shutdown. Safe to call multiple times.
        """
        if not self.file_watcher:
            return
        
        try:
            self.file_watcher.stop()
            logger.info("Documentation file watcher stopped")
        except Exception as e:
            logger.error(f"Error stopping file watcher: {e}")
    
    def get_file_watcher_stats(self) -> Dict[str, Any]:
        """Get file watcher statistics"""
        if not self.file_watcher:
            return {
                'is_running': False,
                'enabled': self.enable_file_watcher,
                'reason': 'File watcher not initialized'
            }
        
        return self.file_watcher.get_stats()
    
    async def ask(
        self,
        query: str,
        user_id: str = "anonymous",
        use_cache: bool = True
    ) -> Tuple[Optional[RAGResponse], Optional[str]]:
        """
        Ask a question and get an answer.
        
        Waits briefly for any in-progress rebuild before processing query.
        Non-blocking: if rebuild takes too long, query proceeds anyway.
        
        Args:
            query: User's question
            user_id: User identifier for rate limiting
            use_cache: Whether to use response cache
            
        Returns:
            Tuple of (RAGResponse, error_message)
        """
        # Wait for any in-progress rebuild (non-blocking, 30s timeout)
        await self._wait_for_rebuild(timeout=30.0)
        
        # Ensure initialized
        if not self._is_initialized:
            if not self.initialize():
                return None, "RAG system is not available. Please try again later."
        
        # Check cache
        if use_cache:
            cached = self._get_cached_response(query)
            if cached:
                logger.info(f"Cache hit for query: {query[:50]}...")
                cached.metadata['from_cache'] = True
                return cached, None
        
        # Process query through engine
        if not self.query_engine:
            return None, "Query engine not initialized"
        
        query_result, error = self.query_engine.process_query(
            query=query,
            user_id=user_id,
            top_k=5
        )
        
        if error or query_result is None:
            return None, error or "Failed to process query"
        
        # Generate answer using Gemini
        user_message = f"""Based on the following documentation context, answer this question:

Question: {query}

Context:
{query_result.context}

Answer the question based only on the provided context. If the answer isn't available in the context, say so clearly."""
        
        answer, gemini_error = await self.gemini_client.generate(
            system_prompt=self.SYSTEM_PROMPT,
            user_message=user_message,
            max_tokens=2048,
            temperature=0.3
        )
        
        if gemini_error or answer is None:
            # Fallback: Return context as answer
            answer = self._generate_fallback_answer(query, query_result)
        
        # Build sources list
        sources = []
        for result in query_result.relevant_chunks[:3]:
            sources.append({
                'file': result.chunk.source_file,
                'section': result.chunk.section_title,
                'relevance': round(result.score, 2),
                'preview': result.chunk.content[:150] + "..." if len(result.chunk.content) > 150 else result.chunk.content
            })
        
        # Build response
        response = RAGResponse(
            query=query,
            answer=answer,
            sources=sources,
            metadata={
                'chunks_used': len(query_result.relevant_chunks),
                'model': self.gemini_client.MODEL if not gemini_error else 'fallback',
                'timestamp': datetime.now().isoformat(),
                'from_cache': False
            }
        )
        
        # Cache response
        if use_cache:
            self._cache_response(query, response)
        
        return response, None
    
    def ask_sync(
        self,
        query: str,
        user_id: str = "anonymous",
        use_cache: bool = True
    ) -> Tuple[Optional[RAGResponse], Optional[str]]:
        """
        Synchronous version of ask().
        """
        # Ensure initialized
        if not self._is_initialized:
            if not self.initialize():
                return None, "RAG system is not available. Please try again later."
        
        # Check cache
        if use_cache:
            cached = self._get_cached_response(query)
            if cached:
                logger.info(f"Cache hit for query: {query[:50]}...")
                cached.metadata['from_cache'] = True
                return cached, None
        
        # Process query through engine
        if not self.query_engine:
            return None, "Query engine not initialized"
        
        query_result, error = self.query_engine.process_query(
            query=query,
            user_id=user_id,
            top_k=5
        )
        
        if error or query_result is None:
            return None, error or "Failed to process query"
        
        # Generate answer using Gemini
        user_message = f"""Based on the following documentation context, answer this question:

Question: {query}

Context:
{query_result.context}

Answer the question based only on the provided context. If the answer isn't available in the context, say so clearly."""
        
        answer, gemini_error = self.gemini_client.generate_sync(
            system_prompt=self.SYSTEM_PROMPT,
            user_message=user_message,
            max_tokens=2048,
            temperature=0.3
        )
        
        if gemini_error or answer is None:
            # Fallback: Return context as answer
            answer = self._generate_fallback_answer(query, query_result)
        
        # Build sources list
        sources = []
        for result in query_result.relevant_chunks[:3]:
            sources.append({
                'file': result.chunk.source_file,
                'section': result.chunk.section_title,
                'relevance': round(result.score, 2),
                'preview': result.chunk.content[:150] + "..." if len(result.chunk.content) > 150 else result.chunk.content
            })
        
        # Build response
        response = RAGResponse(
            query=query,
            answer=answer,
            sources=sources,
            metadata={
                'chunks_used': len(query_result.relevant_chunks),
                'model': self.gemini_client.MODEL if not gemini_error else 'fallback',
                'timestamp': datetime.now().isoformat(),
                'from_cache': False
            }
        )
        
        # Cache response
        if use_cache:
            self._cache_response(query, response)
        
        return response, None
    
    def _generate_fallback_answer(self, query: str, query_result: QueryResult) -> str:
        """Generate a fallback answer when Gemini API is unavailable"""
        if not query_result.relevant_chunks:
            return "I couldn't find relevant information for your question."
        
        # Use top result as answer
        top_result = query_result.relevant_chunks[0]
        
        return f"""Based on the documentation, here's what I found:

**From {top_result.chunk.source_file} > {top_result.chunk.section_title}:**

{top_result.chunk.content}

---
*Note: This is a direct excerpt from the documentation. For a more detailed answer, please try again later.*"""
    
    def get_suggested_questions(self) -> List[str]:
        """Get suggested questions for users"""
        if self.query_engine:
            return self.query_engine.get_suggested_questions()
        
        return [
            "How do I set up the app locally?",
            "What is the dual-database architecture?",
            "How do I deploy to Google Cloud?",
            "What are the main features?",
        ]
    
    def get_stats(self) -> Dict[str, Any]:
        """Get RAG system statistics"""
        return {
            'is_initialized': self._is_initialized,
            'docs_path': self.docs_path,
            'total_chunks': len(self.vector_store.chunks) if self._is_initialized else 0,
            'cache_size': len(self._response_cache),
            'gemini_configured': bool(self.gemini_client.api_key),
            'model': self.gemini_client.MODEL
        }


# Singleton instance
_rag_service: Optional[RAGService] = None


def get_rag_service() -> RAGService:
    """Get or create the singleton RAG service instance"""
    global _rag_service
    
    if _rag_service is None:
        _rag_service = RAGService()
    
    return _rag_service
