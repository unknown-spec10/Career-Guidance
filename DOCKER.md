# Docker Deployment Guide

Complete guide for containerizing and deploying the Career Guidance AI System using Docker.

## Prerequisites

- **Docker** 20.10+ ([Install Docker](https://docs.docker.com/get-docker/))
- **Docker Compose** 2.0+ (included with Docker Desktop)
- Environment variables configured (see below)

## Quick Start (5 minutes)

### 1. Prepare Environment File

Copy and configure the Docker environment file:

```bash
cd "D:\Career Guidence"
cp .env.docker .env.docker.local
```

Edit `.env.docker.local` with your credentials:

```env
# Critical - Update these!
MYSQL_PASSWORD=your_strong_password
DB_USER_PASSWORD=your_strong_password
SECRET_KEY=your_secret_key_32_chars_minimum
GEMINI_API_KEY=your_gemini_api_key

# Email (optional, for verification emails)
GMAIL_USER=your-app@gmail.com
GMAIL_APP_PASSWORD=your_16_char_app_password
```

### 2. Build Images

```bash
# Build all images
docker-compose build

# Or build specific service
docker-compose build backend
docker-compose build frontend
```

### 3. Start Services

```bash
# Start all services (database, backend, frontend)
docker-compose up -d

# View logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f backend
docker-compose logs -f frontend
```

### 4. Access Application

- **Frontend**: http://localhost
- **Backend API**: http://localhost:8000
- **API Documentation**: http://localhost:8000/docs
- **Database Admin** (optional): http://localhost:8080

### 5. Stop Services

```bash
# Stop all services
docker-compose down

# Stop and remove volumes (WARNING: deletes database!)
docker-compose down -v
```

---

## Detailed Setup

### Environment Variables

Create `.env.docker.local` with these variables:

```env
# ============================================================
# Database Configuration (REQUIRED)
# ============================================================
MYSQL_PASSWORD=your_strong_mysql_root_password_here
DB_USER_PASSWORD=your_strong_app_user_password_here
MYSQL_USER=app_user
MYSQL_DB=resumes

# ============================================================
# Backend Configuration (REQUIRED)
# ============================================================
SECRET_KEY=generate_with_python_-c_import_secrets_print_secrets_token_hex_32
GEMINI_API_KEY=your_google_gemini_api_key_here

# ============================================================
# Email Configuration (OPTIONAL)
# ============================================================
GMAIL_USER=your-app@gmail.com
GMAIL_APP_PASSWORD=your_16_character_app_password

# ============================================================
# Google Search Integration (OPTIONAL)
# ============================================================
GOOGLE_SEARCH_API_KEY=your_search_key
GOOGLE_CSE_ID=your_search_engine_id

# ============================================================
# Debug Mode (Optional)
# ============================================================
GEMINI_MOCK_MODE=false
```

### File Structure

```
Career Guidance/
├── docker-compose.yml          # Main orchestration file
├── .env.docker                 # Template (do not edit)
├── .env.docker.local          # Your configuration (git-ignored)
│
├── resume_pipeline/
│   ├── Dockerfile             # Backend image definition
│   ├── .dockerignore          # Exclude from build context
│   ├── requirements.txt
│   └── resume_pipeline/
│       └── app.py
│
├── frontend/
│   ├── Dockerfile             # Frontend image definition
│   ├── .dockerignore          # Exclude from build context
│   ├── nginx.conf             # Nginx configuration
│   ├── nginx-default.conf     # Nginx site configuration
│   ├── package.json
│   └── src/
│       └── main.jsx
│
└── data/
    └── raw_files/             # Persistent storage (created by Docker)
```

---

## Docker Compose Services

### 1. MySQL Database (`db`)
- **Image**: mysql:8.0
- **Port**: 3306 (internal), 3306 (host)
- **Volume**: `db_data` (persistent database storage)
- **Health Check**: Enabled (verifies connection)
- **Auto-starts**: Yes (unless-stopped)

### 2. FastAPI Backend (`backend`)
- **Build**: Multi-stage Dockerfile (Python 3.11-slim)
- **Port**: 8000
- **Dependencies**: Requires healthy `db` service
- **Volumes**:
  - `./data/raw_files:/app/data/raw_files` (file uploads)
  - `./resume_pipeline/logs:/app/logs` (application logs)
- **Health Check**: Enabled (HTTP /api/stats)
- **Auto-starts**: Yes (unless-stopped)

### 3. React Frontend (`frontend`)
- **Build**: Multi-stage Dockerfile (Node 18 → Nginx Alpine)
- **Port**: 80 (HTTP)
- **Features**:
  - Nginx reverse proxy with API routing
  - Security headers configured
  - Client-side routing support
  - Caching optimized for production
- **Health Check**: Enabled (HTTP /)
- **Auto-starts**: Yes (unless-stopped)

### 4. Adminer (Optional Database UI)
- **Image**: adminer:latest
- **Port**: 8080
- **Profile**: `debug` (only start when needed)
- **Access**: http://localhost:8080
- **Credentials**: Use MySQL credentials from .env

---

## Common Docker Commands

### Build Operations

```bash
# Build all images
docker-compose build

# Build specific service
docker-compose build backend
docker-compose build frontend

# Build with no cache (fresh build)
docker-compose build --no-cache

# Build with BuildKit (faster, better caching)
DOCKER_BUILDKIT=1 docker-compose build
```

### Run Operations

```bash
# Start services in detached mode (background)
docker-compose up -d

# Start services in foreground (see logs)
docker-compose up

# Start specific service
docker-compose up -d backend

# Scale service (run multiple instances)
docker-compose up -d --scale backend=3
```

### Logging

```bash
# View logs from all services
docker-compose logs

# Follow logs in real-time
docker-compose logs -f

# Follow logs from specific service
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f db

# View last 50 lines
docker-compose logs --tail 50

# View logs with timestamps
docker-compose logs -t
```

### Status & Management

```bash
# View running services
docker-compose ps

# View service stats (CPU, memory, network)
docker-compose stats

# View service details
docker-compose config

# Validate compose file
docker-compose config --quiet

# View service dependencies
docker-compose config --services
```

### Stopping & Cleanup

```bash
# Stop services (keeps volumes)
docker-compose stop

# Stop specific service
docker-compose stop backend

# Stop and remove containers (keeps volumes)
docker-compose down

# Remove everything including volumes (WARNING: deletes data!)
docker-compose down -v

# Remove unused images
docker image prune

# Remove all unused resources
docker system prune -a
```

### Shell Access

```bash
# Execute command in running container
docker-compose exec backend bash
docker-compose exec frontend sh

# Run one-off command
docker-compose run backend python scripts/seed_database.py
```

---

## Database Management

### Initialize Database

Database is automatically initialized on first startup:

```bash
# First-time setup
docker-compose up -d db backend

# Check initialization logs
docker-compose logs db
```

### Seed Sample Data

```bash
# Seed with sample data
docker-compose exec backend python scripts/seed_database.py

# Verify data
docker-compose exec backend python scripts/verify_data.py
```

### Database Backup & Restore

```bash
# Backup database
docker-compose exec db mysqldump -u root -p"$MYSQL_PASSWORD" resumes > backup.sql

# Restore database
docker-compose exec -T db mysql -u root -p"$MYSQL_PASSWORD" resumes < backup.sql

# Export to file (outside container)
docker-compose exec db mysqldump -u root -p"$MYSQL_PASSWORD" resumes | gzip > backup_$(date +%Y%m%d_%H%M%S).sql.gz
```

### Connect to Database

```bash
# Direct MySQL connection
docker-compose exec db mysql -u root -p

# Using Adminer UI
# 1. Start with debug profile: docker-compose --profile debug up
# 2. Open http://localhost:8080
# 3. Login with MySQL credentials from .env

# MySQL commands inside container
docker-compose exec db mysql -u app_user -p"$DB_USER_PASSWORD" resumes -e "SELECT COUNT(*) FROM applicants;"
```

---

## Building Images Manually (Without Compose)

### Build Backend Image

```bash
cd resume_pipeline

# Build with tag
docker build -t career-guidance-backend:latest .

# Build with specific version
docker build -t career-guidance-backend:v1.0.0 .

# View image details
docker image inspect career-guidance-backend:latest

# Run container from image
docker run -p 8000:8000 \
  -e MYSQL_HOST=localhost \
  -e MYSQL_PASSWORD=password \
  -e GEMINI_API_KEY=key \
  career-guidance-backend:latest
```

### Build Frontend Image

```bash
cd frontend

# Build with tag
docker build -t career-guidance-frontend:latest .

# Build and run
docker run -p 80:80 career-guidance-frontend:latest
```

---

## Troubleshooting

### Services Won't Start

```bash
# Check service status
docker-compose ps

# View detailed logs
docker-compose logs

# Check specific service
docker-compose logs backend
docker-compose logs db

# Verify environment variables
docker-compose config | grep GEMINI_API_KEY

# Check port availability
# Windows
netstat -ano | findstr :8000
netstat -ano | findstr :3306

# Rebuild from scratch
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### Database Connection Errors

```bash
# Check database service
docker-compose logs db

# Verify database is healthy
docker-compose ps db

# Wait for database to be ready
docker-compose exec backend python -c \
  "import time; time.sleep(5); print('Database ready')"

# Test connection
docker-compose exec backend python -c \
  "from resume_pipeline.db import SessionLocal; SessionLocal(); print('Connected!')"
```

### API Not Responding

```bash
# Check backend health
curl http://localhost:8000/api/stats

# Check backend logs
docker-compose logs -f backend

# Verify backend is running
docker-compose ps backend

# Test container directly
docker-compose exec backend curl http://localhost:8000/api/stats
```

### Frontend Shows Blank Page

```bash
# Check frontend logs
docker-compose logs frontend

# Verify frontend is running
docker-compose ps frontend

# Check Nginx configuration
docker-compose exec frontend nginx -t

# Verify API proxy is working
curl http://localhost/api/stats
```

### Database Data Lost After Restart

```bash
# Ensure volume is persisting
docker volume ls | grep career

# Check volume mount point
docker-compose config | grep -A 5 "volumes:"

# Inspect volume
docker volume inspect career-guidance_db_data

# If volume missing, recreate:
docker volume create career-guidance_db_data
```

---

## Performance Optimization

### Multi-Stage Builds
Both Dockerfiles use multi-stage builds to reduce image size:
- Backend: ~400MB (Python slim + dependencies only)
- Frontend: ~20MB (optimized Nginx with built assets only)

### Caching Strategy
- Layer caching for faster rebuilds
- Separate dependency installation from code copy
- Use .dockerignore to reduce build context

### Resource Limits

Add to `docker-compose.yml` if needed:

```yaml
services:
  backend:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          cpus: '1'
          memory: 1G
```

### Container Registry Push

```bash
# Tag image for registry
docker tag career-guidance-backend:latest \
  your-registry.com/career-guidance-backend:latest

# Push to registry
docker push your-registry.com/career-guidance-backend:latest

# Pull from registry
docker pull your-registry.com/career-guidance-backend:latest
```

---

## Production Deployment

### Pre-Deployment Checklist
- [ ] Environment variables configured securely
- [ ] Database credentials strong (32+ characters)
- [ ] SECRET_KEY generated and unique
- [ ] API keys and secrets in environment (not in files)
- [ ] CORS origins restricted to production domains
- [ ] SSL/TLS certificate ready
- [ ] Backup strategy in place
- [ ] Monitoring/logging configured
- [ ] Health checks passing

### Deploy with Reverse Proxy (Nginx)

Create `nginx-proxy.conf`:

```nginx
upstream backend {
    server backend:8000;
}

upstream frontend {
    server frontend:80;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /etc/ssl/certs/cert.pem;
    ssl_certificate_key /etc/ssl/private/key.pem;

    # API to backend
    location /api/ {
        proxy_pass http://backend;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }

    # Everything else to frontend
    location / {
        proxy_pass http://frontend;
    }

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}
```

### Deploy with Docker Swarm

```bash
# Initialize swarm
docker swarm init

# Deploy stack
docker stack deploy -c docker-compose.yml career-guidance

# View services
docker service ls

# View service logs
docker service logs career-guidance_backend
```

### Deploy with Kubernetes

See `kubernetes/` directory for Kubernetes manifests (ConfigMaps, Secrets, Deployments, Services, PersistentVolumes).

---

## Monitoring & Logging

### View Container Logs

```bash
# Real-time logs
docker-compose logs -f backend

# Last 100 lines
docker-compose logs --tail 100 backend

# With timestamps
docker-compose logs -t backend
```

### Health Checks

All services have health checks configured:

```bash
# Check health status
docker-compose ps

# STATUS column shows health:
# Up (healthy)
# Up (unhealthy)
# Up (health: starting)
```

### Export Logs

```bash
# Save logs to file
docker-compose logs > application.log

# Gzip compressed
docker-compose logs | gzip > application.log.gz

# Service-specific
docker-compose logs backend > backend.log
docker-compose logs frontend > frontend.log
```

---

## Security Best Practices

1. **Environment Variables**
   - Never commit `.env` files
   - Use strong passwords (32+ characters)
   - Rotate credentials regularly
   - Use secrets manager in production

2. **Image Security**
   - Use specific base image versions (not `latest`)
   - Regular security updates
   - Scan images for vulnerabilities
   - Use private registry

3. **Network Security**
   - Services communicate over internal bridge network
   - Only expose necessary ports
   - Use HTTPS in production
   - Configure firewall rules

4. **Data Security**
   - Use named volumes for persistence
   - Regular database backups
   - Encrypt sensitive data at rest
   - Secure log handling

---

## Examples

### Example 1: Restart Failed Service

```bash
# If backend fails
docker-compose restart backend

# If database fails
docker-compose restart db
docker-compose up -d backend  # Restart dependent service

# Restart all
docker-compose restart
```

### Example 2: Update Application Code

```bash
# Pull latest code
git pull origin main

# Rebuild images
docker-compose build

# Restart services
docker-compose down
docker-compose up -d
```

### Example 3: Run Database Migration

```bash
# Execute migration script
docker-compose exec backend python scripts/init_db.py

# Or seed data
docker-compose exec backend python scripts/seed_database.py
```

### Example 4: Scale Backend

```bash
# Run 3 instances of backend (requires load balancer)
docker-compose up -d --scale backend=3

# Not recommended for single database;
# Consider adding Redis cache or database replication
```

---

## Advanced Usage

### Custom Network

```bash
# Create custom network
docker network create career-network

# Connect containers to network
docker run --network career-network ...
```

### Volume Management

```bash
# List volumes
docker volume ls

# Inspect volume
docker volume inspect career-guidance_db_data

# Backup volume
docker run --rm -v career-guidance_db_data:/data \
  -v $(pwd):/backup busybox tar czf /backup/db_backup.tar.gz /data

# Restore volume
docker run --rm -v career-guidance_db_data:/data \
  -v $(pwd):/backup busybox tar xzf /backup/db_backup.tar.gz
```

### Environment File Per Environment

```bash
# Development
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up

# Production
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up

# Staging
docker-compose -f docker-compose.yml -f docker-compose.staging.yml up
```

---

## Support & Troubleshooting Resources

- Docker Documentation: https://docs.docker.com/
- Docker Compose Reference: https://docs.docker.com/compose/
- Docker Hub: https://hub.docker.com/
- Docker Best Practices: https://docs.docker.com/develop/dev-best-practices/

---

**Last Updated**: January 17, 2026
**Version**: 1.0.0

