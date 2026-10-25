# Career Guidance AI - Frontend (Student Scope)

Student-facing SPA for resume upload/parsing, job browsing and applications, recommendations, interview practice, learning paths, and credit-gated premium features. Built with React 18 + Vite 5 + Tailwind CSS (JavaScript/JSX).

> Scope note: employer/admin/mentor/analytics pages (Employer*, AdminDashboard, JobModerationPage, UserManagementPage, TalentPool*, ApplicantDetailsPage, JobApplicantsPage, InterviewFeedbackPage, InterviewSchedulerPage, RecruitmentAnalyticsPage, NetworkHubPage) were removed in the October 2026 student-scope cut. The kept page set is listed in `docs_wiki/PAGE_API_AUDIT.md`.

## Features

- **Resume upload & parse**: drag-and-drop upload with polling for parse status and a parsed-results view
- **Jobs & applications**: public listings, job details, apply flow, application tracking board
- **Recommendations**: AI recommendations with 24h cooldown + credit bypass, save/track actions
- **Interview practice**: session start/answer/finish lifecycle, results, skill-gap → learning-path flow
- **Learning paths**: session-generated roadmaps with progress tracking
- **Credits**: balance widget, transaction history, upgrade/downgrade toggles
- **RAG assistant**: docs-grounded Q&A (`AskPage`)

## Tech Stack

- **React 18**: functional components + hooks
- **Vite 5**: dev server (port 3000, proxies `/api` to `:8000`) and build
- **Tailwind CSS**, **Framer Motion**, **React Router**, **Lucide React**, **Axios**
- **Vitest + React Testing Library**: 88 tests across 14 files, mocked at the HTTP (`api`) boundary

## Getting Started

```bash
# Install dependencies
npm install

# Start development server (http://localhost:3000)
npm run dev

# Single test run (matches CI) / watch mode
npm test
npm run test:watch

# Lint + production build
npm run lint
npm run build
```

## Project Structure

```
frontend/
├── src/
│   ├── components/      # Reusable UI (CreditWidget, ApplicationTracker, Modal, SkillGapModal, ProtectedRoute, …)
│   ├── pages/           # Student views: StudentDashboard, StudentProfile, JobsPage, JobDetailsPage,
│   │                    #   ResultsPage, MyApplicationsPage, InterviewPage/Session/Results,
│   │                    #   LearningPathPage, MyLearningPathsPage, CandidateIntelligencePage,
│   │                    #   AskPage, TransactionHistoryPage, UpgradePage, auth pages, DashboardRouter
│   ├── hooks/           # useAuth, useInterviewSession, useResultsPolling, useToast, …
│   ├── utils/           # apiRetry (exponential backoff), secureStorage, …
│   └── config/          # api (axios instance / base URL), constants
├── vite.config.mjs / vitest.config.mjs
└── package.json
```

## API Integration

The frontend talks to the FastAPI backend (`VITE_API_URL`, default `http://localhost:8000`). Representative endpoints actually called by the kept pages:

- `POST /upload`, `POST /api/upload/resume` — upload resume file
- `POST /parse/{applicant_id}` — trigger offline parse
- `GET /api/applicant/{applicant_id}` — parsed profile + scorecard data
- `GET /api/jobs`, `GET /api/job/{jobId}`, `POST /api/jobs/{id}/apply`
- `POST /api/auth/register|login|verify-code|forgot-password|reset-password|…`, `GET /api/auth/me`
- `GET /api/credits/balance`, `GET /api/credits/transactions`
- `POST /api/interview/start|answer|finish/{id}`, `GET /api/interview/results/{id}`, learning-path + RAG endpoints

## Environment Variables

```env
VITE_API_URL=http://localhost:8000
```

(`VITE_API_BASE_URL` is also honored; see `src/config/api.js`.)

## Building for Production

```bash
npm run build
```

The build output goes to `dist/`, ready for deployment (Vercel SPA with `vercel.json` rewrites).
