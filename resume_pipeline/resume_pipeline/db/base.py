from sqlalchemy import Column, JSON
from sqlalchemy.orm import declarative_base

# pgvector SQLAlchemy integration — provides the Vector column type.
# If pgvector Python binding is not installed, fall back gracefully to JSON.
try:
    from pgvector.sqlalchemy import Vector as _PGVector  # type: ignore
    _PGVECTOR_AVAILABLE = True
except ImportError:
    _PGVECTOR_AVAILABLE = False
    _PGVector = None  # type: ignore
    import warnings
    warnings.warn(
        "pgvector Python binding not installed. "
        "Run: pip install pgvector  "
        "The embedding column will be defined as JSON until the binding is installed.",
        ImportWarning,
        stacklevel=1,
    )

# Local ONNX Runtime MiniLM model (all-MiniLM-L6-v2, see
# core/minilm_onnx.py::EMBEDDING_DIM) emits 384-dim vectors, which is
# what is actually written today.
LOCAL_EMBEDDING_DIM = 384


class _TolerantVector(_PGVector if _PGVector is not None else object):  # type: ignore
    """Vector column that also reads legacy JSON-stored embedding lists.

    Production tables created before the pgvector binding was installed use
    JSON columns holding plain lists (e.g. ``[0.1, 0.2, ...]``). The stock
    ``Vector.result_processor`` assumes a ``'[..]'`` string and crashes on
    such rows with ``AttributeError: 'list' object has no attribute 'split'``
    (via ``Vector.from_text``). This subclass passes list/tuple payloads
    through untouched and otherwise defers to the stock processor, falling
    back to the raw value on any parse failure instead of raising. DDL is
    unchanged (same ``VECTOR(dim)`` spec), so migrations are unaffected.
    """

    cache_ok = True

    def result_processor(self, dialect, coltype):
        parent = super().result_processor(dialect, coltype)

        def process(value):
            if isinstance(value, (list, tuple)):
                return list(value)
            try:
                return parent(value)
            except (AttributeError, TypeError, ValueError):
                return value

        return process


def _vector_column(dim: int = LOCAL_EMBEDDING_DIM) -> Column:
    if _PGVECTOR_AVAILABLE and _PGVector is not None:
        return Column(_TolerantVector(dim), nullable=True)
    return Column(JSON, nullable=True)  # fallback — no ANN index support

Base = declarative_base()
