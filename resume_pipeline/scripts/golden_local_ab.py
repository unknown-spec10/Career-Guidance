"""Golden A/B: TF-IDF fallback order vs local MiniLM ranking order.

Reuses the fixtures from golden_capture.py (same jobs/applicants). Compares:
  A) golden baseline — tests/golden_recommendations.json (FailingEmbedder,
     i.e. deterministic TF-IDF-only fallback, no network)
  B) local run — real Embedder (all-MiniLM-L6-v2, offline) over the same pairs

Reports per-applicant top-5 agreement. Exits non-zero if any applicant's
top-5 overlap drops below 3/5 (divergence worth investigating before
deleting the Gemini code path).
"""
import json
import os
import sys
from pathlib import Path
from unittest.mock import MagicMock

# NOTE (Windows dev box only): torch must be imported before sklearn, or the
# torch DLL init fails (sklearn's vcomp140 vs torch's libiomp5md conflict).
# Linux CI/Docker is unaffected. Preloading here keeps the A/B offline-capable.
import torch  # noqa: F401  pylint: disable=unused-import,wrong-import-position

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, os.path.join(os.path.dirname(__file__)))

from resume_pipeline.recommendation.embedder import Embedder  # noqa: E402
from resume_pipeline.recommendation.ranking import score_pair  # noqa: E402
from resume_pipeline.recommendation.retrieval import retrieve_candidate_jobs  # noqa: E402
from resume_pipeline.recommendation.scorers.document_scorer import DocumentScorer  # noqa: E402
from resume_pipeline.recommendation.scorers.personalization_scorer import PersonalizationScorer  # noqa: E402
from resume_pipeline.recommendation.scorers.semantic_scorer import SemanticScorer  # noqa: E402
from resume_pipeline.recommendation.scorers.temporal_scorer import TemporalScorer  # noqa: E402
from resume_pipeline.recommendation.scorers.tfidf_scorer import TfidfScorer  # noqa: E402
from golden_capture import APPLICANTS, JOBS, FailingEmbedder, make_applicant  # noqa: E402


def make_mock_db():
    """MagicMock DB whose cache/interview lookups all miss (forces compute path)."""
    mock_db = MagicMock()
    q = mock_db.query.return_value
    q.filter.return_value = q
    q.order_by.return_value = q
    q.first.return_value = None
    q.all.return_value = []
    return mock_db


def rank_with(embedder, mock_db):
    tfidf = TfidfScorer()
    tfidf.build_corpus(JOBS)
    out = {}
    for spec in APPLICANTS:
        applicant = make_applicant(spec)
        pers = PersonalizationScorer(mock_db)
        pers.preload_preferences = MagicMock()
        from resume_pipeline.recommendation.ranking import RankingContext
        ctx = RankingContext.__new__(RankingContext)
        ctx.db = mock_db
        ctx.embedder = embedder
        ctx.semantic_scorer = SemanticScorer(embedder)
        ctx.personalization_scorer = pers
        ctx.temporal_scorer = TemporalScorer()
        ctx.document_scorer = DocumentScorer(embedder)
        # Same staged path as production: retrieval first, then heavy ranking.
        candidates = retrieve_candidate_jobs(applicant, JOBS, db=None)
        ranked = []
        for job, tscore in candidates:
            breakdown = score_pair(applicant, job, mock_db, ctx, tscore, None)
            ranked.append((job.id, breakdown["final_score"], breakdown))
        ranked.sort(key=lambda x: x[1], reverse=True)
        out[spec["id"]] = ranked
    return out


def main() -> int:
    golden_path = Path(__file__).parent.parent / "tests" / "golden_recommendations.json"
    golden = json.loads(golden_path.read_text())
    golden_order = {a["applicant_id"]: [r["job_id"] for r in a["ranked"]] for a in golden["applicants"]}

    mock_db = make_mock_db()
    local_embedder = Embedder(mock_db)
    local = rank_with(local_embedder, mock_db)

    # Sanity: local model must produce genuinely semantic (non-zero) scores.
    # Judged on realistic payloads, not bare acronyms (MiniLM needs context).
    v_py = local_embedder.embed("Python, Django, PostgreSQL")
    v_py_job = local_embedder.embed("Python Backend Developer with Django and PostgreSQL")
    v_ops = local_embedder.embed("AWS Docker Kubernetes pipelines")
    sim_match = Embedder.cosine_similarity(v_py, v_py_job)
    sim_unrelated = Embedder.cosine_similarity(v_py, v_ops)
    print(f"sanity: cos(matching skills)={sim_match:.3f} (expect > 0.7), "
          f"cos(unrelated)={sim_unrelated:.3f} (expect < 0.3)")
    assert sim_match > 0.7, "Local model shows no match signal — aborting A/B"
    assert sim_unrelated < 0.3, "Local model cannot discriminate — aborting A/B"

    ok = True
    print(f"{'applicant':>10} | {'top5_base':>22} | {'top5_local':>22} | agree")
    for spec in APPLICANTS:
        aid = spec["id"]
        base_top5 = golden_order[aid][:5]
        local_order = [jid for jid, _, _ in local[aid]]
        local_top5 = local_order[:5]
        agree = len(set(base_top5) & set(local_top5))
        fallback_used = any(b.get("embedding_fallback") for _, _, b in local[aid])
        print(f"{aid:>10} | {str(base_top5):>22} | {str(local_top5):>22} | {agree}/5"
              f"{'  FALLBACK!' if fallback_used else ''}")
        print(f"   base full:  {[r for r in golden_order[aid]]}")
        print(f"   local full: {local_order}")
        if fallback_used:
            ok = False
            print("   FAIL: local run fell back to TF-IDF — model path broken")
        if agree < 3:
            ok = False
            print(f"   FAIL: top-5 agreement {agree}/5 below 3/5 threshold")
    print("GOLDEN A/B RESULT:", "PASS" if ok else "FAIL")
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
