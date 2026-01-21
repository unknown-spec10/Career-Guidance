# Career Guidance AI System

An AI-powered career guidance platform that provides intelligent resume parsing, college recommendations, and job matching using advanced NLP and machine learning techniques.

## 🚀 Features

### Core Functionality
- **AI Resume Parsing**: Extract structured data from resumes using Google Gemini AI
- **Smart College Recommendations**: Match applicants with suitable colleges based on eligibility and profile
- **Job Matching**: Intelligent job recommendations with skill-based scoring
- **Modern Web Interface**: React-based dashboard with real-time data visualization
- **Comprehensive Database**: Track applicants, colleges, jobs, and recommendations
- **RESTful API**: FastAPI backend with complete CRUD operations
- **Mock Interviews**: AI-powered practice sessions with skill assessments
- **Credit System**: Fair-use quota management to prevent API cost overruns

### Security & Authentication
- **User Authentication**: JWT-based authentication with role-based access control
- **Email Verification**: Gmail SMTP integration with HTML email templates
- **Password Reset**: Secure password reset with 6-digit verification codes
- **XSS Protection**: Comprehensive input sanitization on both client and server
- **Rate Limiting**: Protection against brute force attacks on sensitive endpoints

### UX Enhancements
- **Skeleton Loaders**: Smooth loading states with 6 variants (Stats, Card, Table, List, Profile, Dashboard)
- **Error Boundaries**: Graceful error handling with recovery options
- **Toast Notifications**: Consistent, accessible notifications across all actions
- **Optimistic Updates**: Instant UI feedback with automatic rollback on errors
- **Progressive Loading**: Paginated lists with smooth load-more functionality
- **Loading Animations**: Framer Motion animations for better perceived performance

## 📋 System Architecture

```
Career Guidance/
├── frontend/                    # React + Vite frontend
│   ├── src/
│   │   ├── components/         # Reusable UI components
│   │   ├── pages/              # Application pages
│   │   └── App.jsx             # Main app component
│   └── package.json
│
├── resume_pipeline/            # Python backend
│   ├── resume_pipeline/        # Main package
│   │   ├── app.py             # FastAPI application
│   │   ├── db.py              # Database models (18 tables)
│   │   ├── config.py          # Configuration management
│   │   ├── utils.py           # Utility functions
│   │   ├── resume/            # Resume parsing module
│   │   │   ├── parse_service.py
│   │   │   ├── llm_gemini.py
│   │   │   ├── preprocessor.py
│   │   │   └── skill_taxonomy_builder.py
│   │   ├── college/           # College recommendation
│   │   ├── interview/         # Mock interview system
│   │   └── core/              # Core interfaces
│   │
│   ├── scripts/               # Utility scripts
│   │   ├── init_db.py         # Initialize database
│   │   ├── seed_database.py   # Seed with sample data
│   │   └── verify_data.py     # Verify data integrity
│   │
│   └── tests/                 # Unit tests
│
├── data/                      # File storage
│   └── raw_files/            # Uploaded resumes
│
├── myenv/                    # Python virtual environment
├── .env                      # Environment variables (not in git)
├── .env.example             # Example environment config
└── README.md                # This file
```

## 🛠️ Technology Stack

### Backend
- **FastAPI**: High-performance web framework with async support
- **SQLAlchemy**: ORM for database operations
- **PyMySQL**: MySQL database driver
- **Google Gemini**: LLM for resume parsing & interview evaluation
- **Pydantic**: Data validation and serialization
- **JWT**: Token-based authentication
- **bcrypt**: Password hashing
- **smtplib**: Gmail SMTP email integration

### Frontend
- **React 18**: UI library with hooks
- **Vite**: Build tool and dev server
- **Tailwind CSS**: Utility-first CSS framework
- **Framer Motion**: Animation library for smooth transitions
- **Axios**: HTTP client with interceptors
- **React Router**: Client-side routing
- **Lucide React**: Modern icon library
- **Custom Hooks**: useToast, useOptimistic, useAuth for state management

### Database
- **MySQL**: Relational database with 18 tables
  - Core: Users, Applicants, Uploads, LLMParsedRecords
  - College-side: Colleges, Eligibility, Programs, Metadata, ApplicabilityLogs
  - Job-side: Employers, Jobs, JobMetadata, JobRecommendations
  - Interview: InterviewSessions, InterviewQuestions, InterviewAnswers
  - Credit: CreditAccounts, CreditTransactions, CreditUsageStats
  - Auxiliary: CanonicalSkills, AuditLogs, HumanReviews

## 🚦 Getting Started

### Prerequisites
- Python 3.9+
- Node.js 18+
- MySQL 8.0+
- Google Gemini API Key
- Gmail account (with app password for email verification)

### Backend Setup

1. **Clone and navigate to project**
```bash
cd "D:\Career Guidence"
```

2. **Create and activate virtual environment**
```bash
python -m venv myenv
myenv\Scripts\Activate.ps1  # Windows PowerShell
```

3. **Install dependencies**
```bash
cd resume_pipeline
pip install -r requirements.txt
```

4. **Configure environment**
```bash
# Copy .env.example to .env and fill in your credentials
cp .env.example .env
```

Edit `.env`:
```env
GEMINI_API_KEY=your_gemini_api_key_here
GOOGLE_SEARCH_API_KEY=your_google_search_key
GOOGLE_CSE_ID=your_custom_search_engine_id
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=your_password
MYSQL_DB=resumes
FILE_STORAGE_PATH=./data/raw_files
GMAIL_USER=your-email@gmail.com
GMAIL_APP_PASSWORD=your_16_char_app_password
```

5. **Initialize database** (automatic on first run)
```bash
# Database is created automatically when you start the server
# Or manually run:
python scripts/init_db.py
```

6. **Seed with sample data** (optional)
```bash
python scripts/seed_database.py
```

7. **Start backend server**
```bash
cd resume_pipeline
uvicorn resume_pipeline.app:app --reload --port 8000
```

Backend will be available at: `http://localhost:8000`
API docs at: `http://localhost:8000/docs`

### Frontend Setup

1. **Navigate to frontend directory**
```bash
cd frontend
```

2. **Install dependencies**
```bash
npm install
```

3. **Start development server**
```bash
npm run dev
```

Frontend will be available at: `http://localhost:3000`

---

## 📊 Database Schema

### Core Tables
- `users`: User accounts with roles (student/employer/college/admin)
- `applicants`: Applicant profiles with location preferences
- `uploads`: File uploads (resumes, marksheets)
- `llm_parsed_records`: Parsed resume data with confidence scores
- `embeddings_index`: Vector embeddings for semantic search

### College Recommendation
- `colleges`: College master data
- `college_eligibility`: Admission criteria (JEE, CGPA)
- `college_programs`: Available programs and courses
- `college_metadata`: Additional info (skills, popularity)
- `college_applicability_logs`: Recommendation history

### Job Matching
- `employers`: Company information
- `jobs`: Job listings with requirements
- `job_metadata`: Tags and popularity scores
- `job_recommendations`: Job matches with scoring

### Interview & Assessment
- `interview_sessions`: Mock interview sessions with scores
- `interview_questions`: Questions for each session
- `interview_answers`: Student answers with AI evaluation
- `skill_assessments`: Skill verification quizzes
- `learning_paths`: Personalized learning recommendations

### Credit System
- `credit_accounts`: User credit balances and refill timestamps
- `credit_transactions`: Audit log of all credit activity
- `credit_usage_stats`: Daily/weekly rate limiting counters
- `system_configuration`: Admin-configurable system settings

### Auxiliary
- `canonical_skills`: Standardized skill taxonomy
- `audit_logs`: System activity tracking
- `human_reviews`: Manual corrections and feedback

---

## 🔌 API Endpoints

### Statistics
- `GET /api/stats` - Dashboard statistics

### Applicants
- `GET /api/applicants` - List all applicants (paginated)
- `GET /api/applicant/{id}` - Get applicant details
- `POST /upload` - Upload resume
- `POST /parse/{applicant_id}` - Parse uploaded resume

### Colleges
- `GET /api/colleges` - List all colleges (paginated)
- `GET /api/college/{id}` - Get college details

### Jobs
- `GET /api/jobs?location={loc}&work_type={type}` - List jobs with filters
- `GET /api/job/{id}` - Get job details

### Recommendations
- `GET /api/recommendations/{applicant_id}` - Get recommendations for applicant

### Interviews
- `POST /api/interviews/start` - Start mock interview session
- `GET /api/interviews/{id}/questions` - Get next question
- `POST /api/interviews/{id}/submit-answer` - Submit and evaluate answer
- `GET /api/interviews/history` - View all interview sessions

### Credit System
- `GET /api/credits/balance` - User credit balance and usage
- `GET /api/credits/transactions` - Credit transaction history
- `POST /api/credits/check` - Validate eligibility before activity

### Authentication
- `POST /api/auth/register` - Register new account (verification email sent)
- `POST /api/auth/login` - Login and get JWT token
- `POST /api/auth/forgot-password` - Request password reset code
- `POST /api/auth/reset-password` - Reset password with code

---

## 📈 Data Flow

1. **Resume Upload**: User uploads resume through frontend
2. **File Storage**: Backend saves file and creates upload record
3. **AI Parsing**: Google Gemini extracts structured data
4. **Normalization**: Data is validated and normalized
5. **Skill Mapping**: Skills matched against canonical taxonomy
6. **Recommendation**: Scoring algorithm rates colleges/jobs
7. **Interview Optional**: Students can boost scores with mock interviews
8. **Display**: Results shown in interactive dashboard

---

## 🔐 Security

### Authentication & Authorization
- **JWT Tokens**: Secure bearer token authentication
- **Password Hashing**: bcrypt with salt for password storage
- **Role-Based Access**: Student, College, Employer, Admin roles
- **Email Verification**: Mandatory email verification with 6-digit codes
- **Password Reset**: Secure reset flow with time-limited codes (30-minute expiry)
- **Rate Limiting**: Protection on login, register, and password reset endpoints

### Data Protection
- **XSS Prevention**: Client-side and server-side input sanitization
  - HTML escape for text fields
  - Tag removal for rich text
  - URL protocol validation
  - Filename path traversal protection
- **SQL Injection**: SQLAlchemy ORM with parameterized queries
- **CSRF Protection**: Token validation for state-changing operations
- **File Upload Validation**: Type checking, size limits, secure storage
- **Environment Variables**: Sensitive data in `.env` (never committed)

---

## 📧 Email Verification Setup

This application uses Gmail SMTP to send email verification links to new users during registration.

### Setup Steps

#### 1. Enable 2-Factor Authentication on Gmail
1. Go to your Google Account: https://myaccount.google.com/
2. Navigate to **Security** → **2-Step Verification**
3. Follow the prompts to enable 2FA if not already enabled

#### 2. Generate App Password
1. Go to: https://myaccount.google.com/apppasswords
2. Select **App**: Choose "Mail" or "Other (Custom name)"
3. Select **Device**: Choose your device or enter a custom name
4. Click **Generate**
5. Copy the 16-character password (remove spaces)

#### 3. Configure Environment Variables
Update `.env`:
```env
GMAIL_USER=your-email@gmail.com
GMAIL_APP_PASSWORD=your-16-char-app-password
FRONTEND_URL=http://localhost:5173
```

**Important:**
- Use your full Gmail address for `GMAIL_USER`
- Use the 16-character App Password (not your regular Gmail password)
- For production, update `FRONTEND_URL` to your production domain

#### 4. Restart Backend Server
```bash
cd resume_pipeline
uvicorn resume_pipeline.app:app --reload
```

### Email Verification Flow
1. User registers on frontend
2. Backend generates secure verification token (32 bytes)
3. Email sent to user's inbox (valid for 24 hours)
4. User clicks verification link
5. Account activated, user can login with full access

### Troubleshooting Email Issues
- **Email not received**: Check spam/junk folder; verify credentials in `.env`
- **SMTPAuthenticationError**: Ensure 2FA enabled and using App Password
- **Connection refused**: Check firewall; verify Gmail SMTP not blocked
- **Token expired**: Tokens valid for 24 hours; use "Resend verification" link

---

## 💳 Credit System

### Overview
The credit-based quota system manages interview practice sessions and prevents API cost overruns.

### How It Works
- **Initial Credits**: 60 credits per new user
- **Auto-refill**: Every 7 days (max 2 weeks accumulation = 120 credits)
- **Cost per Activity**:
  - Full mock interview (30 min, 7 MCQ + 3 short answer): 10 credits
  - Micro-session (5 min, 1 question): 1 credit
  - Coding question generation: 2 credits
  - Project idea generation: 3 credits

### Features
✅ **Rolling 7-day refills** - Auto-refills every 7 days, max 2 weeks accumulation
✅ **Rate limiting** - Daily/weekly limits prevent abuse
✅ **Progressive difficulty** - Blocks full interviews if previous score < 40%
✅ **Smart bonuses** - Awards 5 credits for 20%+ score improvement
✅ **Transaction logging** - Complete audit trail
✅ **Admin management** - Admins can adjust credits for users

### Student Workflow
1. Login → See credit balance in dashboard widget
2. Navigate to Interview page
3. Choose session type (Full 10 credits or Micro 1 credit)
4. System checks eligibility (credits + rate limits)
5. Start session → Credits deducted immediately
6. Complete session → Possible bonus if score improved
7. View transaction history anytime

### Configuration
Located in `resume_pipeline/constants.py`:
```python
CREDIT_CONFIG = {
    "costs": {
        "full_interview": 10,
        "micro_session": 1,
        "coding_question": 2,
        "project_idea": 3
    },
    "limits": {
        "default_weekly_credits": 60,
        "max_daily_credits": 30,
        "max_micro_sessions_daily": 10,
        "max_full_interviews_weekly": 4,
        "refill_interval_days": 7,
        "max_accumulated_weeks": 2
    }
}
```

---

## 🎯 Mock Interviews & Skill Assessment

### Features
- **Interview Types**: Technical, HR, Behavioral, Mixed
- **Difficulty Levels**: Easy, Medium, Hard
- **Duration**: 30 minutes (full) or 5 minutes (micro-session)
- **Question Format**: Multiple Choice + Short Answer
- **AI Evaluation**: Real-time feedback using Google Gemini
- **Daily Limit**: Up to 10 sessions per day (rate limited by credits)
- **Score Validity**: 6 months (prompts retake for optimal recommendations)

### Interview Scoring
- **Excellent** (≥80%): +15 recommendation points
- **Good** (60-79%): +10 points
- **Average** (40-59%): +5 points
- **Below 40%**: No bonus, suggests micro-practice

### Personalized Learning Paths
After completing an interview, students receive:
- **Skill Gap Analysis**: Skills categorized as weak/moderate/strong
- **Recommended Courses**: From Udemy, Coursera, YouTube
- **Practice Problems**: From LeetCode, HackerRank, CodeChef
- **Project Suggestions**: Hands-on projects to build skills

### Google Search Integration
- **Coding Problems**: Fetched from LeetCode, HackerRank
- **Interview Questions**: From GeeksForGeeks, InterviewBit
- **Learning Resources**: Courses and tutorials from popular platforms
- **Caching**: 30-day cache to optimize API usage
- **Fallback**: Automatic Gemini generation if quota exhausted

### Pages
- `/dashboard/interview` - Interview dashboard and history
- `/dashboard/interview/:sessionId` - Live interview interface
- `/dashboard/interview/results/:sessionId` - Results and feedback
- `/dashboard/learning-path/:pathId` - Personalized learning resources

---

## 🧪 Testing

Run backend tests:
```bash
cd resume_pipeline
pytest tests/
```

Test specific module:
```bash
pytest tests/test_api.py -v
pytest tests/test_parsing.py -v
```

Sample data:
- Use files in `data/raw_files/*/sample_resume_*.txt` to exercise parsers

---

## 📝 Development

### Adding New Features

#### Backend
1. Add routes in `app.py`
2. Add models in `db.py`
3. Update constants in `constants.py`
4. Add schemas in `schemas.py`

#### Frontend
1. Create components in `src/components/`
2. Create pages in `src/pages/`
3. Add routes in `App.jsx`
4. Add navigation links in `Navbar.jsx`

#### Database
1. Update models in `db.py`
2. Delete database to recreate:
   ```sql
   DROP DATABASE resumes;
   ```
3. Restart server (auto-creates DB)
4. Reseed data: `python scripts/seed_database.py`

### Code Style
- **Backend**: Follow PEP 8
- **Frontend**: ESLint + Prettier
- **Type Hints**: Use in Python files
- **PropTypes/TypeScript**: For React components

---

## 🛠️ Development Workflow

### Backend Development
```bash
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

### Frontend Development
```bash
cd frontend

# Start dev server (with HMR)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Database Inspection
```bash
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
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc
- **Postman/Insomnia**: Import endpoints from Swagger

---

## 🚀 Deployment

### Pre-Deployment Checklist
- [ ] All tests passing (`pytest tests/`)
- [ ] No console errors in browser
- [ ] Email verification working
- [ ] File uploads functional
- [ ] Database migrations applied
- [ ] Environment variables configured
- [ ] CORS origins restricted to production domains
- [ ] Strong `SECRET_KEY` generated (32+ characters)
- [ ] Gmail app password created
- [ ] SSL certificate ready (recommended)

### Backend Deployment

#### Linux/Mac with Gunicorn
```bash
# Install Gunicorn
pip install gunicorn

# Run with 4 workers
gunicorn resume_pipeline.app:app \
  --workers 4 \
  --worker-class uvicorn.workers.UvicornWorker \
  --bind 0.0.0.0:8000 \
  --timeout 120 \
  --access-logfile logs/access.log \
  --error-logfile logs/error.log
```

#### Windows with NSSM (Non-Sucking Service Manager)
```powershell
# Download NSSM from https://nssm.cc/download
# Install service
nssm install CareerGuidanceAPI "D:\Career Guidence\myenv\Scripts\uvicorn.exe"
nssm set CareerGuidanceAPI AppParameters "resume_pipeline.app:app --host 0.0.0.0 --port 8000"
nssm set CareerGuidanceAPI AppDirectory "D:\Career Guidence\resume_pipeline"

# Start service
nssm start CareerGuidanceAPI
```

### Frontend Deployment
```bash
cd frontend

# Build optimized bundle
npm run build

# Output goes to dist/ folder
# Deploy dist/ folder to your hosting (Vercel, Netlify, AWS, etc.)
```

### Environment Variables (Production)
Create `.env` with:
```env
# Backend Security
SECRET_KEY=your_secret_key_here_minimum_32_characters
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# Database
MYSQL_HOST=your_prod_host
MYSQL_PORT=3306
MYSQL_USER=career_guidance_user
MYSQL_PASSWORD=strong_password_here
MYSQL_DB=resumes

# AI Services
GEMINI_API_KEY=your_gemini_api_key

# Email
GMAIL_USER=your-app-email@gmail.com
GMAIL_APP_PASSWORD=your_16_character_app_password

# Frontend
FRONTEND_URL=https://yourdomain.com
```

---

## 📦 Project Statistics

- **50 Applicants** with complete profiles
- **10 Colleges** with eligibility criteria
- **40 Job Listings** from 12 employers
- **444 Recommendations** (189 college + 255 job)
- **15 Canonical Skills** in taxonomy
- **~85% Average Match Score** for recommendations

---

## 🤝 Contributing

1. Create feature branch
2. Make changes with proper tests
3. Update documentation
4. Submit pull request

---

## 📄 License

This project is for educational purposes.

---

## 🐛 Troubleshooting

### Database Connection Issues
- Verify MySQL is running
- Check credentials in `.env`
- Ensure database exists (created automatically on startup)

### Frontend Not Loading
- Check backend is running on port 8000
- Verify CORS settings in `app.py`
- Clear browser cache

### Gemini API Errors
- Verify API key is valid
- Check rate limits
- Review error logs in terminal

### Email Issues
- Verify Gmail 2FA enabled
- Check app password (not regular password)
- Ensure GMAIL_USER and GMAIL_APP_PASSWORD set in `.env`

### Port Already in Use
```powershell
# Find process on port 8000
netstat -ano | findstr :8000

# Kill process
taskkill /PID <process_id> /F
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

---

## 📞 Support

For issues or questions, check the logs:
- Backend: Terminal running uvicorn
- Frontend: Browser console (F12)
- Database: MySQL logs

---

## 🎯 Future Enhancements

- [ ] Email notifications for recommendations
- [ ] Advanced filters and search
- [ ] Applicant portal for profile management
- [ ] College/employer dashboards
- [ ] ML-based recommendation scoring improvements
- [ ] Resume builder tool
- [ ] Interview preparation resources
- [ ] Career path visualization
- [ ] Skills gap analysis reports
- [ ] Integration with job boards
- [ ] Question/Answer caching to reduce API costs
- [ ] Abuse detection for rate limit enforcement
- [ ] Premium tier with higher credit limits
- [ ] Learning analytics and credit ROI tracking

---

## 📚 Key Components

### Frontend Components
- **ErrorBoundary**: Catches React errors with recovery UI
- **SkeletonLoader**: Loading states (Stats, Card, Table, List, Profile, Dashboard)
- **ProgressiveList**: Paginated lists with smooth loading
- **ToastContainer**: Consistent notification system
- **CreditWidget**: Displays credit balance and usage
- **Protected Routes**: Authentication-gated pages

### Backend Utilities
- **sanitize_text()**: Server-side XSS prevention
- **validate_email()**: RFC-compliant email validation
- **send_verification_code_email()**: HTML email templates
- **send_password_reset_code_email()**: Password reset emails
- **validate_env()**: Startup environment validation

### Core Services
- **ResumeParserService**: Orchestrates resume parsing pipeline
- **InterviewService**: Manages mock interview sessions and evaluation
- **CreditService**: Manages credit accounts and eligibility
- **RecommendationEngine**: Scores and ranks colleges/jobs

### Security Utilities
- **sanitizeInput()**: HTML escape for text
- **sanitizeHTML()**: Tag removal
- **sanitizeURL()**: Protocol validation
- **sanitizeEmail()**: Email normalization
- **sanitizeFilename()**: Path traversal prevention
- **sanitizeObject()**: Recursive object sanitization

---

**Last Updated**: January 17, 2026
**Version**: 3.0.0
