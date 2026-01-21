@echo off
REM Docker helper script for Career Guidance AI System
REM Usage: docker-help.bat [command]

setlocal enabledelayedexpansion

if "%1"=="" (
    echo Career Guidance AI - Docker Helper
    echo.
    echo Usage: docker-help.bat [command]
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
    docker-compose build
    goto end
)

if "%1"=="up" (
    echo Starting services...
    docker-compose up -d
    echo.
    echo Services started! Access at:
    echo   Frontend: http://localhost
    echo   Backend:  http://localhost:8000
    echo   API Docs: http://localhost:8000/docs
    goto end
)

if "%1"=="down" (
    echo Stopping services...
    docker-compose down
    echo Services stopped.
    goto end
)

if "%1"=="logs" (
    docker-compose logs -f
    goto end
)

if "%1"=="logs-backend" (
    docker-compose logs -f backend
    goto end
)

if "%1"=="logs-frontend" (
    docker-compose logs -f frontend
    goto end
)

if "%1"=="logs-db" (
    docker-compose logs -f db
    goto end
)

if "%1"=="ps" (
    docker-compose ps
    goto end
)

if "%1"=="shell-backend" (
    echo Connecting to backend shell...
    docker-compose exec backend bash
    goto end
)

if "%1"=="shell-db" (
    echo Connecting to MySQL...
    docker-compose exec db mysql -u root -p
    goto end
)

if "%1"=="seed" (
    echo Seeding database with sample data...
    docker-compose exec backend python scripts/seed_database.py
    echo Database seeded.
    goto end
)

if "%1"=="verify" (
    echo Verifying database integrity...
    docker-compose exec backend python scripts/verify_data.py
    goto end
)

if "%1"=="clean" (
    echo Stopping and removing containers...
    docker-compose down
    echo Containers removed.
    goto end
)

if "%1"=="clean-all" (
    echo WARNING: This will delete all data including database!
    set /p confirm="Continue? (yes/no): "
    if "!confirm!"=="yes" (
        docker-compose down -v
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
echo Run 'docker-help.bat help' for available commands

:end
endlocal
