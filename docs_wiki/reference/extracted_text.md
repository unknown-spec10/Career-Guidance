DEEP PODDER
+91 6289622872 ⋄ Kolkata, India
deeppodder21@gmail.com ⋄ linkedin.com/in/deeppodder2005 ⋄ github.com/unknown-spec10
OBJECTIVE
Backend and AI engineer with hands-on experience building production-grade RAG systems — including
multimodal retrieval pipelines and LLM hallucination mitigation. Seeking AI engineering or backend roles at
companies building intelligent, data-driven products.
EDUCATION
Bachelor of Computer Applications (BCA) — Institute of Engineering and Management, Kolkata
Graduate 2026
SKILLS
Backend Development: Python, FastAPI, REST API design, Async Python, Streaming (WebSockets),
JWT & OAuth2, Redis caching, Rate limiting
Databases: SQL (MySQL, PostgreSQL) — joins, stored procedures, triggers, indexing, query
optimization, normalization, transactions & ACID, constraints
Vector & NoSQL: ChromaDB, Pgvector, FAISS store embedding storage
AI / ML: LLM integration (Gemini), RAG pipelines (chunking strategies, top-k retrieval, reranking),
LangChain, LlamaIndex, LangGraph (agents & workflows), multimodal embeddings, prompt
engineering & chaining, hallucination mitigation, context window optimization
Tools & Practices: Git, Docker (containers, images, Dockerfile), Streamlit, environment variable
management
Cloud & Infrastructure: AWS (EC2, S3, Bedrock, boto3), horizontal vs vertical scaling concepts, load
balancing basics, monolith vs microservices architecture fundamentals
Data & Visualization: pandas, matplotlib, PDF parsing, data validation
PROJECTS
Career Guidance AI
Stack: Python, FastAPI, Pgvector, LangGraph, watchdog
• Built a RAG-based career guidance service with localized ChromaDB vector storage and a multi-
threaded filesystem watcher (watchdog) for real-time, zero-downtime index rebuilds.
• Designed a resume parsing pipeline with an intelligent LLM fallback system (Small-to-large model
routing) and exact-match regex validators to catch and override LLM hallucinations.
• Engineered a continuous-learning skill taxonomy engine that automatically extracts, categorizes,
and syncs unknown tech skills to the database during resume processing.
Insurance Policy Chatbot (Multimodal RAG)
Stack: Python, FastAPI, Gemini API, pgvector, Streamlit, watchdog
• Built a document Q&A chatbot for an insurance company enabling users to query policy
documents in natural language via a Streamlit interface backed by a FastAPI service.
• Implemented a unified multimodal embedding pipeline that maps text, images, and mixed-format
content (forms, tables, diagrams) into a shared pgvector space, enabling Gemini to reason across
all data types in a single retrieval pass.
• Used Gemini vision to auto-generate captions for embedded images, fused with surrounding text
before indexing — preserving semantic context that text-only extraction would miss.