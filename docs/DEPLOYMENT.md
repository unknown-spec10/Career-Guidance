# 🚀 Career Guidance AI - Deployment Guide

Complete deployment guide for local development and Docker containers.

---

## 📑 Table of Contents

1. [Quick Start](#quick-start)
2. [Local Development](#local-development)
3. [Docker Deployment](#docker-deployment)
4. [Environment Variables](#environment-variables)
5. [Verification & Testing](#verification--testing)
6. [Troubleshooting](#troubleshooting)
7. [Production Checklist](#production-checklist)

---

## Quick Start

### ⚡ 5-Minute Local Setup

```powershell
# 1. Clone and navigate
cd "D:\Career Guidence"

# 2. Backend setup
cd resume_pipeline
python -m venv ..\myenv
..\myenv\Scripts\Activate.ps1
pip install -r requirements.txt

# 3. Configure environment
Copy-Item .env.example .env
# Edit .env with your credentials

# 4. Start backend
uvicorn resume_pipeline.app:app --reload --port 8000

# 5. Frontend setup (new terminal)
cd ..\frontend
npm install
npm run dev
```

**Access**:
- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs

---

## Local Development

### Prerequisites

- **Python**: 3.11+ ([Download](https://www.python.org/downloads/))
- **Node.js**: 18+ ([Download](https://nodejs.org/))
- **PostgreSQL**: 16+ ([Download](https://www.postgresql.org/download/)) or use Docker
- **Git**: Latest ([Download](https://git-scm.com/downloads))

### Backend Setup

#### 1. Create Virtual Environment

```powershell
cd "D:\Career Guidence\resume_pipeline"
python -m venv ..\myenv
..\myenv\Scripts\Activate.ps1
```

#### 2. Install Dependencies

```powershell
pip install -r requirements.txt
```

**Key Packages**:
- `fastapi[standard]`: Web framework
- `sqlalchemy`: ORM
- `psycopg2-binary`: PostgreSQL driver
- `google-generativeai`: Gemini AI
- `pydantic`: Data validation
- `python-jose[cryptography]`: JWT auth
- `bcrypt`: Password hashing

#### 3. Configure PostgreSQL Database

**Option A: Docker (Recommended)**
```powershell
docker run -d `
  --name career-postgres `
  -e POSTGRES_PASSWORD=yourpassword `
  -e POSTGRES_DB=career_guidance `
  -e POSTGRES_USER=postgres `
  -p 5432:5432 `
  postgres:16
```

**Option B: Manual PostgreSQL Setup**
```sql
CREATE DATABASE career_guidance;
CREATE USER career_user WITH ENCRYPTED PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE career_guidance TO career_user;
```

**Option C: Docker Compose (full stack)**
```powershell
docker-compose up -d
```

#### 4. Create .env File

```bash
# Copy template
cp .env.example .env
```

**Required Variables** (`.env`):
```env
# PostgreSQL
PG_HOST=localhost
PG_PORT=5432
PG_USER=postgres
PG_PASSWORD=yourpassword
PG_DB=career_guidance

# Security
SECRET_KEY=your-super-secret-jwt-key-min-32-chars
JWT_ALGORITHM=HS256
JWT_EXPIRATION_MINUTES=1440

# AI Services
GEMINI_API_KEY=your-gemini-api-key
GROQ_API_KEY=your-groq-api-key
GOOGLE_API_KEY=your-google-api-key
GOOGLE_SEARCH_ENGINE_ID=your-search-engine-id

# Email (Gmail SMTP)
GMAIL_USER=your-email@gmail.com
GMAIL_APP_PASSWORD=your-16-char-app-password

# Frontend
FRONTEND_URL=http://localhost:5173
CORS_ORIGINS=http://localhost:5173,http://localhost:3000

# Storage
FILE_STORAGE_PATH=./data/raw_files
```

**Get API Keys**:
- **Gemini**: https://aistudio.google.com/apikey
- **Google Search**: https://console.cloud.google.com/apis/credentials
- **Gmail App Password**: https://myaccount.google.com/apppasswords

#### 5. Initialize Database

```powershell
python scripts/init_db.py
python scripts/seed_database.py  # Optional: sample data
```

**Verification**:
```powershell
python scripts/verify_data.py
```

#### 6. Run Backend Server

```powershell
uvicorn resume_pipeline.app:app --reload --port 8000 --host 127.0.0.1
```

**Options**:
- `--reload`: Auto-restart on code changes
- `--port 8000`: Server port
- `--host 127.0.0.1`: Localhost only

**Verify**:
- API Docs: http://localhost:8000/docs
- Health: http://localhost:8000/api/stats

### Frontend Setup

#### 1. Install Dependencies

```powershell
cd "D:\Career Guidence\frontend"
npm install
```

**Key Packages**:
- `react`: UI library
- `vite`: Build tool
- `axios`: HTTP client
- `react-router-dom`: Routing
- `tailwindcss`: Styling
- `lucide-react`: Icons

#### 2. Configure Environment

Create `frontend/.env`:
```env
VITE_API_URL=http://localhost:8000
VITE_ENV=development
```

#### 3. Run Development Server

```powershell
npm run dev
```

**Access**: http://localhost:5173

#### 4. Build for Production

```powershell
npm run build
```

Output: `frontend/dist/`

---

## Docker Deployment

### Using Docker Compose (Recommended)

#### 1. Prerequisites

- **Docker Desktop**: [Download](https://www.docker.com/products/docker-desktop)
- Ensure Docker daemon is running

#### 2. Configuration

**Create `docker-compose.yml`** (already exists):
```yaml
services:
  mysql:
    image: mysql:8.0
    environment:
      MYSQL_ROOT_PASSWORD: rootpassword
      MYSQL_DATABASE: career_guidance
      MYSQL_USER: career_user
      MYSQL_PASSWORD: yourpassword
    ports:
      - "3306:3306"
    volumes:
      - mysql_data:/var/lib/mysql
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
      interval: 10s
      timeout: 5s
      retries: 5

  backend:
    build:
      context: ./resume_pipeline
      dockerfile: Dockerfile
    ports:
      - "8000:8000"
    environment:
      - APP_ENV=local
      - MYSQL_HOST=mysql
      - MYSQL_USER=career_user
      - MYSQL_PASSWORD=yourpassword
      - MYSQL_DB=career_guidance
    env_file:
      - ./resume_pipeline/.env
    depends_on:
      mysql:
        condition: service_healthy
    volumes:
      - ./data:/app/data

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    ports:
      - "80:80"
    environment:
      - VITE_API_URL=http://localhost:8000
    depends_on:
      - backend

volumes:
  mysql_data:
```

#### 3. Build and Run

```powershell
# Build images
docker-compose build

# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

#### 4. Access Services

- **Frontend**: http://localhost
- **Backend**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs

### Manual Docker Commands

#### Backend

```powershell
# Build
cd resume_pipeline
docker build -t career-backend .

# Run
docker run -d `
  --name career-backend `
  -p 8000:8000 `
  -e APP_ENV=local `
  -e MYSQL_HOST=host.docker.internal `
  --env-file .env `
  career-backend
```

#### Frontend

```powershell
# Build
cd frontend
docker build -t career-frontend .

# Run
docker run -d `
  --name career-frontend `
  -p 80:80 `
  -e VITE_API_URL=http://localhost:8000 `
  career-frontend
```

### Docker Troubleshooting

**Container won't start**:
```powershell
docker logs <container-name>
```

**Port already in use**:
```powershell
# Find process using port
netstat -ano | findstr :8000

# Kill process
taskkill /PID <PID> /F
```

**MySQL connection refused**:
```powershell
# Check if MySQL is ready
docker exec career-mysql mysqladmin ping -h localhost

# Check network
docker network inspect bridge
```

---

## Cloud Deployment (GCP)

### Prerequisites

1. **GCP Account**: [Create free account](https://cloud.google.com/free)
2. **gcloud CLI**: [Install](https://cloud.google.com/sdk/docs/install)
3. **Project Created**: Create GCP project (e.g., `resume-app-10864`)

### Initial Setup

#### 1. Authenticate

```powershell
# Login to GCP
gcloud auth login

# Set project
gcloud config set project resume-app-10864

# Set region
gcloud config set run/region asia-south1

# Enable required APIs
gcloud services enable run.googleapis.com
gcloud services enable firestore.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable artifactregistry.googleapis.com
```

#### 2. Create Firestore Database

```powershell
# Create database
gcloud firestore databases create `
  --location=asia-south1 `
  --type=firestore-native

# Verify
gcloud firestore databases list
```

#### 3. Seed Firestore (Optional)

```powershell
# Authenticate for Application Default Credentials
gcloud auth application-default login

# Run seeding script
cd resume_pipeline
python scripts/seed_firestore.py
```

**Verification**:
```powershell
# Check Firestore console
# https://console.firebase.google.com/project/resume-app-10864/firestore
```

### Backend Deployment (Cloud Run)

#### 1. Build Docker Image

```powershell
cd "D:\Career Guidence\resume_pipeline"

# Build for production
docker build -f Dockerfile.prod -t gcr.io/resume-app-10864/backend:latest .

# Push to Google Container Registry
docker push gcr.io/resume-app-10864/backend:latest
```

#### 2. Deploy to Cloud Run

```powershell
gcloud run deploy career-backend `
  --image gcr.io/resume-app-10864/backend:latest `
  --platform managed `
  --region asia-south1 `
  --allow-unauthenticated `
  --port 8000 `
  --min-instances 0 `
  --max-instances 1 `
  --memory 512Mi `
  --cpu 1 `
  --timeout 300s `
  --set-env-vars APP_ENV=cloud
```

**Get Service URL**:
```powershell
gcloud run services describe career-backend `
  --region asia-south1 `
  --format="value(status.url)"
```

Example output: `https://career-backend-xxxx-uc.a.run.app`

#### 3. Configure Environment Variables

**Create `cloud_env_vars.yaml`**:
```yaml
APP_ENV: cloud
CORS_ORIGINS: https://resume-app-10864.web.app,https://career-backend-xxxx-uc.a.run.app
SECRET_KEY: your-production-secret-key-min-32-chars
GEMINI_API_KEY: your-gemini-api-key
GROQ_API_KEY: your-groq-api-key
GOOGLE_API_KEY: your-google-api-key
GOOGLE_SEARCH_ENGINE_ID: your-search-engine-id
GMAIL_USER: your-email@gmail.com
GMAIL_APP_PASSWORD: your-16-char-app-password
JWT_ALGORITHM: HS256
JWT_EXPIRATION_MINUTES: "1440"
FRONTEND_URL: https://resume-app-10864.web.app
FILE_STORAGE_PATH: /tmp/data
```

**Apply to Cloud Run**:
```powershell
gcloud run services update career-backend `
  --region asia-south1 `
  --update-env-vars-file cloud_env_vars.yaml
```

**Verify**:
```powershell
gcloud run services describe career-backend `
  --region asia-south1 `
  --format="yaml(spec.template.spec.containers[0].env)"
```

### Frontend Deployment (Firebase Hosting)

#### 1. Initialize Firebase

```powershell
# Install Firebase CLI
npm install -g firebase-tools

# Login
firebase login

# Initialize project
cd "D:\Career Guidence\frontend"
firebase init hosting
```

**Configuration** (`firebase.json`):
```json
{
  "hosting": {
    "public": "dist",
    "ignore": [
      "firebase.json",
      "**/.*",
      "**/node_modules/**"
    ],
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ]
  }
}
```

#### 2. Update Environment

**Create `.env.production`**:
```env
VITE_API_URL=https://career-backend-xxxx-uc.a.run.app
VITE_ENV=production
```

#### 3. Build and Deploy

```powershell
# Build with production env
npm run build

# Deploy to Firebase
firebase deploy --only hosting
```

**Output**:
```
✔  Deploy complete!

Hosting URL: https://resume-app-10864.web.app
```

### Automated Deployment Script

**Create `redeploy.ps1`**:
```powershell
# Backend
Write-Host "🔨 Building backend..." -ForegroundColor Cyan
cd resume_pipeline
docker build -f Dockerfile.prod -t gcr.io/resume-app-10864/backend:latest .
docker push gcr.io/resume-app-10864/backend:latest

Write-Host "🚀 Deploying to Cloud Run..." -ForegroundColor Cyan
gcloud run deploy career-backend `
  --image gcr.io/resume-app-10864/backend:latest `
  --platform managed `
  --region asia-south1 `
  --allow-unauthenticated

# Frontend
Write-Host "🔨 Building frontend..." -ForegroundColor Cyan
cd ../frontend
npm run build

Write-Host "🚀 Deploying to Firebase..." -ForegroundColor Cyan
firebase deploy --only hosting

Write-Host "✅ Deployment complete!" -ForegroundColor Green
```

**Usage**:
```powershell
.\redeploy.ps1
```

---

## Environment Variables

### Complete Reference

| Variable | Required | Description |
|----------|----------|-------------|
| **PG_HOST** | Yes | PostgreSQL host (e.g. `localhost`) |
| **PG_PORT** | No | PostgreSQL port (default `5432`) |
| **PG_USER** | Yes | PostgreSQL username |
| **PG_PASSWORD** | Yes | PostgreSQL password |
| **PG_DB** | Yes | Database name |
| **PG_DSN** | No | Full DSN (overrides discrete PG_* vars) |
| **SECRET_KEY** | Yes | JWT signing key (32+ chars) |
| **JWT_ALGORITHM** | No | JWT algorithm (default `HS256`) |
| **JWT_EXPIRATION_MINUTES** | No | Token expiry in minutes (default `1440`) |
| **GEMINI_API_KEY** | Yes | Google Gemini API key |
| **GROQ_API_KEY** | Yes | Groq API key for RAG |
| **GOOGLE_API_KEY** | No | Google Custom Search API key |
| **GOOGLE_SEARCH_ENGINE_ID** | No | Custom search engine ID |
| **GMAIL_USER** | No | Gmail for verification emails |
| **GMAIL_APP_PASSWORD** | No | Gmail app password (16 chars) |
| **FRONTEND_URL** | No | Frontend URL for email links |
| **CORS_ORIGINS** | No | Comma-separated allowed origins |
| **FILE_STORAGE_PATH** | No | File storage path (default `./data/raw_files`) |
| **GEMINI_MOCK_MODE** | No | Set `true` to stub LLM calls in tests |

### Security Best Practices

1. **Never commit .env files**: Add to `.gitignore`
2. **Use strong secrets**: Min 32 characters for SECRET_KEY
3. **Rotate credentials**: Change passwords quarterly
4. **Restrict API keys**: Enable API restrictions in GCP console
5. **Use Secret Manager**: For production (optional)

---

## Verification & Testing

### Local Verification

#### Backend Health Check

```powershell
# Test stats endpoint
Invoke-RestMethod -Uri http://localhost:8000/api/stats

# Expected output:
# {
#   "total_applicants": 10,
#   "total_colleges": 50,
#   "total_jobs": 30
# }

# Test OpenAPI docs
Start-Process "http://localhost:8000/docs"
```

#### Database Connectivity

```powershell
# MySQL
mysql -h localhost -u career_user -p career_guidance -e "SHOW TABLES;"

# Expected tables: users, applicants, colleges, jobs, etc.
```

#### Upload Test

```powershell
# Upload resume
$file = Get-Content "data/raw_files/app_xxx/sample_resume.txt" -Raw
$response = Invoke-RestMethod `
  -Uri http://localhost:8000/upload `
  -Method Post `
  -ContentType "text/plain" `
  -Body $file

# Parse resume
$applicantId = $response.applicant_id
Invoke-RestMethod `
  -Uri "http://localhost:8000/parse/$applicantId" `
  -Method Post
```

### Cloud Verification

#### Backend Endpoints

```powershell
$BACKEND_URL = "https://career-backend-xxxx-uc.a.run.app"

# Test stats
Invoke-RestMethod -Uri "$BACKEND_URL/api/stats"

# Test colleges
Invoke-RestMethod -Uri "$BACKEND_URL/api/colleges"

# Test jobs
Invoke-RestMethod -Uri "$BACKEND_URL/api/jobs"

# Test Firestore debug endpoint
Invoke-RestMethod -Uri "$BACKEND_URL/api/debug/firestore-counts"

# Expected output:
# {
#   "environment": "cloud",
#   "users": 3,
#   "colleges": 3,
#   "jobs": 3,
#   ...
# }
```

#### Frontend

1. **Open app**: https://resume-app-10864.web.app
2. **Register**: Create new user account
3. **Verify email**: Check inbox for verification code
4. **Login**: Authenticate with credentials
5. **Upload resume**: Test file upload
6. **Parse**: Trigger resume parsing
7. **View recommendations**: Check college/job suggestions

#### Cloud Run Logs

```powershell
# View recent logs
gcloud run services logs read career-backend `
  --region asia-south1 `
  --limit 50

# Follow logs
gcloud run services logs tail career-backend `
  --region asia-south1
```

#### Firestore Data

```powershell
# List documents
gcloud firestore documents list users --limit 5

# Get document
gcloud firestore documents get users/user123
```

### Load Testing (Optional)

#### Using Apache Bench

```powershell
# Install Apache Bench (part of XAMPP)
# Test backend
ab -n 100 -c 10 http://localhost:8000/api/stats

# Test Cloud Run
ab -n 100 -c 10 https://career-backend-xxxx-uc.a.run.app/api/stats
```

#### Using Python

```python
import requests
import time

url = "http://localhost:8000/api/stats"
times = []

for i in range(100):
    start = time.time()
    response = requests.get(url)
    elapsed = time.time() - start
    times.append(elapsed)
    print(f"Request {i+1}: {elapsed:.3f}s - Status {response.status_code}")

print(f"\nAverage: {sum(times)/len(times):.3f}s")
print(f"Min: {min(times):.3f}s")
print(f"Max: {max(times):.3f}s")
```

---

## Troubleshooting

### Common Issues

#### 1. Port Already in Use

**Symptoms**:
```
ERROR: [Errno 10048] error while attempting to bind on address ('127.0.0.1', 8000)
```

**Solution**:
```powershell
# Find process
netstat -ano | findstr :8000

# Kill process
taskkill /PID <PID> /F

# Or use different port
uvicorn resume_pipeline.app:app --port 8001
```

#### 2. MySQL Connection Refused

**Symptoms**:
```
sqlalchemy.exc.OperationalError: (2003, "Can't connect to MySQL server")
```

**Solution**:
```powershell
# Check MySQL is running
Get-Service MySQL80

# Start if stopped
Start-Service MySQL80

# Test connection
mysql -h localhost -u career_user -p

# Check firewall
Test-NetConnection -ComputerName localhost -Port 3306
```

#### 3. Gemini API Error

**Symptoms**:
```
google.api_core.exceptions.PermissionDenied: 403 API key not valid
```

**Solution**:
```powershell
# Verify API key
$env:GEMINI_API_KEY

# Test API key
curl -X POST "https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key=$env:GEMINI_API_KEY" `
  -H "Content-Type: application/json" `
  -d '{"contents":[{"parts":[{"text":"Hello"}]}]}'

# Regenerate key: https://aistudio.google.com/apikey
```

#### 4. Cloud Run 500 Error

**Symptoms**:
```
Error: Container failed to start. Failed to start and then listen on the port defined by the PORT environment variable.
```

**Solution**:
```powershell
# Check logs
gcloud run services logs read career-backend --region asia-south1 --limit 100

# Common fixes:
# 1. Ensure Dockerfile.prod uses PORT environment variable
# 2. Check all environment variables are set
# 3. Verify image builds locally first
```

#### 5. Firestore Permission Denied

**Symptoms**:
```
google.api_core.exceptions.PermissionDenied: 403 Missing or insufficient permissions
```

**Solution**:
```powershell
# Re-authenticate
gcloud auth application-default login

# Verify project
gcloud config get-value project

# Check IAM permissions
gcloud projects get-iam-policy resume-app-10864

# Grant permissions if needed
gcloud projects add-iam-policy-binding resume-app-10864 `
  --member="user:your-email@gmail.com" `
  --role="roles/datastore.user"
```

#### 6. CORS Error in Browser

**Symptoms**:
```
Access to XMLHttpRequest at 'http://localhost:8000/api/colleges' from origin 'http://localhost:5173' has been blocked by CORS policy
```

**Solution**:
```powershell
# Check CORS_ORIGINS in .env
CORS_ORIGINS=http://localhost:5173,http://localhost:3000

# Restart backend
uvicorn resume_pipeline.app:app --reload --port 8000

# For Cloud Run, update environment variable
gcloud run services update career-backend `
  --region asia-south1 `
  --update-env-vars CORS_ORIGINS=https://resume-app-10864.web.app
```

#### 7. Frontend Build Fails

**Symptoms**:
```
ERROR: Failed to compile.
Module not found: Can't resolve '@/components/...'
```

**Solution**:
```powershell
# Clear cache
rm -rf node_modules package-lock.json
npm install

# Check vite.config.js alias configuration
# Ensure tsconfig paths match

# Try build again
npm run build
```

### Debug Mode

**Enable Verbose Logging**:
```python
# Add to app.py
import logging
logging.basicConfig(level=logging.DEBUG)
```

**Test with curl**:
```powershell
curl -X GET http://localhost:8000/api/stats -v
```

### Health Check Endpoints

Add to `app.py`:
```python
@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "environment": settings.APP_ENV,
        "timestamp": datetime.now().isoformat()
    }

@app.get("/debug/env")
async def debug_env():
    return {
        "APP_ENV": settings.APP_ENV,
        "MYSQL_HOST": settings.MYSQL_HOST if hasattr(settings, 'MYSQL_HOST') else None,
        "FRONTEND_URL": settings.FRONTEND_URL
    }
```

---

## Production Checklist

### Pre-Deployment

- [ ] All environment variables configured
- [ ] Secrets rotated (not using default values)
- [ ] API keys have usage limits set
- [ ] Database initialized and seeded
- [ ] Frontend builds without errors
- [ ] Backend passes all tests
- [ ] CORS origins updated for production URLs
- [ ] Email verification working
- [ ] File upload limits set
- [ ] Rate limiting enabled

### Deployment

- [ ] Backend deployed to Cloud Run
- [ ] Frontend deployed to Firebase Hosting
- [ ] Firestore database created and populated
- [ ] Cloud Run min instances = 0 (cost optimization)
- [ ] Cloud Run max instances = 1 (budget control)
- [ ] Domain configured (if using custom domain)
- [ ] SSL certificates active
- [ ] Environment variables verified in Cloud Run

### Post-Deployment

- [ ] All API endpoints responding correctly
- [ ] User registration working
- [ ] Email verification emails received
- [ ] Resume upload functioning
- [ ] Parsing working (Gemini API calls successful)
- [ ] Recommendations generating
- [ ] Credit system functioning
- [ ] Cloud Run logs showing no errors
- [ ] Firestore operations successful
- [ ] Frontend loads correctly
- [ ] Navigation working (React Router)

### Monitoring

- [ ] GCP billing alerts configured
- [ ] Cloud Run request metrics monitoring
- [ ] Firestore usage monitoring
- [ ] Error rate alerts set up
- [ ] Backup strategy defined
- [ ] Incident response plan documented

### Budget Controls

- [ ] Budget alert at $5
- [ ] Budget alert at $10
- [ ] Budget alert at $20
- [ ] Auto-stop at $50 (optional)
- [ ] Cloud Run concurrency = 1
- [ ] Cloud Run max instances = 1
- [ ] Firestore free tier limits monitored

---

## Cost Monitoring

### GCP Console URLs

- **Billing Dashboard**: https://console.cloud.google.com/billing/
- **Cloud Run Metrics**: https://console.cloud.google.com/run
- **Firestore Usage**: https://console.firebase.google.com/project/resume-app-10864/firestore
- **Budget Alerts**: https://console.cloud.google.com/billing/budgets

### CLI Monitoring

```powershell
# Current month costs
gcloud billing accounts list
gcloud billing accounts get-billing-account resume-app-10864

# Cloud Run metrics
gcloud run services describe career-backend `
  --region asia-south1 `
  --format="yaml(status.traffic)"

# Firestore stats
gcloud firestore operations list
```

### Expected Costs

| Service | Free Tier | Expected Monthly |
|---------|-----------|------------------|
| Firebase Hosting | 10GB | $0 |
| Cloud Run | 2M requests | $0 (low traffic) |
| Firestore | 50K reads/day | ~$0.01 |
| Gemini API | Pay per use | ~$0.05/parse |
| **Total** | | **~$1-5/month** |

---

## Maintenance

### Regular Tasks

**Weekly**:
- Check error logs
- Review usage metrics
- Test critical endpoints

**Monthly**:
- Review costs
- Update dependencies
- Backup database (if needed)
- Security audit

**Quarterly**:
- Rotate credentials
- Review access logs
- Update documentation

### Updates

**Backend Dependencies**:
```powershell
cd resume_pipeline
pip list --outdated
pip install --upgrade <package>
pip freeze > requirements.txt
```

**Frontend Dependencies**:
```powershell
cd frontend
npm outdated
npm update
npm audit fix
```

**Redeploy After Updates**:
```powershell
.\redeploy.ps1
```

---

## Support & Resources

### Documentation

- **Project README**: [README.md](README.md)
- **Architecture Guide**: [ARCHITECTURE.md](ARCHITECTURE.md)
- **Implementation Guide**: [IMPLEMENTATION_GUIDE.md](IMPLEMENTATION_GUIDE.md)
- **API Reference**: http://localhost:8000/docs

### External Resources

- [FastAPI Docs](https://fastapi.tiangolo.com)
- [Cloud Run Docs](https://cloud.google.com/run/docs)
- [Firestore Docs](https://firebase.google.com/docs/firestore)
- [Firebase Hosting Docs](https://firebase.google.com/docs/hosting)
- [Vite Docs](https://vitejs.dev)

### Contact

- **Issues**: Create GitHub issue
- **Email**: your-email@gmail.com

---

**Last Updated**: January 23, 2026  
**Deployment Version**: 2.0  
**Status**: ✅ Production Ready
