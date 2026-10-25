# Page ↔ API Audit (student-only scope)

> Executed October 2026: all 15 Cut pages (plus their 2 test files) were deleted
> from `frontend/src/pages/`; `/api/employer/*`, `/api/admin/*`, and `/api/mentor*`
> route handlers were removed from the backend. The table below is retained as the
> Keep/Cut source record.

Scope kept: resume parse, recommendations, interview practice. Everything employer/admin is Cut.
Date: 2026-10-22. Read-only audit; no code changed.

## Per-page table

| Page | Backend endpoints called | Real or Fake-Empty | Keep-or-Cut |
|---|---|---|---|
| StudentDashboard.jsx | `GET /api/student/applicant`, `GET /api/student/profile`, `GET /api/student/applications/jobs`, `GET /api/recommendations/{id}`, `GET /api/interview/history`, `POST /upload`, `POST /parse/{applicant_id}` | Real | Keep — core student entry |
| StudentProfile.jsx | `GET /api/auth/me`, `GET /api/recommendations/{id}`, `GET /api/student/resume/scorecard`, `GET /api/student/profile`, `GET /api/credits/balance`, `PATCH /api/auth/deactivate|profile|change-password`, `POST /api/upload/resume`, `POST /parse/{id}`, `POST|DELETE /api/auth/profile/picture`, link `GET /api/student/resume/preview` | Real | Keep |
| JobsPage.jsx | `GET /api/student/applications/jobs|applicant|profile`, `GET /api/recommendations/{id}`, `GET /api/credits/balance`, `POST /api/applicant/{id}/generate-recommendations`, `GET /api/jobs`, `POST /api/jobs/{id}/apply`, `GET /api/job/{id}` | Real | Keep |
| JobDetailsPage.jsx | `GET /api/job/{jobId}`, `GET /api/student/profile`, `GET /api/student/applications/jobs`, `POST /api/jobs/{jobId}/apply` | Real | Keep |
| ResultsPage.jsx | `GET /api/applicant/{applicantId}` (+ disabled Export Report button, no endpoint) | Real + dead button | Keep, remove/disclose button |
| InterviewPage.jsx | `GET /api/student/profile`, `GET /api/interview/active-session|history`, `POST /api/interview/start` (via hook) | Real | Keep |
| InterviewSessionPage.jsx | via hook: `GET /api/interview/session/{id}|…/questions`, `POST /api/interview/start|answer|finish/{id}|abandon/{id}`, `sendBeacon …/abandon-beacon/{id}`, `fetch …/hint/{answerId}`, `POST /api/interview/transcribe` | Real | Keep |
| InterviewResultsPage.jsx | `GET /api/interview/results/{id}` (hook), `fetch /api/interview/feedback/{qid}`, `fetch /api/interview/skill-gap-analysis/{id}`, `POST /api/interview/generate-learning-path/{id}` (via SkillGapModal) | Real ("Mock Practice Scorecard" = interview practice, not fake) | Keep |
| MyApplicationsPage.jsx | `GET /api/student/applications/jobs`, `PATCH /api/student/applications/{id}/status` | Real | Keep |
| MyLearningPathsPage.jsx | `GET /api/student/applicant`, `GET /api/learning-paths/applicant/{id}`, `POST /api/learning-paths/{id}/complete|delete|restore` | Real | Keep |
| LearningPathPage.jsx | `GET /api/learning-paths/{id}`, `POST /api/learning-paths/{id}/complete` | Real | Keep |
| CandidateIntelligencePage.jsx | `GET /api/interview/candidate-intelligence` | Real, honest empty state | Keep (merge into interview results if duplicative) |
| AskPage.jsx | `GET /api/rag/suggestions`, `POST /api/rag/ask` | Real | Keep (optional; only generic AI outside interview scope) |
| TransactionHistoryPage.jsx | `GET /api/credits/transactions` | Real | Keep (supports credit-gated recompute) |
| UpgradePage.jsx | `GET /api/credits/balance`, `POST /api/credits/upgrade|downgrade` | Real | Keep iff credits stay; else Cut |
| NetworkHubPage.jsx | `GET /api/mentors`, `POST /api/mentor-requests` | Real + honest empty ("no fabricated personas") | Cut from student MVP (no mentor data); keep only if mentors seeded |
| Login/Register/VerifyCode/ResendVerification/EmailVerification/ForgotPassword/ResetPassword | `POST /api/auth/login|register|verify-code|verify-email|resend-verification|forgot-password|reset-password`, `GET /api/auth/me`, redirect `GET /api/auth/google/login` | Real | Keep (auth shell) |
| DashboardRouter.jsx | none (role redirect) | N/A | Keep |
| EmployerDashboard / EmployerJobDetails / EmployerPostJob / EmployerProfile / JobApplicantsPage / InterviewFeedbackPage / InterviewSchedulerPage / RecruitmentAnalyticsPage / TalentPoolPage / TalentMatchDetails / ApplicantDetailsPage / AdminDashboard / JobModerationPage / UserManagementPage | employer/admin endpoints (`/api/employer/*`, `/api/admin/*`, `/api/search/semantic`, `/api/reviews/*`, `/api/embeddings/*`, `/api/interviews/schedule`, `/api/rag/*` admin) | Real (TalentPool `Unscored` badge and Admin removal of `job.id % 2` heuristic = no fabrication) | Cut from student-only scope |
| *.test.jsx (Jobs, Login) | mocked `api` in tests only, not shipped | Test-only mocks | N/A — do not ship |

No shipped page fabricates scores, users, or jobs. Only issues: disabled `Export Report` button (ResultsPage) and test-only `vi.mock` files.

## Backend routes no page calls (dead / out-of-scope for students)

- `PUT /api/student/profile` (pages use `PATCH /api/auth/profile` instead)
- `GET /api/parse/status/{id}`, `GET /api/pipeline-status/{id}`, `GET /api/applicant/{db_id}/pipeline-status`
- `GET /api/applicants` (list-all; pages fetch single `/api/applicant/{id}`)
- `PATCH /api/job-recommendation/{id}/save|status`, `PATCH /api/student/jobs/{id}/track`
- `POST /api/feedback`, `POST /api/credits/award-bonus`
- `POST /api/search/advanced`, `GET /api/reviews/applicant/{id}`, `GET /api/rag/rebuild-status`, `GET /api/interview/study-plan/{id}` (superseded by skill-gap flow)
- Infra/static: `GET /`, `/health`, `/api/health`, `GET /static/{path}`, `GET /api/auth/google/callback`
- All other `/api/employer/*`, `/api/admin/*`, `/api/embeddings/*` are called only by Cut pages above.

Recommendation: keep student routes + auth + credits + rag-ask; cut/shelve employer/admin/mentor/analytics routes from student deployment, or gate behind roles as today.
