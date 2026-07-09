import sys
from resume_pipeline.db import SessionLocal
from resume_pipeline.recommendation.engine import compute_recommendations

db = SessionLocal()
try:
    compute_recommendations(1, db)
except Exception as e:
    print("sys.modules keys with personalization_scorer:")
    print(sorted([k for k in sys.modules.keys() if "personalization_scorer" in k]))
