"""
P0.2 configuration-hardening regression tests.

Covers validate_env():
- APP_ENV=production requires SECRET_KEY >= 32 chars (hard failure)
- development tolerates weak secrets (warning only)
- RENDER presence forces production behaviour regardless of APP_ENV
"""
import sys
import pytest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from resume_pipeline import app as app_module
from resume_pipeline.config import settings


@pytest.fixture(autouse=True)
def _restore_settings():
    saved = {k: getattr(settings, k) for k in ("SECRET_KEY", "PG_HOST", "PG_USER", "PG_DB", "APP_ENV")}
    yield
    for k, v in saved.items():
        setattr(settings, k, v)


def _configure(pg=True):
    if pg:
        settings.PG_HOST = "localhost"
        settings.PG_USER = "postgres"
        settings.PG_DB = "testdb"


def test_production_requires_strong_secret(monkeypatch):
    _configure()
    settings.APP_ENV = "production"
    settings.SECRET_KEY = "too-short"
    with pytest.raises(RuntimeError, match="SECRET_KEY"):
        app_module.validate_env()


def test_development_allows_weak_secret(monkeypatch):
    _configure()
    settings.APP_ENV = "development"
    settings.SECRET_KEY = "short-but-dev-only"
    app_module.validate_env()  # should not raise


def test_render_forces_production_behaviour(monkeypatch):
    _configure()
    settings.APP_ENV = "development"  # even if misconfigured as dev...
    settings.SECRET_KEY = ""
    monkeypatch.setenv("RENDER", "1")
    with pytest.raises(RuntimeError, match="SECRET_KEY"):
        app_module.validate_env()


def test_production_with_strong_secret_passes(monkeypatch):
    _configure()
    settings.APP_ENV = "production"
    settings.SECRET_KEY = "x" * 48
    app_module.validate_env()  # should not raise
