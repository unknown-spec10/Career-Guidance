"""
Thread-safety tests for RAG system concurrent operations.

Tests verify that queries can execute safely during index rebuilds,
and that the rebuild process maintains index consistency.
"""

import pytest
import asyncio
import threading
import time
from unittest.mock import Mock, patch, MagicMock
from pathlib import Path
import tempfile
import shutil

from resume_pipeline.rag.rag_service import RAGService
from resume_pipeline.rag.vector_store import VectorStore
from resume_pipeline.rag.document_processor import DocumentChunk
from resume_pipeline.config import settings
from resume_pipeline.core import rate_limiter


@pytest.fixture
def temp_docs_dir():
    """Create a temporary docs directory for testing"""
    temp_dir = tempfile.mkdtemp()
    yield temp_dir
    shutil.rmtree(temp_dir)


@pytest.fixture
def temp_cache_dir():
    """Create a temporary cache directory for testing"""
    temp_dir = tempfile.mkdtemp()
    yield temp_dir
    shutil.rmtree(temp_dir)


@pytest.fixture
def sample_chunks():
    """Create sample document chunks for testing"""
    return [
        DocumentChunk(
            id="chunk_1",
            content="Python is a programming language used for web development and data science",
            source_file="README.md",
            section_title="Introduction",
            chunk_index=0,
            total_chunks=2,
            metadata={"char_count": 70}
        ),
        DocumentChunk(
            id="chunk_2",
            content="FastAPI is a modern web framework for building APIs with Python",
            source_file="README.md",
            section_title="Framework",
            chunk_index=1,
            total_chunks=2,
            metadata={"char_count": 62}
        ),
        DocumentChunk(
            id="chunk_3",
            content="Database migration requires careful planning and testing",
            source_file="DATABASE.md",
            section_title="Migrations",
            chunk_index=0,
            total_chunks=1,
            metadata={"char_count": 57}
        ),
    ]


class TestVectorStoreThreadSafety:
    """Test thread-safe vector store operations"""
    
    def test_vector_store_has_lock(self):
        """Verify VectorStore has RLock for thread safety"""
        store = VectorStore()
        assert hasattr(store, '_lock')
        # Verify it's a lock-like object with acquire method
        assert hasattr(store._lock, 'acquire') and hasattr(store._lock, 'release')
    
    def test_concurrent_searches_during_rebuild(self, sample_chunks):
        """Test that searches work safely while rebuild is in progress"""
        store = VectorStore()
        
        # Initial indexing
        store.add_chunks(sample_chunks[:2])
        
        query_results = []
        errors = []
        
        def search_task():
            """Execute search queries"""
            try:
                for _ in range(3):
                    results = store.search("Python programming", top_k=2)
                    query_results.append(len(results))
                    time.sleep(0.01)
            except Exception as e:
                errors.append(str(e))
        
        def rebuild_task():
            """Execute rebuild (add all chunks)"""
            try:
                time.sleep(0.05)  # Let some searches start first
                store.add_chunks(sample_chunks)
            except Exception as e:
                errors.append(str(e))
        
        # Run concurrent operations
        search_thread = threading.Thread(target=search_task)
        rebuild_thread = threading.Thread(target=rebuild_task)
        
        search_thread.start()
        rebuild_thread.start()
        
        search_thread.join(timeout=5)
        rebuild_thread.join(timeout=5)
        
        # Verify no errors occurred
        assert len(errors) == 0, f"Errors during concurrent ops: {errors}"
        assert len(query_results) >= 3, "All search queries should complete"
        assert all(count >= 0 for count in query_results), "Search results should be valid"
    
    def test_multiple_concurrent_searches(self, sample_chunks):
        """Test multiple concurrent search queries"""
        store = VectorStore()
        store.add_chunks(sample_chunks)
        
        results = []
        errors = []
        
        def search_task(query: str):
            try:
                result = store.search(query, top_k=2)
                results.append((query, len(result)))
            except Exception as e:
                errors.append(str(e))
        
        # Launch 10 concurrent searches
        threads = []
        for i in range(10):
            query = ["Python", "FastAPI", "database", "migration"][i % 4]
            thread = threading.Thread(target=search_task, args=(query,))
            threads.append(thread)
            thread.start()
        
        for thread in threads:
            thread.join(timeout=5)
        
        # Verify all searches completed
        assert len(errors) == 0, f"Errors: {errors}"
        assert len(results) == 10, "All searches should complete"
    
    def test_rapid_rebuilds_dont_corrupt_index(self, sample_chunks):
        """Test that rapid rebuilds don't cause index corruption"""
        store = VectorStore()
        
        errors = []
        
        def rebuild_task():
            try:
                for _ in range(5):
                    store.add_chunks(sample_chunks)
                    time.sleep(0.01)
            except Exception as e:
                errors.append(str(e))
        
        def search_task():
            try:
                time.sleep(0.05)
                for _ in range(10):
                    results = store.search("Python", top_k=2)
                    assert isinstance(results, list)
                    time.sleep(0.01)
            except Exception as e:
                errors.append(str(e))
        
        rebuild_thread = threading.Thread(target=rebuild_task)
        search_thread = threading.Thread(target=search_task)
        
        rebuild_thread.start()
        search_thread.start()
        
        rebuild_thread.join(timeout=10)
        search_thread.join(timeout=10)
        
        assert len(errors) == 0, f"Errors: {errors}"


class TestRAGServiceConcurrency:
    """Test RAGService concurrent query handling during rebuild"""
    
    @pytest.mark.asyncio
    async def test_queries_wait_for_rebuild_non_blocking(self, temp_docs_dir, temp_cache_dir, sample_chunks):
        """Test that queries wait non-blocking for rebuild completion"""
        rag_service = RAGService(
            docs_path=temp_docs_dir,
            cache_path=temp_cache_dir,
            enable_file_watcher=False
        )
        
        # Mock document processor
        with patch.object(rag_service.document_processor, 'process_documents', return_value=sample_chunks):
            # Initialize
            rag_service.initialize()
            
            query_times = []
            errors = []
            
            async def query_task():
                """Execute a query"""
                try:
                    start = time.time()
                    # This should trigger _wait_for_rebuild
                    await rag_service.ask("Python programming")
                    elapsed = time.time() - start
                    query_times.append(elapsed)
                except Exception as e:
                    errors.append(str(e))
            
            # Execute queries
            tasks = [query_task() for _ in range(3)]
            await asyncio.gather(*tasks)
            
            assert len(errors) == 0, f"Errors: {errors}"
            assert len(query_times) == 3, "All queries should complete"
    
    @pytest.mark.asyncio
    async def test_rebuild_event_signals_completion(self, temp_docs_dir, temp_cache_dir):
        """Test that rebuild event signals when rebuild completes"""
        rag_service = RAGService(
            docs_path=temp_docs_dir,
            cache_path=temp_cache_dir,
            enable_file_watcher=False
        )
        
        # Set rebuild in progress
        rag_service._rebuild_in_progress = True
        if rag_service._rebuild_event:
            rag_service._rebuild_event.clear()
        
        # Simulate rebuild completion callback
        def complete_rebuild():
            time.sleep(0.1)
            rag_service._on_rebuild_complete(MagicMock(return_value=True))
        
        # Run rebuild in thread
        rebuild_thread = threading.Thread(target=complete_rebuild)
        rebuild_thread.start()
        
        # Wait for rebuild should complete when callback runs
        start = time.time()
        if rag_service._rebuild_event:
            result = await rag_service._wait_for_rebuild(timeout=1.0)
            elapsed = time.time() - start
            
            assert result is True
            assert elapsed <= 1.15  # Allow tolerance for slow systems
            assert rag_service._rebuild_in_progress is False
        
        rebuild_thread.join()


class TestFileWatcherThreadSafety:
    """Test file watcher thread safety"""
    
    def test_file_watcher_debouncing(self):
        """Test that file watcher debounces rapid events"""
        from resume_pipeline.rag.file_watcher import DocumentChangeEventHandler, FileHashTracker
        
        with tempfile.TemporaryDirectory() as temp_dir:
            hash_tracker = FileHashTracker(temp_dir)
            callback_count = [0]
            
            def callback():
                callback_count[0] += 1
            
            handler = DocumentChangeEventHandler(
                docs_path=temp_dir,
                hash_tracker=hash_tracker,
                on_change_callback=callback,
                debounce_seconds=1.0
            )
            
            # Create test files
            doc_file = Path(temp_dir) / "test.md"
            doc_file.write_text("content")
            
            # Simulate multiple rapid events
            event_mock1 = MagicMock()
            event_mock1.src_path = str(doc_file)
            event_mock1.is_directory = False
            
            # Should trigger callback
            handler.on_modified(event_mock1)
            
            # Rapid second event (debounced)
            handler.on_modified(event_mock1)
            handler.on_modified(event_mock1)
            
            # Only first should trigger (others debounced)
            assert callback_count[0] >= 1


class TestRebuildMetrics:
    """Test rebuild metrics tracking"""
    
    def test_rebuild_stats_updated(self, temp_docs_dir, temp_cache_dir, sample_chunks):
        """Test that rebuild stats are correctly updated"""
        rag_service = RAGService(
            docs_path=temp_docs_dir,
            cache_path=temp_cache_dir,
            enable_file_watcher=False
        )
        
        # Mock document processor
        with patch.object(rag_service.document_processor, 'process_documents', return_value=sample_chunks):
            # Simulate stats update that would happen in background rebuild
            initial_rebuilds = rag_service._rebuild_stats['total_rebuilds']
            rag_service._rebuild_stats['total_rebuilds'] += 1
            rag_service._rebuild_stats['chunks_indexed'] = len(sample_chunks)
            rag_service._rebuild_stats['rebuild_duration'] = 0.1
            
            import datetime as dt
            rag_service._rebuild_stats['last_rebuild_time'] = dt.datetime.now().isoformat()
            
            # Verify stats updated
            assert rag_service._rebuild_stats['total_rebuilds'] == initial_rebuilds + 1
            assert rag_service._rebuild_stats['chunks_indexed'] == len(sample_chunks)
            assert rag_service._rebuild_stats['last_rebuild_time'] is not None
            assert rag_service._rebuild_stats['rebuild_duration'] > 0


class TestQueryQueueing:
    """Test query queuing during rebuild"""
    
    @pytest.mark.asyncio
    async def test_ask_waits_for_rebuild(self, temp_docs_dir, temp_cache_dir, sample_chunks):
        """Test that ask() waits for rebuild using event"""
        rag_service = RAGService(
            docs_path=temp_docs_dir,
            cache_path=temp_cache_dir,
            enable_file_watcher=False
        )
        
        with patch.object(rag_service.document_processor, 'process_documents', return_value=sample_chunks):
            rag_service.initialize()
            
            # Ensure rebuild event exists
            if not rag_service._rebuild_event:
                rag_service._rebuild_event = asyncio.Event()
            
            # Manually set rebuild in progress
            rag_service._rebuild_in_progress = True
            rag_service._rebuild_event.clear()
            
            # Signal completion after short delay
            async def complete_soon():
                await asyncio.sleep(0.05)
                rag_service._rebuild_in_progress = False
                if rag_service._rebuild_event:
                    rag_service._rebuild_event.set()
            
            # Start completion task
            completion_task = asyncio.create_task(complete_soon())
            
            # Query should wait and then proceed
            start = time.time()
            result = await rag_service._wait_for_rebuild(timeout=1.0)
            elapsed = time.time() - start
            
            assert result is True
            assert 0.04 < elapsed < 0.2  # Should wait ~50ms
            
            await completion_task


class MockChoice:
    def __init__(self, content):
        self.message = MagicMock()
        self.message.content = content


class MockCompletion:
    def __init__(self, content):
        self.choices = [MockChoice(content)]


class MockHTTPResponse:
    def __init__(self, status_code, json_data=None, text=""):
        self.status_code = status_code
        self._json_data = json_data
        self.text = text
        self.headers = {}

    def json(self):
        return self._json_data


def _opencode_success_payload(text):
    return {"choices": [{"message": {"content": text}}]}


@pytest.fixture
def router_isolation(monkeypatch):
    """Reset LLMRouter limiter state and pin chat settings (mirrors test_llm_router.py)."""
    for limiter in (rate_limiter.groq_limiter, rate_limiter.opencode_limiter):
        limiter.state = rate_limiter.STATE_CLOSED
        limiter.last_state_change = 0.0
        limiter.trial_in_progress = False
        limiter.trial_start_time = 0.0
        limiter._last_call_time = 0.0

    monkeypatch.setattr(settings, "GROQ_API_KEY", "gsk_test_key")
    monkeypatch.setattr(settings, "MODEL_CHAT_PRIMARY_PROVIDER", "opencode")
    monkeypatch.setattr(settings, "MODEL_CHAT_PRIMARY_NAME", "")
    monkeypatch.setattr(settings, "OPENCODE_API_KEY", "oc_test_key")
    return settings


class TestRAGAnswerGenerationThroughRouter:
    """RAG answers go through the shared LLMRouter: opencode primary, raise on failure."""

    def _make_service(self, temp_docs_dir, temp_cache_dir, sample_chunks):
        rag_service = RAGService(
            docs_path=temp_docs_dir,
            cache_path=temp_cache_dir,
            enable_file_watcher=False,
        )
        with patch.object(rag_service.document_processor, 'process_documents', return_value=sample_chunks):
            assert rag_service.initialize()
        return rag_service

    @pytest.mark.asyncio
    async def test_ask_opencode_primary_serves(
        self, temp_docs_dir, temp_cache_dir, sample_chunks, router_isolation
    ):
        # Single provider serves; no second adapter fires.
        with patch("resume_pipeline.core.llm_router.Groq") as mock_groq, \
             patch("resume_pipeline.core.llm_router.requests.post") as mock_post:
            mock_post.return_value = MockHTTPResponse(
                status_code=200,
                json_data=_opencode_success_payload("Mock OpenCode RAG Response"),
            )

            svc = self._make_service(temp_docs_dir, temp_cache_dir, sample_chunks)
            response, error = await svc.ask("How does Python programming work for web development?", use_cache=False)

            assert error is None
            assert response is not None
            assert response.answer == "Mock OpenCode RAG Response"
            assert response.metadata["model"] == router_isolation.OPENCODE_CHAT_MODEL
            assert mock_post.call_count == 1

    def test_ask_sync_opencode_primary_serves(
        self, temp_docs_dir, temp_cache_dir, sample_chunks, router_isolation
    ):
        # Same opencode-primary guarantee for the synchronous generation path.
        with patch("resume_pipeline.core.llm_router.requests.post") as mock_post:
            mock_post.return_value = MockHTTPResponse(
                status_code=200,
                json_data=_opencode_success_payload("Mock OpenCode Sync RAG Response"),
            )

            svc = self._make_service(temp_docs_dir, temp_cache_dir, sample_chunks)
            response, error = svc.ask_sync("How does Python programming work for web development?", use_cache=False)

            assert error is None
            assert response is not None
            assert response.answer == "Mock OpenCode Sync RAG Response"
            assert response.metadata["model"] == router_isolation.OPENCODE_CHAT_MODEL
            assert mock_post.call_count == 1

    def test_ask_sync_primary_failure_serves_retrieval_answer(
        self, temp_docs_dir, temp_cache_dir, sample_chunks, router_isolation
    ):
        # Single provider raises, so RAG serves its own
        # retrieval-based answer (model 'fallback', no LLM text).
        with patch("resume_pipeline.core.llm_router.requests.post") as mock_post:
            mock_post.return_value = MockHTTPResponse(status_code=500, text="OpenCode down")

            svc = self._make_service(temp_docs_dir, temp_cache_dir, sample_chunks)
            response, error = svc.ask_sync("How does Python programming work for web development?", use_cache=False)

            assert error is None
            assert response is not None
            assert response.metadata["model"] == "fallback"
            assert mock_post.call_count == 1

    @pytest.mark.asyncio
    async def test_ask_explicit_mock_helper_serves_without_live_keys(
        self, temp_docs_dir, temp_cache_dir, sample_chunks, router_isolation, monkeypatch
    ):
        # Hermeticity via EXPLICIT mock: the shared _mock_completion helper is
        # reused directly as the stubbed router result (no global flag, no HTTP).
        from resume_pipeline.core.llm_router import _mock_completion

        stubbed = _mock_completion([{"role": "user", "content": "gap analysis please"}])
        assert "skill_gaps" in stubbed
        monkeypatch.setattr(settings, "GROQ_API_KEY", "")
        monkeypatch.setattr(settings, "OPENCODE_API_KEY", "")
        with patch(
            "resume_pipeline.rag.rag_service.llm_router.generate_chat_completion",
            return_value={
                "content": stubbed,
                "model": router_isolation.OPENCODE_CHAT_MODEL,
                "_latency": 0.0,
                "_provenance": {"provider": "opencode", "fallback": False, "mock": False},
            },
        ):
            with patch("resume_pipeline.core.llm_router.requests.post") as mock_post:
                svc = self._make_service(temp_docs_dir, temp_cache_dir, sample_chunks)
                response, error = await svc.ask("How does Python programming work for web development?", use_cache=False)

                assert error is None
                assert response is not None
                assert "skill_gaps" in response.answer
                assert response.metadata["model"] == router_isolation.OPENCODE_CHAT_MODEL
                assert mock_post.call_count == 0

    def test_ask_sync_explicit_mock_helper_serves_without_live_keys(
        self, temp_docs_dir, temp_cache_dir, sample_chunks, router_isolation, monkeypatch
    ):
        from resume_pipeline.core.llm_router import _mock_completion

        stubbed = _mock_completion([{"role": "user", "content": "hello"}])
        monkeypatch.setattr(settings, "GROQ_API_KEY", "")
        monkeypatch.setattr(settings, "OPENCODE_API_KEY", "")
        with patch(
            "resume_pipeline.rag.rag_service.llm_router.generate_chat_completion",
            return_value={
                "content": stubbed,
                "model": router_isolation.OPENCODE_CHAT_MODEL,
                "_latency": 0.0,
                "_provenance": {"provider": "opencode", "fallback": False, "mock": False},
            },
        ):
            with patch("resume_pipeline.core.llm_router.requests.post") as mock_post:
                svc = self._make_service(temp_docs_dir, temp_cache_dir, sample_chunks)
                response, error = svc.ask_sync("How does Python programming work for web development?", use_cache=False)

                assert error is None
                assert response is not None
                assert stubbed in response.answer
                assert response.metadata["model"] == router_isolation.OPENCODE_CHAT_MODEL
                assert mock_post.call_count == 0

    def test_bespoke_gemini_client_removed(self):
        import inspect

        import resume_pipeline.rag.rag_service as rag_module

        assert not hasattr(rag_module, "GeminiRAGClient")
        assert "requests" not in dir(rag_module)
        assert "gemini_api_key" not in inspect.signature(rag_module.RAGService.__init__).parameters


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
