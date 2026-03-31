"""
Query Engine for RAG System
Handles query processing, re-ranking, and context preparation.
Implements abuse prevention and rate limiting.
"""

import re
import time
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass, field
from collections import defaultdict
from datetime import datetime, timedelta
import logging

from .vector_store import VectorStore, SearchResult
from .document_processor import DocumentChunk

logger = logging.getLogger(__name__)


@dataclass
class QueryResult:
    """Represents the final query result with context"""
    query: str
    relevant_chunks: List[SearchResult]
    context: str
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'query': self.query,
            'relevant_chunks': [r.to_dict() for r in self.relevant_chunks],
            'context': self.context,
            'metadata': self.metadata
        }


@dataclass
class RateLimitInfo:
    """Track rate limit information for a user"""
    request_count: int = 0
    last_request: float = 0.0
    blocked_until: float = 0.0
    warning_count: int = 0


class QueryEngine:
    """
    Query engine with re-ranking, abuse prevention, and context preparation.
    
    Features:
    - Query validation and sanitization
    - Off-topic detection
    - Rate limiting
    - Spam prevention
    - Re-ranking with cross-encoder simulation
    - Context assembly for LLM
    """
    
    # Rate limiting settings
    MAX_REQUESTS_PER_MINUTE = 10
    MAX_REQUESTS_PER_HOUR = 50
    COOLDOWN_SECONDS = 60
    BLOCK_DURATION_SECONDS = 300  # 5 minutes
    
    # Query constraints
    MIN_QUERY_LENGTH = 3
    MAX_QUERY_LENGTH = 500
    MIN_WORD_COUNT = 1
    MAX_WORD_COUNT = 100
    
    # App-related keywords for relevance detection
    APP_KEYWORDS = {
        # Core features
        'resume', 'career', 'guidance', 'recommendation', 'job',
        'applicant', 'profile', 'skills', 'interview', 'credit', 'parse',
        
        # Technical
        'api', 'endpoint', 'database', 'postgresql', 'backend',
        'frontend', 'react', 'fastapi', 'python', 'deploy', 'cloud',
        'authentication', 'login', 'register', 'token', 'jwt',
        
        # Operations
        'setup', 'install', 'configure', 'run', 'start', 'build', 'test',
        'upload', 'parse', 'recommend', 'generate', 'create', 'update',
        
        # App-specific
        'gemini', 'groq', 'ai', 'llm', 'embedding', 'vector', 'rag',
        'repository', 'pattern', 'dual', 'scoring', 'ranking',
        
        # Documentation
        'documentation', 'guide', 'tutorial', 'how', 'what', 'why',
        'architecture', 'deployment', 'implementation',
        
        # Troubleshooting
        'error', 'issue', 'problem', 'fix', 'debug', 'troubleshoot',
        'not working', 'failed', 'help',
        
        # Cost & billing
        'cost', 'price', 'free', 'billing', 'budget', 'tier',
        
        # This app
        'app', 'application', 'system', 'platform', 'service',
    }
    
    # Offensive/inappropriate patterns
    BLOCKED_PATTERNS = [
        r'\b(hack|exploit|inject|bypass)\b',
        r'\b(password|secret|key)\s+(is|are|for)',
        r'(drop\s+table|delete\s+from)',
        r'\b(xxx|porn|nude|sex)\b',
    ]
    
    def __init__(self, vector_store: VectorStore):
        self.vector_store = vector_store
        self.rate_limits: Dict[str, RateLimitInfo] = defaultdict(RateLimitInfo)
        self._blocked_patterns = [re.compile(p, re.IGNORECASE) for p in self.BLOCKED_PATTERNS]
    
    def _sanitize_query(self, query: str) -> str:
        """Sanitize and normalize the query"""
        # Strip whitespace
        query = query.strip()
        
        # Remove excessive whitespace
        query = re.sub(r'\s+', ' ', query)
        
        # Remove special characters that could be injection attempts
        query = re.sub(r'[<>{}[\]\\]', '', query)
        
        return query
    
    def _validate_query(self, query: str) -> Tuple[bool, str]:
        """
        Validate query against constraints.
        Returns (is_valid, error_message).
        """
        # Length checks
        if len(query) < self.MIN_QUERY_LENGTH:
            return False, "Query is too short. Please ask a more specific question."
        
        if len(query) > self.MAX_QUERY_LENGTH:
            return False, f"Query is too long. Maximum {self.MAX_QUERY_LENGTH} characters allowed."
        
        # Word count checks
        words = query.split()
        if len(words) < self.MIN_WORD_COUNT:
            return False, "Please provide a more detailed question."
        
        if len(words) > self.MAX_WORD_COUNT:
            return False, f"Query has too many words. Maximum {self.MAX_WORD_COUNT} words allowed."
        
        # Check for blocked patterns
        for pattern in self._blocked_patterns:
            if pattern.search(query):
                return False, "Your query contains inappropriate content. Please rephrase."
        
        return True, ""
    
    def _is_off_topic(self, query: str) -> Tuple[bool, float]:
        """
        Detect if query is off-topic (not related to the app).
        Returns (is_off_topic, relevance_score).
        """
        query_lower = query.lower()
        words = set(re.findall(r'\b\w+\b', query_lower))
        
        # Count matching keywords
        matching_keywords = words.intersection(self.APP_KEYWORDS)
        
        # Calculate relevance score
        if not words:
            return True, 0.0
        
        relevance_score = len(matching_keywords) / min(len(words), 10)
        
        # Check for common question patterns about the app
        app_patterns = [
            r'\b(how|what|why|when|where|can|does|is)\b.*\b(app|system|api|database|deploy|setup|install|configure|work|use)\b',
            r'\b(help|guide|tutorial|documentation)\b',
            r'\b(error|issue|problem|fix)\b',
            r'\b(cost|price|free|billing)\b',
        ]
        
        for pattern in app_patterns:
            if re.search(pattern, query_lower):
                relevance_score += 0.3
        
        # Threshold for off-topic detection
        is_off_topic = relevance_score < 0.1
        
        return is_off_topic, min(relevance_score, 1.0)
    
    def _check_rate_limit(self, user_id: str) -> Tuple[bool, str]:
        """
        Check if user has exceeded rate limits.
        Returns (is_allowed, error_message).
        """
        current_time = time.time()
        rate_info = self.rate_limits[user_id]
        
        # Check if user is blocked
        if current_time < rate_info.blocked_until:
            remaining = int(rate_info.blocked_until - current_time)
            return False, f"Too many requests. Please wait {remaining} seconds before trying again."
        
        # Check per-minute rate limit
        if current_time - rate_info.last_request < 60:
            if rate_info.request_count >= self.MAX_REQUESTS_PER_MINUTE:
                # Increment warning count
                rate_info.warning_count += 1
                
                # Block user if too many warnings
                if rate_info.warning_count >= 3:
                    rate_info.blocked_until = current_time + self.BLOCK_DURATION_SECONDS
                    return False, f"You've been temporarily blocked for {self.BLOCK_DURATION_SECONDS // 60} minutes due to excessive requests."
                
                return False, f"Rate limit exceeded. Please wait {self.COOLDOWN_SECONDS} seconds. Warning {rate_info.warning_count}/3."
        else:
            # Reset per-minute counter
            rate_info.request_count = 0
        
        return True, ""
    
    def _update_rate_limit(self, user_id: str) -> None:
        """Update rate limit counters after a successful request"""
        current_time = time.time()
        rate_info = self.rate_limits[user_id]
        
        rate_info.request_count += 1
        rate_info.last_request = current_time
    
    def _rerank_results(
        self,
        query: str,
        results: List[SearchResult],
        boost_recent: bool = True
    ) -> List[SearchResult]:
        """
        Re-rank search results using additional signals.
        Simulates cross-encoder re-ranking without heavy ML models.
        """
        query_lower = query.lower()
        query_words = set(query_lower.split())
        
        reranked = []
        for result in results:
            chunk = result.chunk
            content_lower = chunk.content.lower()
            
            # Start with original score
            new_score = result.score
            
            # Boost 1: Exact phrase match
            if query_lower in content_lower:
                new_score *= 1.5
            
            # Boost 2: Title/header relevance
            if any(word in chunk.section_title.lower() for word in query_words):
                new_score *= 1.3
            
            # Boost 3: Query terms in first 100 chars
            first_part = content_lower[:100]
            term_density = sum(1 for word in query_words if word in first_part)
            new_score *= (1 + term_density * 0.1)
            
            # Boost 4: Code examples (useful for technical questions)
            if chunk.metadata.get('has_code') and any(
                kw in query_lower for kw in ['how', 'example', 'code', 'command', 'run']
            ):
                new_score *= 1.2
            
            # Boost 5: Source file relevance
            file_relevance = {
                'DEPLOYMENT.md': ['deploy', 'setup', 'install', 'configure', 'run'],
                'DATABASE.md': ['database', 'mysql', 'firestore', 'query', 'table'],
                'ARCHITECTURE.md': ['architecture', 'design', 'pattern', 'cost', 'flow'],
                'IMPLEMENTATION_GUIDE.md': ['implement', 'code', 'add', 'create', 'feature'],
                'QUICK_REFERENCE.md': ['command', 'quick', 'reference', 'api'],
                'README.md': ['start', 'overview', 'feature', 'what'],
            }
            
            for file, keywords in file_relevance.items():
                if file in chunk.source_file:
                    if any(kw in query_lower for kw in keywords):
                        new_score *= 1.25
                    break
            
            reranked.append(SearchResult(
                chunk=chunk,
                score=new_score,
                bm25_score=result.bm25_score,
                semantic_score=result.semantic_score
            ))
        
        # Sort by new score
        reranked.sort(key=lambda r: r.score, reverse=True)
        
        return reranked
    
    def _deduplicate_results(self, results: List[SearchResult]) -> List[SearchResult]:
        """Remove near-duplicate results"""
        if len(results) <= 1:
            return results
        
        unique_results = [results[0]]
        
        for result in results[1:]:
            is_duplicate = False
            
            for unique in unique_results:
                # Check if from same section in same file
                if (result.chunk.source_file == unique.chunk.source_file and
                    result.chunk.section_title == unique.chunk.section_title):
                    # Keep only the higher-scored chunk from same section
                    is_duplicate = True
                    break
            
            if not is_duplicate:
                unique_results.append(result)
        
        return unique_results
    
    def _assemble_context(
        self,
        query: str,
        results: List[SearchResult],
        max_context_length: int = 4000
    ) -> str:
        """
        Assemble context from search results for LLM.
        Includes source attribution and structured formatting.
        """
        if not results:
            return ""
        
        context_parts = []
        total_length = 0
        
        for i, result in enumerate(results, 1):
            chunk = result.chunk
            
            # Format chunk with source attribution
            chunk_text = f"""
---
Source: {chunk.source_file} > {chunk.section_title}
Relevance: {result.score:.2f}

{chunk.content}
---"""
            
            # Check length limit
            chunk_length = len(chunk_text)
            if total_length + chunk_length > max_context_length:
                # Try to fit a truncated version
                remaining = max_context_length - total_length - 100
                if remaining > 200:
                    truncated = chunk.content[:remaining] + "..."
                    chunk_text = f"""
---
Source: {chunk.source_file} > {chunk.section_title}
Relevance: {result.score:.2f}

{truncated}
---"""
                    context_parts.append(chunk_text)
                break
            
            context_parts.append(chunk_text)
            total_length += chunk_length
        
        return '\n'.join(context_parts)
    
    def process_query(
        self,
        query: str,
        user_id: str = "anonymous",
        top_k: int = 5,
        expand_query: bool = True,
        check_rate_limit: bool = True
    ) -> Tuple[Optional[QueryResult], Optional[str]]:
        """
        Process a user query through the full pipeline.
        
        Args:
            query: User's question
            user_id: User identifier for rate limiting
            top_k: Number of chunks to retrieve
            expand_query: Whether to expand query with synonyms
            check_rate_limit: Whether to apply rate limiting
            
        Returns:
            Tuple of (QueryResult, error_message)
            If successful, error_message is None
            If failed, QueryResult is None
        """
        # 1. Rate limiting
        if check_rate_limit:
            is_allowed, error = self._check_rate_limit(user_id)
            if not is_allowed:
                return None, error
        
        # 2. Sanitize query
        query = self._sanitize_query(query)
        
        # 3. Validate query
        is_valid, error = self._validate_query(query)
        if not is_valid:
            return None, error
        
        # 4. Check for off-topic queries
        is_off_topic, relevance_score = self._is_off_topic(query)
        if is_off_topic:
            return None, "This question doesn't seem to be about the Career Guidance AI app. Please ask questions about the app's features, setup, or usage."
        
        # 5. Expand query for better recall
        search_query = query
        if expand_query:
            search_query = self.vector_store.expand_query(query)
        
        # 6. Search vector store
        results = self.vector_store.search(search_query, top_k=top_k * 2)
        
        if not results:
            return None, "I couldn't find relevant information for your question. Try rephrasing or ask about specific features."
        
        # 7. Re-rank results
        results = self._rerank_results(query, results)
        
        # 8. Deduplicate
        results = self._deduplicate_results(results)[:top_k]
        
        # 9. Assemble context
        context = self._assemble_context(query, results)
        
        # 10. Update rate limit
        if check_rate_limit:
            self._update_rate_limit(user_id)
        
        # Build result
        result = QueryResult(
            query=query,
            relevant_chunks=results,
            context=context,
            metadata={
                'relevance_score': relevance_score,
                'chunks_retrieved': len(results),
                'query_expanded': search_query if expand_query else None,
                'timestamp': datetime.now().isoformat()
            }
        )
        
        return result, None
    
    def get_suggested_questions(self) -> List[str]:
        """Get list of suggested questions for users"""
        return [
            "How do I set up the app locally?",
            "What is the dual-database architecture?",
            "How do I deploy to Google Cloud?",
            "What are the costs of running this app?",
            "How does the recommendation scoring work?",
            "How do I add a new API endpoint?",
            "What database tables are available?",
            "How does the credit system work?",
        ]
    
    def get_rate_limit_status(self, user_id: str) -> Dict[str, Any]:
        """Get rate limit status for a user"""
        rate_info = self.rate_limits.get(user_id, RateLimitInfo())
        current_time = time.time()
        
        return {
            'requests_this_minute': rate_info.request_count,
            'max_per_minute': self.MAX_REQUESTS_PER_MINUTE,
            'is_blocked': current_time < rate_info.blocked_until,
            'blocked_until': datetime.fromtimestamp(rate_info.blocked_until).isoformat() if rate_info.blocked_until > current_time else None,
            'warning_count': rate_info.warning_count
        }
