"""Celery app bootstrap for async embedding/indexing tasks."""

from celery import Celery

from .config import settings


celery_app = Celery("career_guidance")

celery_app.conf.update(
    broker_url=settings.CELERY_BROKER_URL,
    result_backend=settings.CELERY_RESULT_BACKEND,
    task_default_queue=settings.CELERY_DEFAULT_QUEUE,
    task_always_eager=settings.CELERY_TASK_ALWAYS_EAGER,
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_soft_time_limit=settings.CELERY_TASK_SOFT_TIME_LIMIT_SECONDS,
    task_time_limit=settings.CELERY_TASK_TIME_LIMIT_SECONDS,
    task_routes={
        "pipeline.parse_resume": {"queue": settings.CELERY_DEFAULT_QUEUE},
        "pipeline.generate_recommendations": {"queue": settings.CELERY_DEFAULT_QUEUE},
        "embedding.generate_job_embedding": {"queue": settings.CELERY_EMBEDDINGS_QUEUE},
        "embedding.generate_resume_embedding": {"queue": settings.CELERY_EMBEDDINGS_QUEUE},
    },
)

# Explicit include to avoid implicit import surprises in deployment.
celery_app.autodiscover_tasks(["resume_pipeline.embedding_tasks"])
