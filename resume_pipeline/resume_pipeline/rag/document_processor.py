"""
Document Processor for RAG System
Handles loading, chunking, and preprocessing of documentation files.
Implements industry best practices for document chunking.
"""

import os
import re
import hashlib
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass, field
from pathlib import Path
import logging

logger = logging.getLogger(__name__)


@dataclass
class DocumentChunk:
    """Represents a chunk of document with metadata"""
    id: str
    content: str
    source_file: str
    section_title: str
    chunk_index: int
    total_chunks: int
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'id': self.id,
            'content': self.content,
            'source_file': self.source_file,
            'section_title': self.section_title,
            'chunk_index': self.chunk_index,
            'total_chunks': self.total_chunks,
            'metadata': self.metadata
        }


class DocumentProcessor:
    """
    Processes documentation files for RAG system.
    
    Features:
    - Markdown-aware chunking (preserves headers)
    - Semantic chunking with overlap
    - Code block preservation
    - Metadata extraction
    """
    
    def __init__(
        self,
        chunk_size: int = 500,
        chunk_overlap: int = 100,
        min_chunk_size: int = 50,
        docs_directory: Optional[str] = None
    ):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.min_chunk_size = min_chunk_size
        self.docs_directory = docs_directory or self._find_docs_directory()
        
    def _find_docs_directory(self) -> str:
        """Find the docs directory relative to the project"""
        # Try common paths
        possible_paths = [
            Path(__file__).parent.parent.parent.parent.parent / "docs",  # From rag module
            Path.cwd() / "docs",
            Path.cwd().parent / "docs",
        ]
        
        for path in possible_paths:
            if path.exists() and path.is_dir():
                return str(path)
        
        # Default fallback
        return str(Path(__file__).parent.parent.parent.parent.parent / "docs")
    
    def load_documents(self) -> List[Tuple[str, str]]:
        """
        Load all markdown documents from the docs directory.
        Returns list of (filename, content) tuples.
        """
        documents = []
        docs_path = Path(self.docs_directory)
        
        if not docs_path.exists():
            logger.warning(f"Docs directory not found: {docs_path}")
            return documents
        
        # Load markdown files
        for md_file in docs_path.glob("**/*.md"):
            try:
                with open(md_file, 'r', encoding='utf-8') as f:
                    content = f.read()
                    relative_path = md_file.relative_to(docs_path)
                    documents.append((str(relative_path), content))
                    logger.info(f"Loaded document: {relative_path}")
            except Exception as e:
                logger.error(f"Error loading {md_file}: {e}")
        
        # Also load README.md from root if exists
        readme_path = docs_path.parent / "README.md"
        if readme_path.exists():
            try:
                with open(readme_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                    documents.append(("README.md", content))
                    logger.info("Loaded README.md from root")
            except Exception as e:
                logger.error(f"Error loading README.md: {e}")
        
        return documents
    
    def _extract_sections(self, content: str) -> List[Tuple[str, str]]:
        """
        Extract sections from markdown content.
        Returns list of (section_title, section_content) tuples.
        """
        sections = []
        
        # Split by headers (##, ###, etc.)
        # Keep the header with the section
        pattern = r'^(#{1,4}\s+[^\n]+)'
        parts = re.split(pattern, content, flags=re.MULTILINE)
        
        current_title = "Introduction"
        current_content = []
        
        for i, part in enumerate(parts):
            if re.match(r'^#{1,4}\s+', part):
                # This is a header
                if current_content:
                    sections.append((current_title, '\n'.join(current_content).strip()))
                current_title = part.strip().lstrip('#').strip()
                current_content = [part]
            else:
                current_content.append(part)
        
        # Don't forget the last section
        if current_content:
            sections.append((current_title, '\n'.join(current_content).strip()))
        
        return sections
    
    def _chunk_text(self, text: str, section_title: str) -> List[str]:
        """
        Chunk text with semantic awareness.
        Preserves code blocks and meaningful boundaries.
        """
        chunks = []
        
        # First, extract and protect code blocks
        code_blocks = []
        code_pattern = r'```[\s\S]*?```'
        
        def replace_code(match):
            code_blocks.append(match.group(0))
            return f"__CODE_BLOCK_{len(code_blocks) - 1}__"
        
        protected_text = re.sub(code_pattern, replace_code, text)
        
        # Split by paragraphs first (double newlines)
        paragraphs = re.split(r'\n\s*\n', protected_text)
        
        current_chunk = []
        current_length = 0
        
        for para in paragraphs:
            para = para.strip()
            if not para:
                continue
                
            para_length = len(para)
            
            # If paragraph alone exceeds chunk size, split it by sentences
            if para_length > self.chunk_size:
                # Save current chunk if exists
                if current_chunk:
                    chunks.append('\n\n'.join(current_chunk))
                    current_chunk = []
                    current_length = 0
                
                # Split long paragraph by sentences
                sentences = re.split(r'(?<=[.!?])\s+', para)
                sentence_chunk = []
                sentence_length = 0
                
                for sentence in sentences:
                    if sentence_length + len(sentence) > self.chunk_size and sentence_chunk:
                        chunks.append(' '.join(sentence_chunk))
                        # Keep overlap
                        overlap_start = max(0, len(sentence_chunk) - 2)
                        sentence_chunk = sentence_chunk[overlap_start:]
                        sentence_length = sum(len(s) for s in sentence_chunk)
                    
                    sentence_chunk.append(sentence)
                    sentence_length += len(sentence)
                
                if sentence_chunk:
                    current_chunk = [' '.join(sentence_chunk)]
                    current_length = sentence_length
            
            # If adding paragraph exceeds chunk size, start new chunk
            elif current_length + para_length > self.chunk_size and current_chunk:
                chunks.append('\n\n'.join(current_chunk))
                
                # Keep some overlap from previous chunk
                if len(current_chunk) > 1:
                    overlap_paras = current_chunk[-1:]
                    current_chunk = overlap_paras + [para]
                    current_length = sum(len(p) for p in current_chunk)
                else:
                    current_chunk = [para]
                    current_length = para_length
            else:
                current_chunk.append(para)
                current_length += para_length
        
        # Add remaining chunk
        if current_chunk:
            chunks.append('\n\n'.join(current_chunk))
        
        # Restore code blocks
        restored_chunks = []
        for chunk in chunks:
            for i, code_block in enumerate(code_blocks):
                chunk = chunk.replace(f"__CODE_BLOCK_{i}__", code_block)
            restored_chunks.append(chunk)
        
        return restored_chunks
    
    def _generate_chunk_id(self, source_file: str, section: str, index: int) -> str:
        """Generate unique ID for a chunk"""
        content = f"{source_file}:{section}:{index}"
        return hashlib.md5(content.encode()).hexdigest()[:12]
    
    def process_documents(self) -> List[DocumentChunk]:
        """
        Process all documents and return list of chunks.
        Main entry point for document processing.
        """
        all_chunks = []
        documents = self.load_documents()
        
        for filename, content in documents:
            sections = self._extract_sections(content)
            
            for section_title, section_content in sections:
                if len(section_content.strip()) < self.min_chunk_size:
                    continue
                    
                text_chunks = self._chunk_text(section_content, section_title)
                total_chunks = len(text_chunks)
                
                for idx, chunk_text in enumerate(text_chunks):
                    if len(chunk_text.strip()) < self.min_chunk_size:
                        continue
                    
                    chunk = DocumentChunk(
                        id=self._generate_chunk_id(filename, section_title, idx),
                        content=chunk_text.strip(),
                        source_file=filename,
                        section_title=section_title,
                        chunk_index=idx,
                        total_chunks=total_chunks,
                        metadata={
                            'char_count': len(chunk_text),
                            'has_code': '```' in chunk_text,
                            'has_table': '|' in chunk_text and '---' in chunk_text,
                        }
                    )
                    all_chunks.append(chunk)
        
        logger.info(f"Processed {len(documents)} documents into {len(all_chunks)} chunks")
        return all_chunks
    
    def get_document_summary(self) -> Dict[str, Any]:
        """Get summary of processed documents"""
        documents = self.load_documents()
        return {
            'total_documents': len(documents),
            'documents': [
                {
                    'filename': filename,
                    'size_chars': len(content),
                    'sections': len(self._extract_sections(content))
                }
                for filename, content in documents
            ]
        }
