"""
Interview System v2 — Fallback Question Bank
Used when Groq API is unavailable during session start.
Questions are organized by role and difficulty.
"""
from typing import List, Dict
import random


# ---------------------------------------------------------------------------
# Fallback questions: role → difficulty → list of question dicts
# ---------------------------------------------------------------------------

_BANK: Dict[str, Dict[str, List[dict]]] = {
    "Software Engineer": {
        "easy": [
            {"question_text": "What is the difference between a stack and a queue? Give a real-world example of each.", "skill_tag": "Data Structures", "expected_keywords": ["LIFO", "FIFO", "push", "pop", "enqueue", "dequeue"], "question_type": "conceptual"},
            {"question_text": "Explain what Object-Oriented Programming is and name its four core principles.", "skill_tag": "OOP", "expected_keywords": ["encapsulation", "inheritance", "polymorphism", "abstraction"], "question_type": "conceptual"},
            {"question_text": "What is the difference between GET and POST HTTP methods?", "skill_tag": "HTTP", "expected_keywords": ["idempotent", "body", "URL params", "safe", "server state"], "question_type": "conceptual"},
            {"question_text": "What is a REST API? Describe its key constraints.", "skill_tag": "API Design", "expected_keywords": ["stateless", "uniform interface", "client-server", "cacheable", "layered"], "question_type": "conceptual"},
            {"question_text": "What is the purpose of version control systems like Git? Name three common Git commands.", "skill_tag": "Git", "expected_keywords": ["commit", "branch", "merge", "history", "collaboration"], "question_type": "conceptual"},
        ],
        "medium": [
            {"question_text": "Explain the time complexity of binary search and describe how it works.", "skill_tag": "Algorithms", "expected_keywords": ["O(log n)", "sorted array", "mid", "divide and conquer"], "question_type": "conceptual"},
            {"question_text": "What is database indexing and when would you use it? What are its tradeoffs?", "skill_tag": "Databases", "expected_keywords": ["B-tree", "lookup speed", "write overhead", "cardinality", "covering index"], "question_type": "conceptual"},
            {"question_text": "Explain the difference between SQL and NoSQL databases. When would you choose each?", "skill_tag": "Databases", "expected_keywords": ["schema", "ACID", "horizontal scaling", "document", "eventual consistency"], "question_type": "conceptual"},
            {"question_text": "What is a deadlock? How can you detect and prevent it?", "skill_tag": "Operating Systems", "expected_keywords": ["mutual exclusion", "hold and wait", "no preemption", "circular wait", "lock ordering"], "question_type": "conceptual"},
            {"question_text": "Describe the SOLID principles in software design. Give an example for at least two.", "skill_tag": "Software Design", "expected_keywords": ["single responsibility", "open-closed", "Liskov", "interface segregation", "dependency inversion"], "question_type": "conceptual"},
        ],
        "hard": [
            {"question_text": "Design a URL shortener service like bit.ly. Walk through the system architecture, data model, and API.", "skill_tag": "System Design", "expected_keywords": ["hash", "base62", "redirect", "database", "caching", "rate limiting", "analytics"], "question_type": "scenario"},
            {"question_text": "Explain CAP theorem. How does it influence your choice of database for a distributed system?", "skill_tag": "Distributed Systems", "expected_keywords": ["consistency", "availability", "partition tolerance", "CP", "AP", "BASE"], "question_type": "conceptual"},
            {"question_text": "How would you design a rate limiter for an API gateway serving 1 million requests per minute?", "skill_tag": "System Design", "expected_keywords": ["token bucket", "sliding window", "Redis", "distributed counter", "429"], "question_type": "scenario"},
        ],
    },
    "Frontend Developer": {
        "easy": [
            {"question_text": "What is the difference between `let`, `const`, and `var` in JavaScript?", "skill_tag": "JavaScript", "expected_keywords": ["scope", "hoisting", "reassign", "block", "temporal dead zone"], "question_type": "conceptual"},
            {"question_text": "Explain the CSS box model.", "skill_tag": "CSS", "expected_keywords": ["content", "padding", "border", "margin", "box-sizing"], "question_type": "conceptual"},
            {"question_text": "What is the difference between `==` and `===` in JavaScript?", "skill_tag": "JavaScript", "expected_keywords": ["type coercion", "strict equality", "loose equality"], "question_type": "conceptual"},
            {"question_text": "What is semantic HTML and why does it matter?", "skill_tag": "HTML", "expected_keywords": ["accessibility", "SEO", "meaning", "screen reader", "header footer nav article"], "question_type": "conceptual"},
        ],
        "medium": [
            {"question_text": "Explain how the React reconciliation algorithm (Virtual DOM diffing) works.", "skill_tag": "React", "expected_keywords": ["virtual DOM", "fiber", "key prop", "diffing", "re-render", "commit phase"], "question_type": "conceptual"},
            {"question_text": "What is the event loop in JavaScript? How does it handle async operations?", "skill_tag": "JavaScript", "expected_keywords": ["call stack", "task queue", "microtask", "Promise", "setTimeout", "Web APIs"], "question_type": "conceptual"},
            {"question_text": "Explain React hooks — specifically useState, useEffect, and useCallback.", "skill_tag": "React", "expected_keywords": ["state", "side effects", "dependency array", "cleanup", "memoization"], "question_type": "conceptual"},
            {"question_text": "What are CSS specificity rules? How do you resolve specificity conflicts?", "skill_tag": "CSS", "expected_keywords": ["inline", "ID", "class", "element", "!important", "cascade"], "question_type": "conceptual"},
        ],
        "hard": [
            {"question_text": "How would you optimize a React application that renders a list of 10,000 items?", "skill_tag": "React Performance", "expected_keywords": ["virtualization", "react-window", "useMemo", "memo", "pagination", "lazy loading"], "question_type": "scenario"},
            {"question_text": "Explain the difference between SSR, SSG, and CSR. When would you choose each?", "skill_tag": "Web Architecture", "expected_keywords": ["hydration", "TTFB", "SEO", "Next.js", "static generation", "runtime"], "question_type": "conceptual"},
        ],
    },
    "Backend Developer": {
        "easy": [
            {"question_text": "What is the difference between authentication and authorization?", "skill_tag": "Security", "expected_keywords": ["identity", "permissions", "JWT", "OAuth", "roles"], "question_type": "conceptual"},
            {"question_text": "Explain what an ORM is and name one advantage and one disadvantage.", "skill_tag": "Databases", "expected_keywords": ["object-relational mapping", "abstraction", "N+1", "migration", "type safety"], "question_type": "conceptual"},
            {"question_text": "What is middleware in the context of a web framework like Express or FastAPI?", "skill_tag": "Web Frameworks", "expected_keywords": ["request pipeline", "intercept", "authentication", "logging", "CORS"], "question_type": "conceptual"},
        ],
        "medium": [
            {"question_text": "Explain the differences between JWT and session-based authentication.", "skill_tag": "Security", "expected_keywords": ["stateless", "cookie", "token", "expiry", "revocation", "server memory"], "question_type": "conceptual"},
            {"question_text": "What is database connection pooling and why is it important?", "skill_tag": "Databases", "expected_keywords": ["reuse", "overhead", "concurrency", "min/max pool", "timeout"], "question_type": "conceptual"},
            {"question_text": "How would you handle pagination in a REST API returning a large dataset?", "skill_tag": "API Design", "expected_keywords": ["limit offset", "cursor", "total count", "next link", "performance"], "question_type": "scenario"},
        ],
        "hard": [
            {"question_text": "Design a job queue system for processing background tasks reliably at scale.", "skill_tag": "System Design", "expected_keywords": ["Redis", "Celery", "retry", "dead letter queue", "idempotency", "worker pool"], "question_type": "scenario"},
            {"question_text": "How do you handle database migrations in a production system with zero downtime?", "skill_tag": "DevOps", "expected_keywords": ["backward compatible", "expand contract", "blue green", "feature flag", "rollback"], "question_type": "scenario"},
        ],
    },
    "Data Scientist": {
        "easy": [
            {"question_text": "Explain the difference between supervised and unsupervised learning. Give one example of each.", "skill_tag": "Machine Learning", "expected_keywords": ["labels", "classification", "regression", "clustering", "k-means", "PCA"], "question_type": "conceptual"},
            {"question_text": "What is overfitting? How do you detect and prevent it?", "skill_tag": "Machine Learning", "expected_keywords": ["training loss", "validation loss", "regularization", "dropout", "cross-validation"], "question_type": "conceptual"},
        ],
        "medium": [
            {"question_text": "Explain the bias-variance tradeoff in machine learning.", "skill_tag": "Machine Learning", "expected_keywords": ["underfitting", "overfitting", "model complexity", "generalization", "ensemble"], "question_type": "conceptual"},
            {"question_text": "How would you handle missing data in a dataset? What are the tradeoffs of different approaches?", "skill_tag": "Data Preprocessing", "expected_keywords": ["imputation", "mean median mode", "drop", "model-based", "MCAR MAR MNAR"], "question_type": "conceptual"},
            {"question_text": "What is the difference between precision and recall? When do you optimize for each?", "skill_tag": "Model Evaluation", "expected_keywords": ["true positive", "false positive", "false negative", "F1", "imbalanced"], "question_type": "conceptual"},
        ],
        "hard": [
            {"question_text": "How would you build and deploy a machine learning model that needs to retrain on new data weekly?", "skill_tag": "MLOps", "expected_keywords": ["pipeline", "drift detection", "feature store", "CI/CD", "versioning", "monitoring"], "question_type": "scenario"},
        ],
    },
    "General": {
        "easy": [
            {"question_text": "Tell me about a challenging technical problem you've faced and how you solved it.", "skill_tag": "Problem Solving", "expected_keywords": ["identified", "approach", "alternatives", "outcome", "learned"], "question_type": "behavioral"},
            {"question_text": "How do you stay up-to-date with developments in your field?", "skill_tag": "Learning", "expected_keywords": ["blogs", "papers", "courses", "community", "practice"], "question_type": "behavioral"},
            {"question_text": "Describe a time you had to work with a team under a tight deadline. What was your role?", "skill_tag": "Teamwork", "expected_keywords": ["communication", "prioritization", "delegation", "outcome", "retrospective"], "question_type": "behavioral"},
        ],
        "medium": [
            {"question_text": "How do you approach code reviews — both as a reviewer and as the author?", "skill_tag": "Engineering Culture", "expected_keywords": ["constructive", "context", "style", "correctness", "learning", "ego"], "question_type": "behavioral"},
            {"question_text": "Describe a project where you had to make a significant technical decision. What tradeoffs did you consider?", "skill_tag": "Technical Judgment", "expected_keywords": ["constraints", "alternatives", "stakeholders", "outcome", "what I'd do differently"], "question_type": "behavioral"},
        ],
        "hard": [
            {"question_text": "You discover a serious security vulnerability in production code two hours before a major demo. Walk me through your decision-making process.", "skill_tag": "Incident Management", "expected_keywords": ["severity assessment", "communicate", "hotfix", "rollback", "post-mortem"], "question_type": "scenario"},
        ],
    },
}

# Role aliases — map variations to canonical keys
_ROLE_ALIASES = {
    "software engineer": "Software Engineer",
    "swe": "Software Engineer",
    "full stack": "Software Engineer",
    "fullstack": "Software Engineer",
    "frontend": "Frontend Developer",
    "front-end": "Frontend Developer",
    "frontend developer": "Frontend Developer",
    "backend": "Backend Developer",
    "back-end": "Backend Developer",
    "backend developer": "Backend Developer",
    "data scientist": "Data Scientist",
    "ml engineer": "Data Scientist",
    "machine learning": "Data Scientist",
}


def _resolve_role(target_role: str) -> str:
    """Map target_role string to a key in _BANK."""
    normalized = target_role.lower().strip()
    for alias, canonical in _ROLE_ALIASES.items():
        if alias in normalized:
            return canonical
    return "General"


def get_fallback_questions(
    target_role: str,
    difficulty: str,
    num_questions: int,
    reserve_count: int = 3,
) -> List[dict]:
    """
    Return num_questions + reserve_count fallback questions for the given role/difficulty.
    Reserve questions are one difficulty higher (hard if medium/easy, always hard for hard).

    Returns a list of dicts compatible with the question generation format:
    {question_text, skill_tag, difficulty, expected_keywords, question_type, is_reserve}
    """
    role = _resolve_role(target_role)
    bank = _BANK.get(role, _BANK["General"])

    # Difficulty ladder
    ladder = ["easy", "medium", "hard"]
    difficulty = difficulty if difficulty in ladder else "medium"
    reserve_difficulty = ladder[min(ladder.index(difficulty) + 1, 2)]

    def _pick(diff: str, count: int, is_reserve: bool) -> List[dict]:
        pool = bank.get(diff, [])
        if not pool:
            pool = _BANK["General"].get(diff, _BANK["General"]["medium"])
        # Cycle through questions if count > pool size
        selected = []
        for i in range(count):
            q = dict(pool[i % len(pool)])  # copy
            q["difficulty"] = diff
            q["is_reserve"] = is_reserve
            selected.append(q)
        random.shuffle(selected)
        return selected

    main = _pick(difficulty, num_questions, False)
    reserve = _pick(reserve_difficulty, reserve_count, True)

    return main + reserve
