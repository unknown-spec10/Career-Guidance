# Career Guidance AI Documentation Index

Welcome to the documentation vault for the Career Guidance AI platform. This directory contains high-level guides, deployment instructions, and deep-dive technical specs for every major service.

---

## 📋 Core System Docs

- **[ARCHITECTURE.md](./ARCHITECTURE.md)**: Current system overview, monorepo structure, and active runtime boundaries.
- **[DATABASE.md](./DATABASE.md)**: Unified PostgreSQL data model, relational schemas, and cleanup rules.
- **[QUICK_REFERENCE.md](./QUICK_REFERENCE.md)**: Daily command cheatsheet, HTTP endpoint maps, and common validation instructions.
- **[DEPLOYMENT.md](./DEPLOYMENT.md)**: Deployment procedures, environment parameters, and smoke-testing instructions.
- **[DELIVERY_SUMMARY.md](./DELIVERY_SUMMARY.md)**: State-of-the-app summary detailing the successful legacy domain drop.
- **[IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md)**: Step-by-step developer guidelines for adding new models and API contracts.

---

## 🛠️ Deep-Dive Architecture & Design Docs

- **[INTERVIEW_SYSTEM_ARCHITECTURE.md](./INTERVIEW_SYSTEM_ARCHITECTURE.md)**: Technical design of the resume-aware mock interview loop, linear memory history, and background FastAPI evaluator.
- **[RECOMMENDATION_ENGINE_ARCHITECTURE.md](./RECOMMENDATION_ENGINE_ARCHITECTURE.md)**: Exhaustive breakdown of the applicant-to-job matching pipeline, weighting parameters, and pgvector cosine similarities.
- **[VOICE_LAYER_DESIGN.md](./VOICE_LAYER_DESIGN.md)**: Decision matrix and design of the browser-native (Web Speech API) and backend-cloud (Groq Whisper large-v3) hybrid latency-hidden STT loop.
- **[LEARNING_PATH_ARCHITECTURE.md](./LEARNING_PATH_ARCHITECTURE.md)**: Dynamic skill-gap roadmaps, timeline planning, and YouTube Data API v3 trusted channel search integrations.
- **[RESUME_PARSE_PIPELINE_REDESIGN.txt](./RESUME_PARSE_PIPELINE_REDESIGN.txt)**: Original specifications for the Groq-Gemini hybrid extraction and two-pass skill normalization process.
- **[LIVE_INTERVIEW_ARCHITECTURE.md](./LIVE_INTERVIEW_ARCHITECTURE.md)**: Bidirectional, server-to-server WebSocket proxy using Google's Gemini Live API for real-time conversational interviews.
- **[LIVE_INTERVIEW_ROADMAP.md](./LIVE_INTERVIEW_ROADMAP.md)**: Multi-phase planning document detailing milestones to deliver the real-time live interview layer.

---

## 🎯 Active Product Scope

These documents reflect the current supported product boundaries:
- **Student Workflows**: Profile parsing, job matching, applications, skill roadmaps, and mock interview practice.
- **Recruiter/Employer Workflows**: Job postings, status controls, and applicant tracking pipelines.
- **Admin Workflows**: Global stats audit, manual review logs, and credit allocation policies.
- **PostgreSQL-Only Runtime**: The historical college portal and older multi-database (MySQL + Firestore) configurations have been deprecated and dropped.