"""Golden proof (step 7): retrieval recall >= 95% + ranking order stability.

Compares the NEW staged pipeline (retrieval -> score_pair) against the
pre-refactor full-ranking output saved by golden_capture.py in
tests/golden_recommendations.json. Same fixtures, forced TF-IDF fallback
(deterministic, no network) so the comparison isolates pipeline structure,
not embedding availability.

Reports per-applicant numbers and exits non-zero if recall < 95% or the
ranking order of retrieved jobs differs from the golden order.
"""
import json
import os
import sys
from pathlib import Path
from unittest.mock import MagicMock

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from resume_pipeline.recommendation.ranking import RankingContext, score_pair
from resume_pipeline.recommendation.retrieval import retrieve_candidate_jobs
from resume_pipeline.recommendation.scorers.document_scorer import DocumentScorer
from resume_pipeline.recommendation.scorers.personalization_scorer import PersonalizationScorer
from resume_pipeline.recommendation.scorers.semantic_scorer import SemanticScorer
from resume_pipeline.recommendation.scorers.temporal_scorer import TemporalScorer
from resume_pipeline.recommendation.scorers.tfidf_scorer import TfidfScorer

# Import the golden fixtures (same jobs/applicants as golden_capture.py).
sys.path.insert(0, os.path.join(os.path.dirname(__file__)))
from golden_capture import APPLICANTS, JOBS, FailingEmbedder, make_applicant


def main() -> int:
    golden_path = Path(__file__).parent.parent / "tests" / "golden_recommendations.json"
    golden = json.loads(golden_path.read_text())
    golden_order = {a["applicant_id"]: [r["job_id"] for r in a["ranked"]] for a in golden["applicants"]}
    golden_top5 = {aid: order[:5] for aid, order in golden_order.items()}

    tfidf = TfidfScorer()
    tfidf.build_corpus(JOBS)
    embedder = FailingEmbedder()
    mock_db = MagicMock()
    mock_db.query.return_value.filter.return_value.order_by.return_value.first.return_value = None

    ok = True
    print(f"{'applicant':>10} | {'recall(all)':>11} | {'recall(top5)':>12} | order_stable")
    for spec in APPLICANTS:
        applicant = make_applicant(spec)
        pers = PersonalizationScorer(mock_db)
        pers.preload_preferences = MagicMock()
        ctx = RankingContext.__new__(RankingContext)
        ctx.db = mock_db
        ctx.embedder = embedder
        ctx.semantic_scorer = SemanticScorer(embedder)
        ctx.personalization_scorer = pers
        ctx.temporal_scorer = TemporalScorer()
        ctx.document_scorer = DocumentScorer(embedder)

        # NEW pipeline: retrieval first, then heavy ranking over candidates.
        candidates = retrieve_candidate_jobs(applicant, JOBS, db=None)
        retrieved_ids = [j.id for j, _ in candidates]
        tfidf_by_job = {j.id: s for j, s in candidates}

        ranked = []
        for job, tscore in candidates:
            breakdown = score_pair(applicant, job, mock_db, ctx, tscore, None)
            ranked.append((job.id, breakdown["final_score"]))
        ranked.sort(key=lambda x: x[1], reverse=True)
        new_order = [jid for jid, _ in ranked]

        want = golden_order[spec["id"]]
        recall_all = len(set(new_order) & set(want)) / len(want)
        recall_top5 = len(set(new_order[:5]) & set(golden_top5[spec["id"]])) / 5

        # Order stability: the retrieved jobs must appear in the same relative
        # order as the golden full ranking (retrieval only filters, never reorders).
        golden_positions = {jid: i for i, jid in enumerate(want)}
        stable = all(
            golden_positions[new_order[i]] < golden_positions[new_order[i + 1]]
            for i in range(len(new_order) - 1)
        )

        print(f"{spec['id']:>10} | {recall_all:>10.1%} | {recall_top5:>11.1%} | {stable}")
        print(f"   golden: {want}")
        print(f"   new:    {new_order}")
        if recall_all < 0.95:
            ok = False
            print(f"   FAIL: recall {recall_all:.1%} below 95%")
        if not stable:
            ok = False
            print("   FAIL: ranking order not stable")

    print("GOLDEN RESULT:", "PASS" if ok else "FAIL")
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
