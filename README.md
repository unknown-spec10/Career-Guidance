# Career Guidance AI System

An AI-powered career guidance platform that provides intelligent resume parsing, college recommendations, and job matching using advanced NLP and machine learning techniques.

## � Documentation

Complete documentation is in the **[`docs/`](docs/)** folder:

- **[ARCHITECTURE.md](docs/ARCHITECTURE.md)** - Complete system architecture, dual-database design, cost model
- **[DATABASE.md](docs/DATABASE.md)** - 🆕 Database reference (18 tables, repository pattern, CRUD operations)
- **[DEPLOYMENT.md](docs/DEPLOYMENT.md)** - Deployment guide for local, Docker, and GCP Cloud Run
- **[IMPLEMENTATION_GUIDE.md](docs/IMPLEMENTATION_GUIDE.md)** - Developer guide for repository pattern and features
- **[QUICK_REFERENCE.md](docs/QUICK_REFERENCE.md)** - Quick reference for common commands
- **[DELIVERY_SUMMARY.md](docs/DELIVERY_SUMMARY.md)** - Project delivery summary and handoff notes
- **[DOCS_INDEX.md](docs/DOCS_INDEX.md)** - Navigation hub for all documentation

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
- **Dual-Database**: MySQL (local dev) + Firestore (cloud production) via repository pattern

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
- **Local**: MySQL 8.0+ with 18 tables
  - Core: Users, Applicants, Uploads, LLMParsedRecords
  - College-side: Colleges, Eligibility, Programs, Metadata, ApplicabilityLogs
  - Job-side: Employers, Jobs, JobMetadata, JobRecommendations
  - Interview: InterviewSessions, InterviewQuestions, InterviewAnswers
  - Credit: CreditAccounts, CreditTransactions, CreditUsageStats
  - Auxiliary: CanonicalSkills, AuditLogs, HumanReviews
- **Cloud**: Firestore (serverless NoSQL, scale-to-zero, ~$0.01/month)
- **Switching**: Environment-based via `APP_ENV=local|cloud`

## 🚦 Quick Start

For detailed setup instructions, see [DEPLOYMENT.md](DEPLOYMENT.md).

### ⚡ 5-Minute Local Setup

```powershell
# 1. Backend
cd "D:\Career Guidence\resume_pipeline"
python -m venv ..\myenv
..\myenv\Scripts\Activate.ps1
pip install -r requirements.txt

# 2. Configure (copy .env.example to .env and fill credentials)
Copy-Item .env.example .env
# Edit .env with your API keys

# 3. Start backend
uvicorn resume_pipeline.app:app --reload --port 8000

# 4. Frontend (new terminal)
cd ..\frontend
npm install
npm run dev
```

**Access**:
- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs

### Environment Variables

Create `.env` in `resume_pipeline/`:
```env
# Database Selection
APP_ENV=local

# MySQL (Local)
MYSQL_HOST=localhost
MYSQL_USER=career_user
MYSQL_PASSWORD=yourpassword
MYSQL_DB=career_guidance

# AI Services
GEMINI_API_KEY=your_gemini_api_key
GROQ_API_KEY=your_groq_api_key

# Email (Gmail SMTP)
GMAIL_USER=your-email@gmail.com
GMAIL_APP_PASSWORD=your_16_char_app_password

# Security
SECRET_KEY=your-super-secret-jwt-key-min-32-chars

# Frontend
FRONTEND_URL=http://localhost:5173
CORS_ORIGINS=http://localhost:5173
```

**Get API Keys**:
- Gemini: https://aistudio.google.com/apikey
- Gmail App Password: https://myaccount.google.com/apppasswords

### Database Setup

**Option A: Docker (Recommended)**
```powershell
docker run -d --name career-mysql `
  -e MYSQL_ROOT_PASSWORD=rootpassword `
  -e MYSQL_DATABASE=career_guidance `
  -e MYSQL_USER=career_user `
  -e MYSQL_PASSWORD=yourpassword `
  -p 3306:3306 mysql:8.0
```

**Option B: Manual MySQL Installation**

Frontend will be available at: `http://localhost:3000`

---

## 📊 Database Schema

### Database Tables (MySQL Local / Firestore Cloud)

#### Core Tables/Collections
- `users`: User accounts with roles (student/employer/college/admin)
- `applicants`: Applicant profiles with location preferences
- `uploads`: File uploads (resumes, marksheets)
- `llm_parsed_records`: Parsed resume data with confidence scores
- `embeddings_index`: Vector embeddings for semantic search

#### College Recommendation
- `colleges`: College master data
- `college_eligibility`: Admission criteria (JEE, CGPA)
- `college_programs`: Available programs and courses
- `college_metadata`: Additional info (skills, popularity)
- `college_applicability_logs`: Recommendation history
- `college_recommendations`: Applicant → College matches

#### Job Matching
- `employers`: Company information
- `jobs`: Job listings with requirements
- `job_metadata`: Tags and popularity scores
- `job_recommendations`: Job matches with scoring

#### Interview & Assessment
- `interview_sessions`: Mock interview sessions with scores
- `interview_questions`: Questions for each session
- `interview_answers`: Student answers with AI evaluation
- `skill_assessments`: Skill verification quizzes
- `learning_paths`: Personalized learning recommendations

#### Credit System
- `credit_accounts`: User credit balances and refill timestamps
- `credit_transactions`: Audit log of all credit activity
- `credit_usage_stats`: Daily/weekly rate limiting counters
- `system_configuration`: Admin-configurable system settings

#### Auxiliary
- `canonical_skills`: Standardized skill taxonomy
- `audit_logs`: System activity tracking
- `human_reviews`: Manual corrections and feedback

---

## 🔌 API Endpoints

For complete API documentation, see [ARCHITECTURE.md](ARCHITECTURE.md#api-contracts).

### Key Endpoints

**Public**:
- `GET /api/stats` - Dashboard statistics
- `GET /api/colleges` - List colleges (paginated)
- `GET /api/jobs?location={loc}` - List active jobs
- `POST /upload` - Upload resume
- `POST /parse/{applicant_id}` - Parse resume

**Authenticated**:
- `GET /api/recommendations/{applicant_id}` - Get recommendations
- `POST /api/interview/start` - Start mock interview
- `GET /api/credit/account` - User credit balance
- `GET /api/interview/history` - Interview sessions

**Admin**:
- `POST /api/admin/college` - Create college
- `POST /api/admin/job` - Create job
- `GET /api/admin/users` - List all users

---

## 📈 Data Flow

1. **Resume Upload**: User uploads resume through frontend
2. **File Storage**: Backend saves file to `/data/raw_files/` (local) or `/tmp/data/` (cloud)
3. **AI Parsing**: Google Gemini extracts structured data (education, skills, experience)
4. **Normalization**: Data validated and normalized via Pydantic schemas
5. **Skill Mapping**: Skills matched against canonical taxonomy (word-boundary regex)
6. **Recommendation**: Scoring algorithm rates colleges/jobs:
   - 35% JEE rank
   - 25% CGPA
   - 25% skill match
   - 15% interview score
   - 20% academic/experience fit
7. **Interview Optional**: Students can boost scores with mock interviews (up to 15 points)
8. **Display**: Results shown in interactive dashboard with status tracking

---

## 🏗️ Repository Pattern Architecture

This project implements a **dual-database architecture** using the repository pattern:

**Local Development** (`APP_ENV=local`):
- Uses MySQL via SQLAlchemy
- Full SQL query support
- Complex JOINs and transactions
- Excellent debugging experience

**Cloud Production** (`APP_ENV=cloud`):
- Uses Firestore via firebase-admin
- Serverless, scale-to-zero
- ~$0.01/month when idle
- Auto-scaling for traffic

**Benefits**:
- ✅ Single codebase for both environments
- ✅ Database-agnostic business logic
- ✅ 95%+ cost savings vs Cloud SQL
- ✅ Easy testing with both backends

For implementation details, see [IMPLEMENTATION_GUIDE.md](IMPLEMENTATION_GUIDE.md).

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

For detailed development guides, see [IMPLEMENTATION_GUIDE.md](IMPLEMENTATION_GUIDE.md).

### Quick Development Workflow

**Backend**:
```powershell
cd resume_pipeline
myenv\Scripts\Activate.ps1
uvicorn resume_pipeline.app:app --reload --port 8000
pytest tests/ -v  # Run tests
```

**Frontend**:
```powershell
cd frontend
npm run dev      # Start dev server
npm run build    # Build for production
```

### Adding New Features

See [IMPLEMENTATION_GUIDE.md](IMPLEMENTATION_GUIDE.md#adding-new-features) for:
- Adding new repository interfaces
- Implementing MySQL/Firestore repositories
- Integrating with FastAPI routes
- Writing tests

### Database Inspection

**MySQL (Local)**:
```sql
mysql -u career_user -p
USE career_guidance;
SHOW TABLES;
SELECT * FROM applicants LIMIT 5;
```

**Firestore (Cloud)**:
```powershell
# View in Firebase Console
# https://console.firebase.google.com/project/resume-app-10864/firestore

# Or use gcloud
gcloud firestore documents list users --limit 5
```

---

## 🚀 Deployment

For complete deployment instructions, see [DEPLOYMENT.md](DEPLOYMENT.md).

### Quick Deploy to GCP

```powershell
# Deploy backend to Cloud Run
cd resume_pipeline
docker build -f Dockerfile.prod -t gcr.io/resume-app-10864/backend:latest .
docker push gcr.io/resume-app-10864/backend:latest
gcloud run deploy career-backend --image gcr.io/resume-app-10864/backend:latest

# Deploy frontend to Firebase Hosting
cd ../frontend
npm run build
firebase deploy --only hosting
```

**Automated**: Run `.\redeploy.ps1` from project root

### Production URLs

- **Frontend**: https://resume-app-10864.web.app
- **Backend**: https://career-backend-xxxx-uc.a.run.app
- **Firestore**: https://console.firebase.google.com/project/resume-app-10864/firestore

### Pre-Deployment Checklist

- [ ] All tests passing (`pytest tests/`)
- [ ] No console errors in browser
- [ ] Email verification working
- [ ] File uploads functional
- [ ] Environment variables configured in Cloud Run
- [ ] Firestore database created and seeded
- [ ] `APP_ENV=cloud` set in Cloud Run
- [ ] CORS origins updated for production
- [ ] Strong `SECRET_KEY` generated (32+ characters)
- [ ] SSL certificate ready (auto-provided by Cloud Run/Firebase)



### Backend Deployment

#### Linux/Mac with Gunicorn
```bash
# Install Gunicorn
pip install gunicorn

# Run with 4 workers
---

## 📦 Project Statistics

- **50+ Applicants** with complete profiles
- **10+ Colleges** with eligibility criteria
- **40+ Job Listings** from multiple employers
- **Dual Database**: MySQL (local) + Firestore (cloud)
- **18 Database Tables**: Users, Applicants, Colleges, Jobs, Recommendations, Interviews, Credits
- **~85% Average Match Score** for recommendations
- **Cost**: ~$0.01/month when idle on GCP

---

## 🐛 Troubleshooting

For detailed troubleshooting, see [DEPLOYMENT.md](DEPLOYMENT.md#troubleshooting).

### Common Issues

**Port already in use**:
```powershell
netstat -ano | findstr :8000
taskkill /PID <PID> /F
```

**MySQL connection refused**:
```powershell
# Check MySQL is running
Get-Service MySQL80
Start-Service MySQL80

# Test connection
mysql -h localhost -u career_user -p
```

**Gemini API errors**:
- Verify API key in `.env`
- Check rate limits: https://aistudio.google.com/apikey
- Test API key with sample request

**CORS errors in browser**:
- Verify `CORS_ORIGINS` includes frontend URL
- Restart backend after changing `.env`

**Firestore permission denied**:
```powershell
# Re-authenticate
gcloud auth application-default login

# Verify project
gcloud config get-value project
```

---

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Make changes with proper tests
4. Update documentation
5. Commit changes (`git commit -m 'Add amazing feature'`)
6. Push to branch (`git push origin feature/amazing-feature`)
7. Submit pull request

---

## 📄 License

This project is for educational purposes. See LICENSE file for details.

---

## 📞 Support & Resources

- **Documentation**: See [ARCHITECTURE.md](ARCHITECTURE.md), [DEPLOYMENT.md](DEPLOYMENT.md), [IMPLEMENTATION_GUIDE.md](IMPLEMENTATION_GUIDE.md)
- **API Docs**: http://localhost:8000/docs (when running locally)
- **Issues**: Create GitHub issue for bugs or feature requests

---

**Last Updated**: January 23, 2026  
**Version**: 2.0  
**Status**: ✅ Production Ready (Cloud + Local)
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
