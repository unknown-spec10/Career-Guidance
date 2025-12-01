# Developer Setup Guide

Complete guide for setting up the Career Guidance AI development environment.

## Quick Start (5 minutes)

### 1. Prerequisites Check
```powershell
# Check Python version (need 3.9+)
python --version

# Check Node.js (need 18+)
node --version

# Check MySQL
mysql --version
```

### 2. Clone and Setup Backend
```powershell
# Navigate to project
cd "D:\Career Guidence"

# Create virtual environment
python -m venv myenv

# Activate (Windows PowerShell)
myenv\Scripts\Activate.ps1

# Install dependencies
cd resume_pipeline
pip install -r requirements.txt
```

### 3. Configure Environment
```powershell
# Copy example config
cp ..\.env.example ..\.env

# Edit .env with your credentials
notepad ..\.env
```

Required environment variables:
```env
GEMINI_API_KEY=your_key_here
MYSQL_HOST=localhost
MYSQL_USER=root
MYSQL_PASSWORD=your_password
MYSQL_DB=resumes
```

### 4. Start Backend
```powershell
# From resume_pipeline directory
uvicorn resume_pipeline.app:app --reload --port 8000
```

### 5. Setup Frontend (New Terminal)
```powershell
cd "D:\Career Guidence\frontend"
npm install
npm run dev
```

### 6. Access Application
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs

## Detailed Setup

### Database Initialization

Database is created automatically on first startup. To manually seed:

```powershell
cd resume_pipeline

# Seed with 50 applicants, 10 colleges, 40 jobs
python scripts/seed_database.py

# Verify data
python scripts/verify_data.py
```

### Development Workflow

#### Backend Development
```powershell
# Activate environment
myenv\Scripts\Activate.ps1

# Start server with auto-reload
cd resume_pipeline
uvicorn resume_pipeline.app:app --reload --port 8000

# Run tests
pytest tests/ -v

# Check code style
flake8 resume_pipeline/
```

#### Frontend Development
```powershell
cd frontend

# Start dev server (with HMR)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Project Structure

```
Career Guidence/
├── .env                          # Environment config (SECRET)
├── .env.example                  # Example config
├── .gitignore                    # Git ignore rules
├── README.md                     # Main documentation
│
├── myenv/                        # Python virtual environment
│
├── data/                         # Application data
│   └── raw_files/               # Uploaded resumes
│
├── resume_pipeline/              # Backend
│   ├── requirements.txt         # Python dependencies
│   ├── skill_taxonomy.json      # Skill database
│   │
│   ├── resume_pipeline/         # Main package
│   │   ├── __init__.py
│   │   ├── app.py              # FastAPI application
│   │   ├── db.py               # Database models (SQLAlchemy)
│   │   ├── config.py           # Configuration loader
│   │   ├── utils.py            # Utility functions
│   │   │
│   │   ├── resume/             # Resume parsing module
│   │   │   ├── parse_service.py           # Main parser service
│   │   │   ├── llm_gemini.py             # Gemini integration
│   │   │   ├── preprocessor.py           # Text preprocessing
│   │   │   ├── skill_taxonomy_builder.py # Skill extraction
│   │   │   ├── skill_mapper_simple.py    # Skill mapping
│   │   │   └── validators_numeric.py     # Data validation
│   │   │
│   │   ├── college/            # College recommendation
│   │   │   └── recommender.py
│   │   │
│   │   └── core/               # Core interfaces
│   │       └── interfaces.py
│   │
│   ├── scripts/                # Utility scripts
│   │   ├── init_db.py         # Initialize database
│   │   ├── seed_database.py   # Seed sample data
│   │   ├── verify_data.py     # Verify data integrity
│   │   └── build_skill_taxonomy.py  # Build skill DB
│   │
│   └── tests/                  # Unit tests
│       ├── test_api.py        # API endpoint tests
│       ├── test_parsing.py    # Parser tests
│       └── test_google_search.py  # Google Search tests
│
└── frontend/                   # React frontend
    ├── package.json           # Node dependencies
    ├── vite.config.js         # Vite configuration
    ├── tailwind.config.js     # Tailwind CSS config
    ├── index.html             # HTML entry point
    │
    ├── public/                # Static assets
    │
    └── src/                   # Source code
        ├── main.jsx          # React entry point
        ├── App.jsx           # Main app component
        ├── index.css         # Global styles
        │
        ├── components/       # Reusable components
        │   ├── Navbar.jsx
        │   ├── Hero.jsx
        │   ├── Features.jsx
        │   ├── UploadSection.jsx
        │   └── Footer.jsx
        │
        └── pages/            # Application pages
            ├── DashboardPage.jsx
            ├── ApplicantsPage.jsx
            ├── ApplicantDetailsPage.jsx
            ├── CollegesPage.jsx
            ├── CollegeDetailsPage.jsx
            ├── JobsPage.jsx
            ├── JobDetailsPage.jsx
            └── ResultsPage.jsx
```

## API Endpoints Reference

### Core Operations

#### Statistics
```http
GET /api/stats
Response: { total_applicants, total_colleges, total_jobs, avg_college_match, avg_job_match }
```

#### Applicants
```http
GET /api/applicants?skip=0&limit=50
GET /api/applicant/{id}
POST /upload (multipart/form-data)
POST /parse/{applicant_id}
```

#### Colleges
```http
GET /api/colleges?skip=0&limit=20
GET /api/college/{id}
```

#### Jobs
```http
GET /api/jobs?location=Bangalore&work_type=remote&skip=0&limit=20
GET /api/job/{id}
```

#### Recommendations
```http
GET /api/recommendations/{applicant_id}
Response: { college_recommendations: [...], job_recommendations: [...] }
```

## Database Schema

### Tables Overview
1. **users** - User accounts
2. **applicants** - Applicant profiles
3. **uploads** - File uploads
4. **llm_parsed_records** - Parsed data
5. **embeddings_index** - Vector embeddings
6. **colleges** - College master
7. **college_eligibility** - Admission criteria
8. **college_programs** - Programs offered
9. **college_metadata** - Additional info
10. **college_applicability_logs** - Recommendations
11. **employers** - Companies
12. **jobs** - Job listings
13. **job_metadata** - Job info
14. **job_recommendations** - Job matches
15. **canonical_skills** - Skill taxonomy
16. **audit_logs** - Activity logs
17. **human_reviews** - Manual corrections

## Common Tasks

### Add New API Endpoint

1. Edit `resume_pipeline/resume_pipeline/app.py`:
```python
@app.get("/api/your-endpoint")
async def your_endpoint():
    db = SessionLocal()
    try:
        # Your logic here
        return {"data": result}
    finally:
        db.close()
```

2. Test at http://localhost:8000/docs

### Add New Frontend Page

1. Create `frontend/src/pages/YourPage.jsx`:
```jsx
export default function YourPage() {
  return <div>Your content</div>
}
```

2. Add route in `frontend/src/App.jsx`:
```jsx
import YourPage from './pages/YourPage'

// In Routes:
<Route path="/your-path" element={<YourPage />} />
```

3. Add nav link in `Navbar.jsx`

### Update Database Schema

1. Modify models in `db.py`
2. Delete database to recreate:
```sql
DROP DATABASE resumes;
```
3. Restart server (auto-creates DB)
4. Reseed data: `python scripts/seed_database.py`

## Troubleshooting

### Port Already in Use
```powershell
# Find process on port 8000
netstat -ano | findstr :8000

# Kill process
taskkill /PID <process_id> /F
```

### Database Connection Failed
```powershell
# Check MySQL service
Get-Service -Name MySQL*

# Start MySQL
Start-Service MySQL80
```

### Module Not Found
```powershell
# Ensure virtual environment is activated
myenv\Scripts\Activate.ps1

# Reinstall dependencies
pip install -r requirements.txt --force-reinstall
```

### Frontend Build Errors
```powershell
# Clear cache and reinstall
rm -r node_modules package-lock.json
npm install
```

## Development Tips

### Hot Reload
- Backend: `--reload` flag auto-restarts on file changes
- Frontend: Vite HMR updates instantly

### Debugging
- Backend: Add `import pdb; pdb.set_trace()` for breakpoints
- Frontend: Use React DevTools browser extension

### Database Inspection
```powershell
# Connect to MySQL
mysql -u root -p

# Use database
USE resumes;

# Show tables
SHOW TABLES;

# Query data
SELECT * FROM applicants LIMIT 5;
```

### API Testing
- Use Swagger UI: http://localhost:8000/docs
- Or use tools like Postman, Insomnia

## Git Workflow

```powershell
# Create feature branch
git checkout -b feature/your-feature

# Make changes and commit
git add .
git commit -m "Add: your feature description"

# Push to remote
git push origin feature/your-feature
```

## Environment Variables Reference

| Variable | Description | Required | Example |
|----------|-------------|----------|---------|
| GEMINI_API_KEY | Google Gemini API key | Yes | AIzaSy... |
| GOOGLE_SEARCH_API_KEY | Google Custom Search key | No | AIzaSy... |
| GOOGLE_CSE_ID | Custom Search Engine ID | No | 012345... |
| MYSQL_HOST | Database host | Yes | localhost |
| MYSQL_PORT | Database port | Yes | 3306 |
| MYSQL_USER | Database user | Yes | root |
| MYSQL_PASSWORD | Database password | Yes | password |
| MYSQL_DB | Database name | Yes | resumes |
| FILE_STORAGE_PATH | Upload directory | Yes | ./data/raw_files |

## Performance Optimization

### Backend
- Use database indexes (already configured)
- Enable query caching
- Implement pagination (already done)
- Use connection pooling

### Frontend
- Code splitting with React.lazy()
- Image optimization
- Memoization with useMemo/useCallback
- Virtual scrolling for large lists

## New Components & Features (v2.0)

### Frontend Components

#### Error Boundaries
```jsx
// ErrorBoundary.jsx - Catches React errors
<ErrorBoundary>
  <YourComponent />
</ErrorBoundary>
```

Features:
- Catches component errors
- Shows fallback UI
- Recovery options (reload, go home, report)
- Error logging for debugging

#### Skeleton Loaders
```jsx
import SkeletonLoader from './components/SkeletonLoader';

// 6 variants available
<SkeletonLoader variant="stats" count={4} />
<SkeletonLoader variant="card" count={3} />
<SkeletonLoader variant="table" rows={5} />
<SkeletonLoader variant="list" items={10} />
<SkeletonLoader variant="profile" />
<SkeletonLoader variant="dashboard" />
```

Use instead of spinners for better perceived performance.

#### Progressive Lists
```jsx
import ProgressiveList from './components/ProgressiveList';

<ProgressiveList
  items={largeArray}
  initialCount={20}
  loadMoreCount={20}
  renderItem={(item) => <YourItem data={item} />}
/>
```

Features:
- Paginated rendering
- Load more button
- Smooth animations
- Performance optimized

#### Toast Notifications
```jsx
import { useToast } from './hooks/useToast';

function YourComponent() {
  const toast = useToast();
  
  const handleAction = () => {
    toast.success('Action successful!');
    toast.error('Something went wrong');
    toast.info('Informational message');
    toast.warning('Warning message');
  };
}
```

Replace all `alert()` calls with toast for consistency.

#### Optimistic Updates
```jsx
import { useOptimistic } from './hooks/useOptimistic';

const [optimisticStatus, updateOptimistic] = useOptimistic(
  initialStatus,
  (currentStatus, newStatus) => newStatus
);

// Update UI immediately, rollback on error
updateOptimistic(newValue);
await apiCall();  // If fails, automatically rolls back
```

### Backend Utilities

#### Input Sanitization
```python
from utils import sanitize_text, sanitize_dict, sanitize_filename, validate_email

# Sanitize user input
safe_title = sanitize_text(user_input)

# Sanitize entire dictionary
safe_data = sanitize_dict(request_data)

# Validate email
if not validate_email(email):
    raise ValueError("Invalid email")

# Sanitize filenames
safe_filename = sanitize_filename(uploaded_filename)
```

#### Email Sending
```python
from email_verification import send_verification_code_email, send_password_reset_code_email

# Send verification code
code = "123456"
send_verification_code_email(
    to_email="user@example.com",
    code=code,
    user_name="John Doe"
)

# Send password reset code
send_password_reset_code_email(
    to_email="user@example.com",
    code=code
)
```

#### Environment Validation
```python
# In app.py startup
def validate_env():
    """Validates required environment variables on startup"""
    required = ["SECRET_KEY", "MYSQL_HOST", "MYSQL_USER", "GEMINI_API_KEY"]
    missing = [var for var in required if not os.getenv(var)]
    if missing:
        raise EnvironmentError(f"Missing: {', '.join(missing)}")
```

### Frontend Utilities

#### Sanitization
```javascript
import {
  sanitizeInput,
  sanitizeHTML,
  sanitizeURL,
  sanitizeEmail,
  sanitizeFilename,
  sanitizeObject
} from './utils/sanitize';

// Sanitize text input
const safe = sanitizeInput(userInput);

// Remove HTML tags
const plainText = sanitizeHTML(richText);

// Validate URL
const safeUrl = sanitizeURL(userUrl);

// Sanitize entire object
const safeData = sanitizeObject(formData);
```

Always sanitize user input before sending to backend!

### Authentication Flow

#### Registration
1. User fills form → sanitize inputs
2. POST `/api/auth/register` with email, password, role
3. Backend creates user, sends verification code via email
4. User enters 6-digit code
5. POST `/api/auth/verify` with email and code
6. Account activated, redirect to login

#### Login
1. User enters credentials → sanitize email
2. POST `/api/auth/login` with email and password
3. Backend validates, returns JWT token
4. Store token in secureStorage
5. Redirect to role-specific dashboard

#### Password Reset
1. User clicks "Forgot password?"
2. Enters email → sanitize
3. POST `/api/auth/forgot-password`
4. Backend sends 6-digit code via email (30-min expiry)
5. User enters code and new password
6. POST `/api/auth/reset-password`
7. Password updated, redirect to login

### Security Features Implemented

#### XSS Protection
- Client-side sanitization in `sanitize.js`
- Server-side sanitization in `utils.py`
- HTML escape for text fields
- Tag removal for rich text
- URL protocol validation

#### Authentication
- JWT tokens with expiration
- bcrypt password hashing
- Email verification required
- Role-based access control (Student, College, Employer, Admin)

#### Rate Limiting
```python
# In app.py
from slowapi import Limiter

limiter = Limiter(key_func=lambda: request.client.host)

@app.post("/api/auth/login")
@limiter.limit("5/minute")  # Max 5 attempts per minute
async def login(...):
    pass
```

Applied to:
- Login endpoint (5/minute)
- Registration (3/minute)
- Password reset (3/minute)

## Security Checklist

- [x] API keys in .env (not committed)
- [x] CORS configured properly
- [x] Input validation with Pydantic
- [x] SQL injection protection (SQLAlchemy)
- [x] File upload validation
- [x] Rate limiting (login, register, password reset)
- [x] Authentication/Authorization (JWT + roles)
- [x] XSS protection (client + server sanitization)
- [x] Password hashing (bcrypt)
- [x] Email verification
- [ ] HTTPS in production (deployment step)

---

Happy coding! 🚀
