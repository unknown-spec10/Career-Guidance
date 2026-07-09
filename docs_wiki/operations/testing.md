# Testing & Verification

This document lists the available automated test suites, scripts, and verification tools to ensure codebase correctness.

---

## Backend Test Suite

The backend uses **pytest** for testing. Tests are categorized into pure unit tests and integration tests.

### Running Backend Tests
Activate the virtual environment, navigate to the `resume_pipeline/` directory, and run:

```powershell
# Run the entire test suite quietly
pytest tests/ -q

# Run verbose with detailed output
pytest tests/ -v

# Show print() outputs during test execution
pytest tests/ -v -s
```

### Running Specific Tests

```powershell
# Run a single test module (Unit tests only, no server needed)
pytest tests/test_parsing.py -v

# Run integration tests (These require localhost:8000 to be running)
pytest tests/test_api.py -v

# Run a specific test function
pytest tests/test_parsing.py::test_skill_mapping -v
```

### LLM Mock Mode
To run unit tests without hitting Gemini API endpoints and consuming credits, verify that `GEMINI_MOCK_MODE=true` is set in your test environment or `.env` file:

```powershell
# Run tests with mock mode enabled inline
$env:GEMINI_MOCK_MODE="true"; pytest tests/test_parsing.py -v
```

---

## Data Verification Scripts

The codebase provides operational Python scripts under `resume_pipeline/scripts/` to confirm data schemas and database integrity:

* **verify_data.py**: Checks that DB relations, constraints, and mock seed records (users, jobs, courses) have been populated correctly.
  ```powershell
  python scripts/verify_data.py
  ```

---

## Frontend Lint Checks

The frontend project has strict code-quality enforcement. Pull requests will fail CI checks if ESLint reports any warnings.

```powershell
# Run ESLint validation checks (must report zero warnings)
cd frontend
npm run lint
```
