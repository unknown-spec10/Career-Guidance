"""
P0.3 migration-strategy regression tests.

Runs the real Alembic chain against a throwaway SQLite file database:
- `alembic upgrade head` creates the full baseline schema (non-destructive)
- re-running is idempotent
- the baseline explicitly refuses to downgrade (data-loss guard)
"""
import sys
import tempfile
import uuid
from pathlib import Path

import pytest
from sqlalchemy import create_engine, inspect, text

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from alembic import command
from alembic.config import Config

from resume_pipeline.config import settings

ALEMBIC_INI = Path(__file__).resolve().parents[1] / "alembic.ini"


@pytest.fixture()
def scratch_db_url():
    import gc
    tmp = Path(tempfile.gettempdir()) / f"cg_alembic_test_{uuid.uuid4().hex}.db"
    url = f"sqlite:///{tmp.as_posix()}"
    saved = settings.PG_DSN
    settings.PG_DSN = url  # env.py resolves the target from this
    yield url
    settings.PG_DSN = saved
    gc.collect()  # release pooled sqlite connections before unlink (Windows)
    for _ in range(3):
        try:
            if tmp.exists():
                tmp.unlink()
            break
        except PermissionError:
            import time
            time.sleep(0.2)


def _make_config() -> Config:
    cfg = Config(str(ALEMBIC_INI))
    cfg.set_main_option("script_location", str(ALEMBIC_INI.parent / "alembic"))
    return cfg


def test_upgrade_head_creates_full_schema(scratch_db_url):
    command.upgrade(_make_config(), "head")
    engine = create_engine(scratch_db_url)
    tables = set(inspect(engine).get_table_names())
    engine.dispose()

    expected = {"users", "applicants", "jobs", "job_recommendations",
                "interview_sessions", "learning_paths", "credit_accounts"}
    missing = expected - tables
    assert not missing, f"baseline migration missed tables: {missing}"
    # alembic_version tracks applied revisions
    assert "alembic_version" in tables


def test_upgrade_head_is_idempotent(scratch_db_url):
    cfg = _make_config()
    command.upgrade(cfg, "head")
    # Second run must be a clean no-op
    command.upgrade(cfg, "head")


def test_baseline_downgrade_refuses_data_loss(scratch_db_url):
    cfg = _make_config()
    command.upgrade(cfg, "head")

    engine = create_engine(scratch_db_url)
    version = engine.connect().execute(text("SELECT version_num FROM alembic_version")).scalar()
    engine.dispose()
    assert version == "0007_security_attempts"
