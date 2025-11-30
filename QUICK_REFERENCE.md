# Quick Reference Guide

## Start Development Environment

### Option 1: Quick Start (PowerShell)
```powershell
# Terminal 1 - Backend
cd "D:\Career Guidence\resume_pipeline"
..\myenv\Scripts\Activate.ps1
uvicorn resume_pipeline.app:app --reload --port 8000

# Terminal 2 - Frontend
cd "D:\Career Guidence\frontend"
npm run dev
```

### Option 2: One-Line Commands
```powershell
# Backend
cd "D:\Career Guidence" ; .\myenv\Scripts\Activate.ps1 ; cd resume_pipeline ; uvicorn resume_pipeline.app:app --reload --port 8000

# Frontend (new terminal)
cd "D:\Career Guidence\frontend" ; npm run dev
```

## URLs
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Documentation**: http://localhost:8000/docs
- **Alternative API Docs**: http://localhost:8000/redoc

## Database Commands

### MySQL Commands
```sql
-- Connect
mysql -u root -p

-- Use database
USE resumes;

-- Show all tables
SHOW TABLES;

-- Count records
SELECT 'applicants' as table_name, COUNT(*) as count FROM applicants
UNION ALL
SELECT 'colleges', COUNT(*) FROM colleges
UNION ALL
SELECT 'jobs', COUNT(*) FROM jobs;

-- View recent applicants
SELECT id, display_name, location_city, created_at 
FROM applicants 
ORDER BY created_at DESC 
LIMIT 10;

-- View top colleges
SELECT c.name, c.location_city, e.min_jee_rank, e.min_cgpa
FROM colleges c
LEFT JOIN college_eligibility e ON c.id = e.college_id
ORDER BY e.min_jee_rank
LIMIT 10;

-- Recommendations summary
SELECT 
    COUNT(*) as total_recs,
    AVG(recommend_score) as avg_score,
    MIN(recommend_score) as min_score,
    MAX(recommend_score) as max_score
FROM college_applicability_logs;
```

### Python Database Scripts
```powershell
# Seed database with sample data
python scripts/seed_database.py

# Verify data integrity
python scripts/verify_data.py

# Initialize/reset database
python scripts/init_db.py
```

## API Quick Tests

### Using curl
```powershell
# Get statistics
curl http://localhost:8000/api/stats

# Get all applicants
curl http://localhost:8000/api/applicants

# Get specific applicant
curl http://localhost:8000/api/applicant/1

# Get colleges
curl http://localhost:8000/api/colleges

# Get jobs (with filters)
curl "http://localhost:8000/api/jobs?location=Bangalore&work_type=remote"

# Get recommendations
curl http://localhost:8000/api/recommendations/1
```

### Using PowerShell
```powershell
# Get statistics
Invoke-RestMethod -Uri "http://localhost:8000/api/stats"

# Get applicants
Invoke-RestMethod -Uri "http://localhost:8000/api/applicants" | ConvertTo-Json -Depth 5

# Upload file (example)
$headers = @{ "Content-Type" = "multipart/form-data" }
$form = @{
    resume = Get-Item -Path "path/to/resume.pdf"
    jee_rank = 5000
    location = "Delhi"
}
Invoke-RestMethod -Uri "http://localhost:8000/upload" -Method Post -Form $form
```

## Frontend Routes

| Route | Description |
|-------|-------------|
| `/` | Home page (hero, features, upload) |
| `/dashboard` | Statistics dashboard |
| `/applicants` | All applicants list |
| `/applicant/:id` | Applicant details with recommendations |
| `/colleges` | All colleges list |
| `/college/:id` | College details with programs |
| `/jobs` | Job listings with filters |
| `/job/:id` | Job details |
| `/results/:id` | Resume parsing results |

## Common Development Tasks

### Add New Table
1. Edit `resume_pipeline/resume_pipeline/db.py`
2. Add SQLAlchemy model
3. Restart server (auto-creates table)

### Add New API Endpoint
1. Edit `resume_pipeline/resume_pipeline/app.py`
2. Add route with proper imports
3. Test at `/docs`

### Add New Frontend Page
1. Create `frontend/src/pages/NewPage.jsx`
2. Add route in `frontend/src/App.jsx`
3. Add nav link in `Navbar.jsx`

### Update Dependencies
```powershell
# Backend
pip install new-package
pip freeze > requirements.txt

# Frontend
npm install new-package
# package.json is auto-updated
```

## Environment Variables

Copy from `.env.example` to `.env`:
```env
# Required
GEMINI_API_KEY=your_gemini_key
MYSQL_PASSWORD=your_mysql_password

# Optional (defaults shown)
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_DB=resumes
FILE_STORAGE_PATH=./data/raw_files
```

## Keyboard Shortcuts (VS Code)

- `Ctrl + Shift + P` - Command palette
- `Ctrl + Shift + F` - Search in all files
- `Ctrl + P` - Quick file open
- `Ctrl + Shift + K` - Delete line
- `Alt + Up/Down` - Move line up/down
- `Ctrl + /` - Toggle comment
- `F5` - Start debugging

## Git Commands

```powershell
# Status
git status

# Stage changes
git add .

# Commit
git commit -m "Your message"

# Create branch
git checkout -b feature/new-feature

# Switch branch
git checkout main

# Pull latest
git pull origin main

# Push changes
git push origin feature/new-feature
```

## Debugging

### Backend Debugging
```python
# Add breakpoint
import pdb; pdb.set_trace()

# Print debugging
print(f"Debug: {variable}")
import json
print(json.dumps(dict_var, indent=2))

# Logging
import logging
logger = logging.getLogger(__name__)
logger.info("Info message")
logger.error("Error message")
```

### Frontend Debugging
```javascript
// Console logging
console.log('Debug:', variable)
console.table(arrayData)

// React DevTools (Browser Extension)
// Inspect component props and state

// Network tab (F12)
// View API requests/responses
```

## Performance Monitoring

### Check Backend Performance
```powershell
# View logs
uvicorn resume_pipeline.app:app --log-level debug

# Profile endpoint
Measure-Command { Invoke-RestMethod http://localhost:8000/api/stats }
```

### Check Frontend Performance
- Open DevTools (F12) → Lighthouse tab
- Run audit
- Check bundle size in Network tab

## Useful VS Code Extensions

- Python (Microsoft)
- Pylance
- ESLint
- Prettier
- Tailwind CSS IntelliSense
- GitLens
- Thunder Client (API testing)

## Troubleshooting Quick Fixes

### Backend won't start
```powershell
# Check if port 8000 is in use
netstat -ano | findstr :8000

# Kill process
taskkill /PID <pid> /F

# Verify virtual env
where python
# Should show: D:\Career Guidence\myenv\Scripts\python.exe
```

### Frontend won't start
```powershell
# Clear cache
rm -r node_modules
npm install

# Check port 3000
netstat -ano | findstr :3000
```

### Database issues
```powershell
# Check MySQL service
Get-Service MySQL*

# Start service
Start-Service MySQL80

# Reset database
mysql -u root -p -e "DROP DATABASE IF EXISTS resumes; CREATE DATABASE resumes;"
```

## File Locations

| Item | Path |
|------|------|
| Backend Config | `resume_pipeline/resume_pipeline/config.py` |
| Database Models | `resume_pipeline/resume_pipeline/db.py` |
| API Routes | `resume_pipeline/resume_pipeline/app.py` |
| Frontend Entry | `frontend/src/main.jsx` |
| Routing | `frontend/src/App.jsx` |
| Styles | `frontend/src/index.css` |
| Environment | `.env` (root) |
| Dependencies | `resume_pipeline/requirements.txt`, `frontend/package.json` |

## Data Stats (Current Seed)

- **Applicants**: 50
- **Colleges**: 10
- **Jobs**: 40
- **Employers**: 12
- **College Programs**: 28
- **College Recommendations**: 189 (avg 82.6% match)
- **Job Recommendations**: 255 (avg 78.4% match)
- **Canonical Skills**: 15

## Support

- API Documentation: http://localhost:8000/docs
- React Documentation: https://react.dev
- FastAPI Documentation: https://fastapi.tiangolo.com
- Tailwind CSS: https://tailwindcss.com/docs

---

Last Updated: November 26, 2025
