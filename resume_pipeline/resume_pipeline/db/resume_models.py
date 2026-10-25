from sqlalchemy import (
    Column, Integer, String, DateTime, Float, JSON, Boolean, ForeignKey,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship
from .base import Base, _vector_column, LOCAL_EMBEDDING_DIM
import datetime


class LLMParsedRecord(Base):
    """Normalized LLM output + provenance (replaces ResumeParsed)"""
    __tablename__ = 'llm_parsed_records'

    applicant_id = Column(Integer, ForeignKey('applicants.id', ondelete='CASCADE'), primary_key=True)
    raw_llm_output = Column(JSON, nullable=False)  # Store raw for audit
    normalized = Column(JSON, nullable=False)  # Validated shape
    field_confidences = Column(JSON, nullable=True)  # Per-field confidences (legacy)
    per_section_confidence = Column(JSON, nullable=True)  # Per-section heuristic scores (redesign)
    llm_provenance = Column(JSON, nullable=True)  # Model name, tokens, call id
    needs_review = Column(Boolean, default=False, index=True)
    # State machine status: 'processing' | 'accepted' | 'pending_review' | 'failed'
    parse_status = Column(String(32), default='accepted', index=True)
    # Skills that fell through both normalization passes — not discarded, stored for taxonomy growth
    unrecognized_skills = Column(JSON, nullable=True)  # [{"name": "K8s", "raw": "K8s"}]
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    # Relationships
    applicant = relationship('Applicant', back_populates='parsed_record')


class EmbeddingsIndex(Base):
    """Reference between applicant and external vector store"""
    __tablename__ = 'embeddings_index'

    id = Column(Integer, primary_key=True, autoincrement=True)
    applicant_id = Column(Integer, ForeignKey('applicants.id', ondelete='CASCADE'), nullable=False, index=True)
    vector_store_id = Column(String(128), nullable=True)
    vector_type = Column(String(50))  # e.g., 'resume_summary', 'skills'
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    applicant = relationship('Applicant', back_populates='embeddings')


class ApplicantEmbedding(Base):
    """Persisted applicant embedding generated asynchronously by worker."""
    __tablename__ = 'applicant_embeddings'

    id = Column(Integer, primary_key=True, autoincrement=True)
    applicant_id = Column(Integer, ForeignKey('applicants.id', ondelete='CASCADE'), nullable=False, index=True)
    embedding_vector = _vector_column(LOCAL_EMBEDDING_DIM)  # vector(384) via pgvector
    embedding_provider = Column(String(32), nullable=True)
    embedding_model = Column(String(128), nullable=True)
    source_hash = Column(String(64), nullable=True, index=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    applicant = relationship('Applicant')

    __table_args__ = (
        UniqueConstraint('applicant_id', 'embedding_model', name='uq_applicant_embeddings_applicant_model'),
    )


# ============================================================
# ADMIN / AUXILIARY TABLES (taxonomy)
# ============================================================

class CanonicalSkill(Base):
    """Central skill ontology"""
    __tablename__ = 'canonical_skills'

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(128), unique=True, nullable=False, index=True)
    aliases = Column(JSON, nullable=True)  # ["py", "python3"]
    category = Column(String(64))  # 'ml', 'frontend'
    market_score = Column(Float, nullable=True)
    demand_level = Column(String(32), nullable=True)
    # pgvector embedding for semantic skill normalization (Pass 2)
    # Populated once by seed_skill_embeddings.py, updated when new skills are added.
    embedding = _vector_column(768)


# ============================================================
# LEGACY COMPATIBILITY (Keep for migration)
# ============================================================

class ResumeParsed(Base):
    """Legacy table - migrate to LLMParsedRecord"""
    __tablename__ = 'resume_parsed'

    id = Column(Integer, primary_key=True)
    applicant_id = Column(Integer, index=True)
    raw_gemini = Column(JSON)
    normalized = Column(JSON)
    provenance = Column(JSON)
    flags = Column(JSON)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
