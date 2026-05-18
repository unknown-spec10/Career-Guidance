#!/bin/bash

# Docker helper script for Career Guidance AI System
# Usage: ./deploy/docker/docker-help.sh [command]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_BASE="$SCRIPT_DIR/docker-compose.yml"

compose() {
    docker compose -f "$COMPOSE_BASE" "$@"
}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_help() {
    cat << EOF
${BLUE}Career Guidance AI - Docker Helper${NC}

${GREEN}Usage:${NC} ./deploy/docker/docker-help.sh [command]

${GREEN}Available commands:${NC}
  build          - Build all Docker images
  up             - Start all services
  down           - Stop all services
  logs           - Show combined logs
  logs-backend   - Show backend logs only
  logs-frontend  - Show frontend logs only
  logs-db        - Show database logs only
  ps             - Show running services
  shell-backend  - Connect to backend shell
  shell-db       - Connect to database shell
  seed           - Seed database with sample data
  verify         - Verify database integrity
  clean          - Remove containers and volumes
  clean-all      - Remove everything including data
  help           - Show this help message

${GREEN}Examples:${NC}
  ./deploy/docker/docker-help.sh build
  ./deploy/docker/docker-help.sh up
  ./deploy/docker/docker-help.sh logs-backend
  ./deploy/docker/docker-help.sh seed
EOF
}

if [ $# -eq 0 ]; then
    print_help
    exit 0
fi

case "$1" in
    build)
        echo -e "${BLUE}Building Docker images...${NC}"
        compose build
        ;;
    up)
        echo -e "${BLUE}Starting services...${NC}"
        compose up -d
        echo ""
        echo -e "${GREEN}Services started! Access at:${NC}"
        echo "  Frontend: http://localhost"
        echo "  Backend:  http://localhost:8000"
        echo "  API Docs: http://localhost:8000/docs"
        ;;
    down)
        echo -e "${BLUE}Stopping services...${NC}"
        compose down
        echo -e "${GREEN}Services stopped.${NC}"
        ;;
    logs)
        compose logs -f
        ;;
    logs-backend)
        compose logs -f backend
        ;;
    logs-frontend)
        compose logs -f frontend
        ;;
    logs-db)
        compose logs -f db
        ;;
    ps)
        compose ps
        ;;
    shell-backend)
        echo -e "${BLUE}Connecting to backend shell...${NC}"
        compose exec backend bash
        ;;
    shell-db)
        echo -e "${BLUE}Connecting to PostgreSQL...${NC}"
        compose exec db psql -U ${PG_USER:-app_user} -d ${PG_DB:-resumes}
        ;;
    seed)
        echo -e "${BLUE}Seeding database with sample data...${NC}"
        compose exec backend python scripts/seed_database.py
        echo -e "${GREEN}Database seeded.${NC}"
        ;;
    verify)
        echo -e "${BLUE}Verifying database integrity...${NC}"
        compose exec backend python scripts/verify_data.py
        ;;
    clean)
        echo -e "${BLUE}Stopping and removing containers...${NC}"
        compose down
        echo -e "${GREEN}Containers removed.${NC}"
        ;;
    clean-all)
        echo -e "${RED}WARNING: This will delete all data including database!${NC}"
        read -p "Continue? (yes/no): " confirm
        if [ "$confirm" = "yes" ]; then
            compose down -v
            echo -e "${GREEN}All containers, volumes, and data removed.${NC}"
        else
            echo "Cancelled."
        fi
        ;;
    help)
        print_help
        ;;
    *)
        echo -e "${RED}Unknown command: $1${NC}"
        echo "Run './deploy/docker/docker-help.sh help' for available commands"
        exit 1
        ;;
esac
