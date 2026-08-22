"""Alembic environment for the Career Guidance AI backend.

Resolves the database URL from application settings (never hard-coded here) and
exposes the full SQLAlchemy metadata as the autogenerate target.
"""
from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

from resume_pipeline.config import settings
from resume_pipeline.db import Base

# Alembic Config object
config = context.config

# Interpret the config file for Python logging when run via the CLI
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Point Alembic at the same database the app uses.
if not settings.PG_DSN:
    raise RuntimeError(
        "No database configured: set PG_DSN or PG_HOST/PG_USER/PG_DB before running migrations."
    )
# Escape '%' for configparser interpolation (passwords often contain %40 etc).
config.set_main_option("sqlalchemy.url", settings.PG_DSN.replace("%", "%%"))

# Autogenerate target
target_metadata = Base.metadata


def include_object(obj, name, type_, reflected, compare_to):
    """Skip legacy tables that exist only in old databases (no ORM model)."""
    legacy_tables = {"resume_parsed"}
    if type_ == "table" and name in legacy_tables and compare_to is None:
        return False
    return True


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode (emit SQL without a DB connection)."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        include_object=include_object,
        compare_type=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode with an Engine/connection."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            include_object=include_object,
            compare_type=True,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
