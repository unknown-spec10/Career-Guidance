@echo off
REM Docker helper script for Career Guidance AI System
REM Usage: deploy\docker\docker-help.bat [command]

setlocal enabledelayedexpansion
set "SCRIPT_DIR=%~dp0"
set "COMPOSE_BASE=%SCRIPT_DIR%docker-compose.yml"
set "DB_USER=%PG_USER%"
if "%DB_USER%"=="" set "DB_USER=app_user"
set "DB_NAME=%PG_DB%"
if "%DB_NAME%"=="" set "DB_NAME=resumes"

if "%1"=="" (
    echo Career Guidance AI - Docker Helper
    echo.
    echo Usage: deploy\docker\docker-help.bat [command]
    echo.
    echo Available commands:
    echo   build          - Build all Docker images
    echo   up             - Start all services
    echo   down           - Stop all services
    echo   logs           - Show combined logs
    echo   logs-backend   - Show backend logs only
    echo   logs-frontend  - Show frontend logs only
    echo   logs-db        - Show database logs only
    echo   ps             - Show running services
    echo   shell-backend  - Connect to backend shell
    echo   shell-db       - Connect to database shell
    echo   seed           - Seed database with sample data
    echo   verify         - Verify database integrity
    echo   clean          - Remove containers and volumes
    echo   clean-all      - Remove everything including data
    echo   help           - Show this help message
    echo.
    goto end
)

if "%1"=="build" (
    echo Building Docker images...
    docker compose -f "%COMPOSE_BASE%" build
    goto end
)

if "%1"=="up" (
    echo Starting services...
    docker compose -f "%COMPOSE_BASE%" up -d
    echo.
    echo Services started! Access at:
    echo   Frontend: http://localhost
    echo   Backend:  http://localhost:8000
    echo   API Docs: http://localhost:8000/docs
    goto end
)

if "%1"=="down" (
    echo Stopping services...
    docker compose -f "%COMPOSE_BASE%" down
    echo Services stopped.
    goto end
)

if "%1"=="logs" (
    docker compose -f "%COMPOSE_BASE%" logs -f
    goto end
)

if "%1"=="logs-backend" (
    docker compose -f "%COMPOSE_BASE%" logs -f backend
    goto end
)

if "%1"=="logs-frontend" (
    docker compose -f "%COMPOSE_BASE%" logs -f frontend
    goto end
)

if "%1"=="logs-db" (
    docker compose -f "%COMPOSE_BASE%" logs -f db
    goto end
)

if "%1"=="ps" (
    docker compose -f "%COMPOSE_BASE%" ps
    goto end
)

if "%1"=="shell-backend" (
    echo Connecting to backend shell...
    docker compose -f "%COMPOSE_BASE%" exec backend bash
    goto end
)

if "%1"=="shell-db" (
    echo Connecting to PostgreSQL...
    docker compose -f "%COMPOSE_BASE%" exec db psql -U %DB_USER% -d %DB_NAME%
    goto end
)

if "%1"=="seed" (
    echo Seeding database with sample data...
    docker compose -f "%COMPOSE_BASE%" exec backend python scripts/seed_database.py
    echo Database seeded.
    goto end
)

if "%1"=="verify" (
    echo Verifying database integrity...
    docker compose -f "%COMPOSE_BASE%" exec backend python scripts/verify_data.py
    goto end
)

if "%1"=="clean" (
    echo Stopping and removing containers...
    docker compose -f "%COMPOSE_BASE%" down
    echo Containers removed.
    goto end
)

if "%1"=="clean-all" (
    echo WARNING: This will delete all data including database!
    set /p confirm="Continue? (yes/no): "
    if "!confirm!"=="yes" (
        docker compose -f "%COMPOSE_BASE%" down -v
        echo All containers, volumes, and data removed.
    ) else (
        echo Cancelled.
    )
    goto end
)

if "%1"=="help" (
    echo Career Guidance AI - Docker Helper
    echo.
    echo Commands:
    echo   build          - Build all Docker images
    echo   up             - Start all services
    echo   down           - Stop all services
    echo   logs           - Show combined logs
    echo   logs-backend   - Show backend logs only
    echo   logs-frontend  - Show frontend logs only
    echo   logs-db        - Show database logs only
    echo   ps             - Show running services
    echo   shell-backend  - Connect to backend shell
    echo   shell-db       - Connect to database shell
    echo   seed           - Seed database with sample data
    echo   verify         - Verify database integrity
    echo   clean          - Remove containers and volumes
    echo   clean-all      - Remove everything including data
    goto end
)

echo Unknown command: %1
echo Run 'deploy\docker\docker-help.bat help' for available commands

:end
endlocal
