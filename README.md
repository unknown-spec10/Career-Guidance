# Career Guidance AI System

An AI-powered career guidance platform that provides intelligent resume parsing, college recommendations, and job matching using advanced NLP and machine learning techniques.

## 🚀 Features

- **AI Resume Parsing**: Extract structured data from resumes using Google Gemini AI
- **Smart College Recommendations**: Match applicants with suitable colleges based on eligibility and profile
- **Job Matching**: Intelligent job recommendations with skill-based scoring
- **Modern Web Interface**: React-based dashboard with real-time data visualization
- **Comprehensive Database**: Track applicants, colleges, jobs, and recommendations
- **RESTful API**: FastAPI backend with complete CRUD operations

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
- **FastAPI**: High-performance web framework
- **SQLAlchemy**: ORM for database operations
- **PyMySQL**: MySQL database driver
- **Google Gemini**: LLM for resume parsing
- **Pydantic**: Data validation

### Frontend
- **React 18**: UI library
- **Vite**: Build tool and dev server
- **Tailwind CSS**: Utility-first CSS framework
- **Framer Motion**: Animation library
- **Axios**: HTTP client
- **React Router**: Client-side routing

### Database
- **MySQL**: Relational database with 18 tables
  - Core: Users, Applicants, Uploads, LLMParsedRecords
  - College-side: Colleges, Eligibility, Programs, Metadata, ApplicabilityLogs
  - Job-side: Employers, Jobs, JobMetadata, JobRecommendations
  - Auxiliary: CanonicalSkills, AuditLogs, HumanReviews

## 🚦 Getting Started

### Prerequisites
- Python 3.9+
- Node.js 18+
- MySQL 8.0+
- Google Gemini API Key

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

## 📊 Database Schema

### Core Tables
- `users`: User accounts with roles
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

### Auxiliary
- `canonical_skills`: Standardized skill taxonomy
- `audit_logs`: System activity tracking
- `human_reviews`: Manual corrections and feedback

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

## 📈 Data Flow

1. **Resume Upload**: User uploads resume through frontend
2. **File Storage**: Backend saves file and creates upload record
3. **AI Parsing**: Google Gemini extracts structured data
4. **Normalization**: Data is validated and normalized
5. **Skill Mapping**: Skills matched against canonical taxonomy
6. **Recommendation**: Matching algorithm scores colleges/jobs
7. **Display**: Results shown in interactive dashboard

## 🧪 Testing

Run backend tests:
```bash
cd resume_pipeline
pytest tests/
```

Test specific module:
```bash
pytest tests/test_api.py -v
```

## 📝 Development

### Adding New Features

1. **Backend**: Add routes in `app.py`, models in `db.py`
2. **Frontend**: Create components in `src/components/` or pages in `src/pages/`
3. **Database**: Update models in `db.py` and run migrations

### Code Style
- Backend: Follow PEP 8
- Frontend: ESLint + Prettier
- Use type hints in Python
- PropTypes/TypeScript for React components

## 🔒 Security

- API keys stored in `.env` (never commit)
- CORS configured for frontend origins
- Input validation with Pydantic
- SQL injection protection via SQLAlchemy ORM
- File upload validation (type, size)

## 📦 Project Statistics

- **50 Applicants** with complete profiles
- **10 Colleges** with eligibility criteria
- **40 Job Listings** from 12 employers
- **444 Recommendations** (189 college + 255 job)
- **15 Canonical Skills** in taxonomy
- **~85% Average Match Score** for recommendations

## 🤝 Contributing

1. Create feature branch
2. Make changes with proper tests
3. Update documentation
4. Submit pull request

## 📄 License

This project is for educational purposes.

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

## 📞 Support

For issues or questions, check the logs:
- Backend: Terminal running uvicorn
- Frontend: Browser console (F12)
- Database: MySQL logs

## 🎯 Future Enhancements

- [ ] Email notifications for recommendations
- [ ] Advanced filters and search
- [ ] Applicant portal for profile management
- [ ] College/employer dashboards
- [ ] ML-based recommendation scoring
- [ ] Resume builder tool
- [ ] Interview preparation resources
- [ ] Career path visualization
- [ ] Skills gap analysis
- [ ] Integration with job boards

---

**Last Updated**: November 26, 2025
**Version**: 1.0.0
