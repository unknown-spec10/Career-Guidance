"""Proof script for the embedding repair (embedfix).

Verifies, in one process against the throwaway SQLite schema:
  Part 2 — encoder:  the shared ONNX MiniLM encoder loads and embeds one
           sentence without any deep-learning framework installed.
  Part 1 — loader:   one sentence embedded locally, persisted through
           Embedder.get_applicant_embedding (write), then re-loaded through
           Embedder.get_cached_applicant_embedding_raw (load); plus the
           legacy shapes (JSON list, vector text, ndarray, pgvector Vector,
           garbage) all coerce without raising.

Usage (from resume_pipeline/, myenv active):
    $env:CI_SKIP_DB_VALIDATION="true"
    $env:SECRET_KEY="test_secret_key_at_least_32_characters_long_for_signing_jwt"
    python scripts/embed_fix_proof.py
"""

import os

os.environ.setdefault("CI_SKIP_DB_VALIDATION", "true")

import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import numpy as np

from resume_pipeline.core.minilm_onnx import MODEL_NAME, get_encoder
from resume_pipeline.db import Applicant, SessionLocal
from resume_pipeline.recommendation.embedder import (
    EMBEDDING_DIM,
    Embedder,
    coerce_embedding_vector,
)

failures = []


def check(name, cond, detail=""):
    print(f"[{'PASS' if cond else 'FAIL'}] {name} {detail}")
    if not cond:
        failures.append(name)


def close_enough(a, b):
    try:
        return a is not None and b is not None and np.allclose(a, b)
    except Exception:
        return False


# --- Part 2: the shared ONNX encoder embeds one sentence ---
encoder = get_encoder()
vec = encoder.encode("Career Guidance helps students find jobs.")
check("onnx-encoder-load", True, f"model={MODEL_NAME}")
check("local-minilm-embed", len(vec) == EMBEDDING_DIM, f"dim={len(vec)}")

# --- Part 1: write-then-load round trip through the Embedder + DB ---
db = SessionLocal()
applicant = Applicant(applicant_id="app_proof", display_name="Proof")
db.add(applicant)
db.commit()

embedder = Embedder(db)
written = embedder.get_applicant_embedding(
    applicant=applicant,
    text="Python, FastAPI, PostgreSQL",
    suffix="_skills",
    instruction="Represent this skill set for semantic similarity matching:",
)
check("applicant-embed-write", len(written) == EMBEDDING_DIM, f"dim={len(written)}")

db.expire_all()  # force the load path to read from the DB, not the identity map
loaded = embedder.get_cached_applicant_embedding_raw(applicant.id)
check(
    "applicant-embed-load",
    loaded is not None and np.allclose(loaded, written),
    f"round-trip dim={len(loaded) if loaded else None}",
)

# --- Part 1: legacy shapes coerce without raising (prod stored JSON lists) ---
legacy_list = [0.1] * EMBEDDING_DIM
check("coerce-list", coerce_embedding_vector(legacy_list) == legacy_list)
check(
    "coerce-vector-text",
    close_enough(
        coerce_embedding_vector("[" + ",".join(["0.1"] * EMBEDDING_DIM) + "]"),
        legacy_list,
    ),
)
check(
    "coerce-json-text",
    close_enough(coerce_embedding_vector("[0.1, 0.2]"), [0.1, 0.2]),
)
check(
    "coerce-ndarray",
    close_enough(
        coerce_embedding_vector(np.array(legacy_list, dtype=np.float32)),
        legacy_list,
    ),
)
try:
    from pgvector import Vector as PGVector

    check(
        "coerce-pgvector",
        close_enough(coerce_embedding_vector(PGVector(legacy_list)), legacy_list),
    )
except ImportError:
    print("[SKIP] coerce-pgvector (pgvector not installed)")
check("coerce-none", coerce_embedding_vector(None) is None)
check("coerce-garbage", coerce_embedding_vector("not a vector") is None)
check("coerce-nan", coerce_embedding_vector([float("nan")] * 4) is None)

# --- Part 1: the exact production crash no longer raises at the ORM layer ---
from resume_pipeline.db import _vector_column  # noqa: E402

proc = _vector_column().type.result_processor("default", None)
try:
    out = proc(legacy_list)  # pre-fix: AttributeError: 'list' ... 'split'
    check("tolerant-read-list", list(out) == legacy_list)
except AttributeError as e:
    check("tolerant-read-list", False, f"raised {e}")

db.close()

if failures:
    print(f"\nFAILED: {failures}")
    raise SystemExit(1)
print("\nAll embed-fix proofs passed.")
