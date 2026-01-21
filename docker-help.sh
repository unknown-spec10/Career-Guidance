#!/bin/bash

# Docker helper script for Career Guidance AI System
# Usage: ./docker-help.sh [command]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_help() {
    cat << EOF
${BLUE}Career Guidance AI - Docker Helper${NC}

${GREEN}Usage:${NC} ./docker-help.sh [command]

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
  ./docker-help.sh build
  ./docker-help.sh up
  ./docker-help.sh logs-backend
  ./docker-help.sh seed
EOF
}

if [ $# -eq 0 ]; then
    print_help
    exit 0
fi

case "$1" in
    build)
        echo -e "${BLUE}Building Docker images...${NC}"
        docker-compose build
        ;;
    up)
        echo -e "${BLUE}Starting services...${NC}"
        docker-compose up -d
        echo ""
        echo -e "${GREEN}Services started! Access at:${NC}"
        echo "  Frontend: http://localhost"
        echo "  Backend:  http://localhost:8000"
        echo "  API Docs: http://localhost:8000/docs"
        ;;
    down)
        echo -e "${BLUE}Stopping services...${NC}"
        docker-compose down
        echo -e "${GREEN}Services stopped.${NC}"
        ;;
    logs)
        docker-compose logs -f
        ;;
    logs-backend)
        docker-compose logs -f backend
        ;;
    logs-frontend)
        docker-compose logs -f frontend
        ;;
    logs-db)
        docker-compose logs -f db
        ;;
    ps)
        docker-compose ps
        ;;
    shell-backend)
        echo -e "${BLUE}Connecting to backend shell...${NC}"
        docker-compose exec backend bash
        ;;
    shell-db)
        echo -e "${BLUE}Connecting to MySQL...${NC}"
        docker-compose exec db mysql -u root -p
        ;;
    seed)
        echo -e "${BLUE}Seeding database with sample data...${NC}"
        docker-compose exec backend python scripts/seed_database.py
        echo -e "${GREEN}Database seeded.${NC}"
        ;;
    verify)
        echo -e "${BLUE}Verifying database integrity...${NC}"
        docker-compose exec backend python scripts/verify_data.py
        ;;
    clean)
        echo -e "${BLUE}Stopping and removing containers...${NC}"
        docker-compose down
        echo -e "${GREEN}Containers removed.${NC}"
        ;;
    clean-all)
        echo -e "${RED}WARNING: This will delete all data including database!${NC}"
        read -p "Continue? (yes/no): " confirm
        if [ "$confirm" = "yes" ]; then
            docker-compose down -v
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
        echo "Run './docker-help.sh help' for available commands"
        exit 1
        ;;
esac
