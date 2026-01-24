"""
Vector Store for RAG System
Implements efficient similarity search using TF-IDF and BM25 ranking.
No external vector database required - uses in-memory computation.
Thread-safe with RLock protection for concurrent query handling during rebuilds.
"""

import math
import re
import threading
from typing import List, Dict, Any, Optional, Tuple
from collections import defaultdict
from dataclasses import dataclass
import logging
import pickle
from pathlib import Path

from .document_processor import DocumentChunk

logger = logging.getLogger(__name__)


@dataclass
class SearchResult:
    """Represents a search result with relevance score"""
    chunk: DocumentChunk
    score: float
    bm25_score: float
    semantic_score: float
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'chunk': self.chunk.to_dict(),
            'score': self.score,
            'bm25_score': self.bm25_score,
            'semantic_score': self.semantic_score
        }


class VectorStore:
    """
    In-memory vector store using BM25 and TF-IDF for efficient retrieval.
    
    Features:
    - BM25 ranking (industry standard for text retrieval)
    - TF-IDF semantic scoring
    - Query expansion
    - Hybrid scoring (BM25 + semantic)
    - Persistence support
    - Thread-safe with RLock for concurrent query handling during index rebuilds
    """
    
    # BM25 parameters
    K1 = 1.5  # Term frequency saturation
    B = 0.75  # Length normalization
    
    def __init__(self, cache_path: Optional[str] = None):
        self.chunks: List[DocumentChunk] = []
        self.chunk_index: Dict[str, DocumentChunk] = {}
        
        # Inverted index: term -> [(chunk_id, term_frequency), ...]
        self.inverted_index: Dict[str, List[Tuple[str, int]]] = defaultdict(list)
        
        # Document frequency: term -> number of docs containing term
        self.doc_frequency: Dict[str, int] = defaultdict(int)
        
        # Document lengths (in terms)
        self.doc_lengths: Dict[str, int] = {}
        self.avg_doc_length: float = 0.0
        
        # TF-IDF vectors (for semantic similarity)
        self.tfidf_vectors: Dict[str, Dict[str, float]] = {}
        
        # Cache path for persistence
        self.cache_path = cache_path
        
        # Thread safety: RLock allows reentrant locking for concurrent queries
        self._lock = threading.RLock()
        
        # Stopwords for better indexing
        self.stopwords = {
            'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
            'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
            'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
            'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need',
            'this', 'that', 'these', 'those', 'it', 'its', 'they', 'them',
            'what', 'which', 'who', 'whom', 'when', 'where', 'why', 'how',
            'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other',
            'some', 'such', 'no', 'not', 'only', 'own', 'same', 'so', 'than',
            'too', 'very', 'just', 'also', 'now', 'here', 'there', 'then',
        }
    
    def _tokenize(self, text: str) -> List[str]:
        """Tokenize and normalize text"""
        # Convert to lowercase
        text = text.lower()
        
        # Extract words (including hyphenated words)
        words = re.findall(r'\b[a-z][a-z0-9_-]*[a-z0-9]\b|\b[a-z]\b', text)
        
        # Remove stopwords and short words
        words = [w for w in words if w not in self.stopwords and len(w) > 1]
        
        return words
    
    def _compute_term_frequencies(self, tokens: List[str]) -> Dict[str, int]:
        """Compute term frequencies for a token list"""
        tf = defaultdict(int)
        for token in tokens:
            tf[token] += 1
        return dict(tf)
    
    def add_chunks(self, chunks: List[DocumentChunk]) -> None:
        """
        Add chunks to the vector store and build indices.
        Thread-safe: acquires write lock during rebuild.
        """
        with self._lock:
            self.chunks = chunks
            self.chunk_index = {chunk.id: chunk for chunk in chunks}
            
            # Reset indices
            self.inverted_index = defaultdict(list)
            self.doc_frequency = defaultdict(int)
            self.doc_lengths = {}
            self.tfidf_vectors = {}
            
            total_length = 0
            
            # Build inverted index
            for chunk in chunks:
                tokens = self._tokenize(chunk.content)
                term_freq = self._compute_term_frequencies(tokens)
                
                self.doc_lengths[chunk.id] = len(tokens)
                total_length += len(tokens)
                
                # Update inverted index and document frequency
                for term, freq in term_freq.items():
                    self.inverted_index[term].append((chunk.id, freq))
                    self.doc_frequency[term] += 1
            
            # Compute average document length
            self.avg_doc_length = total_length / len(chunks) if chunks else 0
            
            # Compute TF-IDF vectors for semantic similarity
            self._compute_tfidf_vectors()
            
            logger.info(f"Indexed {len(chunks)} chunks with {len(self.inverted_index)} unique terms")
    
    def _compute_tfidf_vectors(self) -> None:
        """Compute TF-IDF vectors for all chunks"""
        n_docs = len(self.chunks)
        
        for chunk in self.chunks:
            tokens = self._tokenize(chunk.content)
            term_freq = self._compute_term_frequencies(tokens)
            
            tfidf = {}
            doc_length = len(tokens)
            
            for term, tf in term_freq.items():
                # TF: log-normalized term frequency
                tf_score = 1 + math.log(tf) if tf > 0 else 0
                
                # IDF: inverse document frequency with smoothing
                df = self.doc_frequency.get(term, 0)
                idf = math.log((n_docs + 1) / (df + 1)) + 1
                
                tfidf[term] = tf_score * idf
            
            # Normalize vector
            magnitude = math.sqrt(sum(v ** 2 for v in tfidf.values()))
            if magnitude > 0:
                tfidf = {k: v / magnitude for k, v in tfidf.items()}
            
            self.tfidf_vectors[chunk.id] = tfidf
    
    def _bm25_score(self, query_tokens: List[str], chunk_id: str) -> float:
        """
        Compute BM25 score for a query against a chunk.
        BM25 is the industry standard for lexical retrieval.
        """
        score = 0.0
        n_docs = len(self.chunks)
        doc_length = self.doc_lengths.get(chunk_id, 0)
        
        if doc_length == 0:
            return 0.0
        
        for token in query_tokens:
            if token not in self.inverted_index:
                continue
            
            # Find term frequency in this document
            tf = 0
            for cid, freq in self.inverted_index[token]:
                if cid == chunk_id:
                    tf = freq
                    break
            
            if tf == 0:
                continue
            
            # Document frequency
            df = self.doc_frequency.get(token, 0)
            
            # IDF component
            idf = math.log((n_docs - df + 0.5) / (df + 0.5) + 1)
            
            # BM25 score component
            numerator = tf * (self.K1 + 1)
            denominator = tf + self.K1 * (1 - self.B + self.B * doc_length / self.avg_doc_length)
            
            score += idf * (numerator / denominator)
        
        return score
    
    def _semantic_score(self, query_tokens: List[str], chunk_id: str) -> float:
        """
        Compute semantic similarity using TF-IDF cosine similarity.
        """
        if chunk_id not in self.tfidf_vectors:
            return 0.0
        
        # Build query TF-IDF vector
        query_tf = self._compute_term_frequencies(query_tokens)
        n_docs = len(self.chunks)
        
        query_tfidf = {}
        for term, tf in query_tf.items():
            tf_score = 1 + math.log(tf) if tf > 0 else 0
            df = self.doc_frequency.get(term, 0)
            idf = math.log((n_docs + 1) / (df + 1)) + 1
            query_tfidf[term] = tf_score * idf
        
        # Normalize query vector
        magnitude = math.sqrt(sum(v ** 2 for v in query_tfidf.values()))
        if magnitude > 0:
            query_tfidf = {k: v / magnitude for k, v in query_tfidf.items()}
        
        # Compute cosine similarity
        doc_tfidf = self.tfidf_vectors[chunk_id]
        score = 0.0
        
        for term, q_score in query_tfidf.items():
            if term in doc_tfidf:
                score += q_score * doc_tfidf[term]
        
        return score
    
    def search(
        self,
        query: str,
        top_k: int = 5,
        bm25_weight: float = 0.6,
        semantic_weight: float = 0.4,
        min_score: float = 0.1
    ) -> List[SearchResult]:
        """
        Search for relevant chunks using hybrid BM25 + semantic scoring.
        Thread-safe: acquires read lock during search.
        
        Args:
            query: Search query
            top_k: Number of results to return
            bm25_weight: Weight for BM25 score (lexical)
            semantic_weight: Weight for semantic score
            min_score: Minimum score threshold
            
        Returns:
            List of SearchResult objects sorted by relevance
        """
        with self._lock:
            query_tokens = self._tokenize(query)
            
            if not query_tokens:
                return []
            
            # Get candidate chunks (those containing at least one query term)
            candidate_ids = set()
            for token in query_tokens:
                if token in self.inverted_index:
                    for chunk_id, _ in self.inverted_index[token]:
                        candidate_ids.add(chunk_id)
            
            # If no exact matches, fall back to all chunks
            if not candidate_ids:
                candidate_ids = set(self.chunk_index.keys())
            
            # Score candidates
            results = []
            for chunk_id in candidate_ids:
                bm25 = self._bm25_score(query_tokens, chunk_id)
                semantic = self._semantic_score(query_tokens, chunk_id)
                
                # Hybrid score
                combined_score = bm25_weight * bm25 + semantic_weight * semantic
                
                if combined_score >= min_score:
                    results.append(SearchResult(
                        chunk=self.chunk_index[chunk_id],
                        score=combined_score,
                        bm25_score=bm25,
                        semantic_score=semantic
                    ))
            
            # Sort by score descending
            results.sort(key=lambda r: r.score, reverse=True)
            
            return results[:top_k]
    
    def expand_query(self, query: str) -> str:
        """
        Expand query with related terms for better recall.
        Uses simple synonym expansion for common terms.
        """
        synonyms = {
            'setup': 'install configure deployment',
            'install': 'setup configure deployment',
            'deploy': 'deployment cloud run firebase',
            'database': 'mysql firestore db storage',
            'error': 'issue problem bug troubleshoot',
            'api': 'endpoint route backend',
            'auth': 'authentication login jwt token',
            'cost': 'price billing free tier',
            'file': 'upload document resume',
        }
        
        expanded = query
        for term, expansion in synonyms.items():
            if term in query.lower():
                expanded = f"{query} {expansion}"
                break
        
        return expanded
    
    def save(self, path: Optional[str] = None) -> None:
        """Save the vector store to disk"""
        save_path = path or self.cache_path
        if not save_path:
            return
        
        data = {
            'chunks': [c.to_dict() for c in self.chunks],
            'inverted_index': dict(self.inverted_index),
            'doc_frequency': dict(self.doc_frequency),
            'doc_lengths': self.doc_lengths,
            'avg_doc_length': self.avg_doc_length,
            'tfidf_vectors': self.tfidf_vectors,
        }
        
        with open(save_path, 'wb') as f:
            pickle.dump(data, f)
        
        logger.info(f"Saved vector store to {save_path}")
    
    def load(self, path: Optional[str] = None) -> bool:
        """Load the vector store from disk"""
        load_path = path or self.cache_path
        if not load_path or not Path(load_path).exists():
            return False
        
        try:
            with open(load_path, 'rb') as f:
                data = pickle.load(f)
            
            self.chunks = [
                DocumentChunk(**c) for c in data['chunks']
            ]
            self.chunk_index = {chunk.id: chunk for chunk in self.chunks}
            self.inverted_index = defaultdict(list, data['inverted_index'])
            self.doc_frequency = defaultdict(int, data['doc_frequency'])
            self.doc_lengths = data['doc_lengths']
            self.avg_doc_length = data['avg_doc_length']
            self.tfidf_vectors = data['tfidf_vectors']
            
            logger.info(f"Loaded vector store from {load_path}")
            return True
            
        except Exception as e:
            logger.error(f"Error loading vector store: {e}")
            return False
    
    def get_stats(self) -> Dict[str, Any]:
        """Get statistics about the vector store"""
        return {
            'total_chunks': len(self.chunks),
            'unique_terms': len(self.inverted_index),
            'avg_doc_length': round(self.avg_doc_length, 2),
            'sources': list(set(c.source_file for c in self.chunks))
        }
