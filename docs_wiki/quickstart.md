# Docs Wiki Quickstart

Welcome to the **Career Guidance AI System** Docs Wiki! This repository contains comprehensive documentation organized into structured, agent-friendly sections to assist both developers and AI assistants.

## System Overview

The **Career Guidance AI System** is a platform designed to parse resumes with a rule-based offline engine, store parsed data in a PostgreSQL schema, calculate job recommendations, and simulate practice interview sessions.

---

## Documentation Index

Explore the codebase documentation sections below:

### 1. [Architecture Overview](architecture/overview.md)
Introduction to the monorepo design, database schema, and component layout.

*Detailed architectural guides:*
* **[System Architecture Guide](architecture/ARCHITECTURE.md)**: Diagrams and workflow specifications.
* **[Database Schema Reference](architecture/DATABASE.md)**: Explicit definitions for all 31 tables / 16 PG enums.
* **[Interview System Design](architecture/INTERVIEW_SYSTEM_ARCHITECTURE.md)**: DeepSeek-via-OpenCode mock interview service architecture.
* **[Learning Path Generation](architecture/LEARNING_PATH_ARCHITECTURE.md)**: Algorithms for generating candidate learning roadmaps.
* **[Real-time Live Interview Prep](architecture/LIVE_INTERVIEW_ARCHITECTURE.md)**: WebSockets and realtime connection layer design.
* **[Voice Layer Specifications](architecture/VOICE_LAYER_DESIGN.md)**: Architecture for real-time audio and voice synthesis.
* **[Quick Code Reference](architecture/QUICK_REFERENCE.md)**: Handy commands, file maps, and coding style rules.

---

### 2. Workflows & Algorithms
Detailed explanations of core system workflows:

* **[Workflows Summary](workflows/workflows.md)**: Overview of resume upload, parsing, scoring, and credit gating.
* **[Recommendation Engines](architecture/RECOMMENDATION_ENGINE_ARCHITECTURE.md)**: Math formulas, skill matching weights, and CGPA cutoff validation.
* **[Resume Parsing Redesign](workflows/RESUME_PARSE_PIPELINE_REDESIGN.md)**: Strategies for improving OCR and LLM data extraction accuracy.
* **[Interactive Interview Roadmap](workflows/LIVE_INTERVIEW_ROADMAP.md)**: Milestone implementations and checklists for next-generation interview features.
* **[Frontend Workflow Design](workflows/DESIGN.md)**: Component behaviors and navigation flows.

---

### 3. Setup & Operations
Commands, configurations, and deployment strategies:

* **[Operations & Commands](operations/operations.md)**: Local backend/frontend setup, seeding, and env vars reference.
* **[Frontend Quick Setup](workflows/SETUP.md)**: Running the React + Vite dev server.
* **[Deployment Manual](architecture/DEPLOYMENT.md)**: AWS EC2 (Dockerized Backend), Vercel (Frontend), and Supabase (Database).
* **[System Telemetry](architecture/telemetry.md)**: Monitoring tools, error boundary logging, and performance metrics.
* **[Delivery Verification](architecture/DELIVERY_SUMMARY.md)** and **[Implementation Guide](architecture/IMPLEMENTATION_GUIDE.md)**: Checklists to verify successful deployment builds.

---

### 4. Security & Testing
How we test the code and secure user accounts:

* **[Testing & Verification](operations/testing.md)**: Pytest suite parameters, mock testing, and ESLint rules.
* **[Security Audit Report](operations/security_audit_report.md)**: Detailed dependency analysis, vulnerabilities, and remediation roadmaps.

### 5. Implementation Status

* **[Implementation Status Register](IMPLEMENTATION_STATUS.md)**: Honest per-feature completion state (complete / partial / broken / mocked / missing / deferred). Read this before claiming any feature works.
