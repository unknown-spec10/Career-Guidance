"""
extractors.py — DETERMINISTIC section extractors (rule-based parser boundary).

No LLMs anywhere in this module. One shared entry-parser serves
education, experience, and projects (date-range boundaries plus keyword
lists — written once); contact, skills, and numeric snippets each have
one small focused extractor.

Reused as-is from the existing codebase:
- extract_numeric_snippets (below), extended by
  extract_numeric_snippets_ext with extra GPA / JEE / duration patterns.
- SimpleNumericValidator.normalize_cgpa (validators_numeric.py) for grades.
- The canonical skill taxonomy file (resume/skill_taxonomy.json, built by
  skill_taxonomy_builder.py) + rapidfuzz WRatio matching at
  SKILL_FUZZY_THRESHOLD — i.e. Pass 1 of skill_normalizer.py, without the
  LLM-embedding Pass 2.
- Project word-boundary convention: names >= 3 chars match on \\b boundaries,
  shorter ones require exact match.

Public API:
    extract_contact(contact_section)          -> dict
    extract_education(education_section)      -> {"education": [...]}
    extract_experience(experience_section)    -> {"experience": [...]}
    extract_projects(projects_section)        -> {"projects": [...]}
    extract_skills(skills_section, fallback_text="") -> {"skills": [...]}
    extract_extras(certifications_section, extras_section) -> dict
    extract_numeric_snippets_ext(text)        -> dict
"""

import json
import logging
import re
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from ..config import settings
from .validators_numeric import SimpleNumericValidator

logger = logging.getLogger(__name__)

_validator = SimpleNumericValidator()

# ─────────────────────────────────────────────────────────────
# Contact patterns (same shapes as the offline fallback in parse_service.py)
# ─────────────────────────────────────────────────────────────

_EMAIL_RE = re.compile(r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+")
_PHONE_RE = re.compile(
    r"(?:\+\d{1,3}[-.\s]?)?\d{4,5}[-.\s]?\d{5,6}"          # +91 6289622872, +91-9876543210
    r"|(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}"
    r"|\+?\d{10,12}"
)
_LINKEDIN_RE = re.compile(
    r"(?:https?://)?(?:www\.)?linkedin\.com/in/[a-zA-Z0-9_/-]+", re.IGNORECASE)
_GITHUB_RE = re.compile(
    r"(?:https?://)?(?:www\.)?github\.com/[a-zA-Z0-9_/-]+", re.IGNORECASE)
_URL_RE = re.compile(r"https?://[a-zA-Z0-9_.-]+\.[a-zA-Z]{2,}[a-zA-Z0-9./_+-]*")

# ─────────────────────────────────────────────────────────────
# Shared entry parser: date-range boundaries + keyword lists
# ─────────────────────────────────────────────────────────────

_MONTH = ("(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|"
          "jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|"
          "nov(?:ember)?|dec(?:ember)?)")
_DATE_TOKEN_RE = re.compile(
    rf"\b(?:{_MONTH}\.?\s+)?(?:19|20)\d{{2}}\b|\bpresent\b|\bcurrent\b",
    re.IGNORECASE)
_DATE_RANGE_RE = re.compile(
    rf"\b(?:{_MONTH}\.?\s+)?(?:19|20)\d{{2}}\s*(?:[-–—]|to)\s*" +
    rf"(?:(?:{_MONTH}\.?\s+)?(?:19|20)\d{{2}}|present|current|now|till\s+date)\b",
    re.IGNORECASE)
# Label-led lines never start an entry ("CGPA: 8.75", "Duration: 2019-2023").
_LABEL_LINE_RE = re.compile(
    r"^[\s\(\[]*(duration|period|cgpa|gpa|grade|percentage|percent|year|rank|jee|"
    r"coursework|courses|score|marks|sgpa|graduating|graduation|expected)"
    r"\b[^:\n]*:", re.IGNORECASE)
# Date-context lines attach to the current entry ("Graduating 2026").
_DATE_CONTEXT_RE = re.compile(
    r"^[\s\(\[]*(graduating|graduation|expected)\b", re.IGNORECASE)
_BULLET_RE = re.compile(r"^[\s]*([-•*·▪▫●○■□►»⋄>|]|(\d+[.)]))\s+")
_DATE_ONLY_RE = re.compile(
    rf"^[\s(]*{_MONTH}?\.?\s*(?:(?:19|20)\d{{2}}\s*(?:[-–—]|to)?\s*)+"
    r"(?:present|current|now)?[\s)]*$",
    re.IGNORECASE)

_EDU_ORG_WORDS = ("university", "college", "institute", "institution", "school",
                  "iit", "nit", "iiit", "board", "academy", "vidyalaya",
                  "polytechnic", "varsity")
_EDU_DEGREE_WORDS = ("b.tech", "btech", "b.e", "m.tech", "mtech", "bca", "mca",
                     "b.sc", "m.sc", "bsc", "msc", "bachelor", "master", "mba",
                     "phd", "ph.d", "diploma", "class", "hsc", "ssc", "xii",
                     "intermediate", "b.com", "m.com", "b.a", "m.a", "bba",
                     "associate", "undergraduate", "postgraduate")
_EXP_TYPE_WORDS = {"internship": "internship", "intern": "internship",
                   "contract": "contract", "part-time": "part-time",
                   "part time": "part-time", "full-time": "full-time",
                   "full time": "full-time", "freelance": "contract"}


# Max length of a dateless title line that may start a new entry.
_TITLE_MAX_LEN = 100


def _is_empty_bullet(line: str) -> bool:
    """True for lines holding only bullet/separator characters (no text)."""
    s = line.strip()
    return bool(s) and not re.search(r"[A-Za-z0-9]", s) \
        and bool(re.search(r"[•*·▪▫●○■□►»⋄│\uf0b7>|*\-+]", s))


def _looks_like_entry_title(line: str, current: List[str]) -> bool:
    """True when a dateless, non-bullet line opens a new entry.

    Requires body content already present (a bullet line in `current`) so
    header pairs ("B.E. ...", "University of ...") and plain sentence
    bodies never split. Uppercase start + length cap + no sentence-ending
    punctuation keep wrapped bullet continuations attached.
    """
    s = line.strip()
    if len(current) < 2 or len(s) < 3 or len(s) > _TITLE_MAX_LEN:
        return False
    if not re.search(r"[A-Za-z0-9]", s):
        return False
    first = s[0]
    if not (first.isupper() or first.isdigit()):
        return False
    if s[-1] in ".!?;:,—–-":
        return False
    return any(_BULLET_RE.match(l) for l in current)


def _split_entries(block: str) -> List[List[str]]:
    """
    Split a section block into entries (lists of lines). A line starts a new
    entry when it carries a date token plus other text, unless it is a
    bullet or a label-led line. Date-only lines and label lines attach to
    the current entry. Written once; used by education/experience/projects.

    Two boundary gaps are also closed here (same shared parser, no callers
    change):
    - Empty bullets: a line holding only bullet characters (a wrapped ""
      left alone on its line by PDF extraction) never starts an entry after
      a blank line — it attaches to the current one.
    - Dateless titles: a short title-case line ("RAG Application",
      "JiraSync — Jira-to-Power BI ETL Pipeline ...") starts a new entry
      once the current entry already holds body content (a bullet line).
      Guards (short, uppercase start, no sentence-ending punctuation, no
      trailing hyphen of a wrapped word) keep wrapped bullet continuations
      ("semaphore-controlled ... cutting wall", "streaming.") attached, and
      the bullet-presence requirement keeps header pairs
      ("B.E. ...", "University of ...") and plain sentence bodies together.
    """
    entries: List[List[str]] = []
    current: List[str] = []
    pending_boundary = False

    def flush():
        if current:
            entries.append(current)

    for raw in block.split("\n"):
        line = raw.strip()
        if not line:
            if current:
                pending_boundary = True
            continue
        is_bullet = bool(_BULLET_RE.match(line))
        is_label = bool(_LABEL_LINE_RE.match(line)) \
            or bool(_DATE_CONTEXT_RE.match(line))
        has_date = bool(_DATE_TOKEN_RE.search(line))
        date_only = bool(_DATE_ONLY_RE.match(line))

        if not current:
            current = [line]
            pending_boundary = False
        elif is_bullet or is_label or date_only or not has_date:
            if pending_boundary:
                if (is_bullet or is_label or date_only
                        or _is_empty_bullet(line)):
                    current.append(line)
                else:
                    flush()
                    current = [line]
            elif _looks_like_entry_title(line, current):
                flush()
                current = [line]
            else:
                current.append(line)
            pending_boundary = False
        else:  # substantive line with a date → new entry
            flush()
            current = [line]
            pending_boundary = False
    flush()
    return [e for e in entries if e]


def _entry_dates(lines: List[str]) -> Tuple[Optional[str], Optional[str]]:
    """First date range found across the entry's lines → (start, end)."""
    for line in lines:
        m = _DATE_RANGE_RE.search(line)
        if m:
            parts = re.split(r"[-–—]|to", m.group(0), maxsplit=1,
                             flags=re.IGNORECASE)
            return parts[0].strip(), parts[1].strip()
    for line in lines:
        years = re.findall(r"\b((?:19|20)\d{2})\b", line)
        if years:
            if len(years) >= 2:
                return years[0], years[1]
            return None, years[0]
    return None, None


def _strip_bullet(line: str) -> str:
    line = re.sub(r"^[o]\s+(?=[A-Z])", "", line)  # OCR 'o' bullets
    return _BULLET_RE.sub("", line).strip()


# ─────────────────────────────────────────────────────────────
# Contact
# ─────────────────────────────────────────────────────────────

def extract_contact(contact_section: str) -> dict:
    """Email/phone/URL regexes; name = first non-empty header-like line."""
    text = contact_section or ""
    email_m = _EMAIL_RE.search(text)
    phone_m = _PHONE_RE.search(text)
    li_m = _LINKEDIN_RE.search(text)
    gh_m = _GITHUB_RE.search(text)

    portfolio = None
    for m in _URL_RE.finditer(text):
        url = m.group(0)
        low = url.lower()
        if "linkedin" not in low and "github" not in low:
            portfolio = url
            break

    name = None
    for line in text.split("\n"):
        line = line.strip().strip("|-,;")
        if not line or "@" in line or _URL_RE.search(line):
            continue
        if _PHONE_RE.fullmatch(line.replace(" ", "")):
            continue
        cleaned = re.sub(r"\s+", " ", line).strip()
        if 2 <= len(cleaned.split()) <= 5 and len(cleaned) < 50:
            name = cleaned
            break

    location = None
    for line in text.split("\n"):
        # Strip contact links first so wrapped lines can't pollute the match.
        clean = _EMAIL_RE.sub(" ", line)
        clean = _LINKEDIN_RE.sub(" ", clean)
        clean = _GITHUB_RE.sub(" ", clean)
        clean = _URL_RE.sub(" ", clean)
        clean = _PHONE_RE.sub(" ", clean)
        for seg in re.split(r"[|⋄·•]", clean):
            seg = seg.strip(" ,;-")
            seg = re.sub(r"^[A-Za-z ]+:\s*", "", seg)  # "Location: X, Y" → "X, Y"
            m = re.fullmatch(r"([A-Za-z][A-Za-z .'-]*,[A-Za-z .'-]*)", seg)
            if not m:
                continue
            # City + Region only; drop tokens carrying email spillover.
            parts = [p.strip() for p in m.group(1).split(",")]
            region_words = [w for w in parts[1].split()
                            if "." not in w and "@" not in w and "/" not in w][:2]
            if parts[0] and region_words and len(parts[0]) <= 30:
                location = f"{parts[0]}, {' '.join(region_words)}"
                break
        if location:
            break

    return {
        "name": name,
        "email": email_m.group(0).strip() if email_m else None,
        "phone": phone_m.group(0).strip() if phone_m else None,
        "location": location,
        "linkedin_url": li_m.group(0) if li_m else None,
        "github_url": gh_m.group(0) if gh_m else None,
        "portfolio_url": portfolio,
    }


# ─────────────────────────────────────────────────────────────
# Education / experience / projects (via the shared entry parser)
# ─────────────────────────────────────────────────────────────

def _grade_from_lines(lines: List[str]) -> Tuple[Any, Any, Any]:
    for line in lines:
        m = re.search(r"(?:cgpa|gpa|sgpa)\s*:?\s*([0-9]+\.?[0-9]*)(?:\s*/\s*([0-9]+))?",
                      line, re.IGNORECASE)
        if m:
            raw = m.group(1) + (f"/{m.group(2)}" if m.group(2) else "")
            norm = _validator.normalize_cgpa(raw)
            return (norm["normalized"],
                    float(m.group(2)) if m.group(2) else 10.0, "cgpa")
        m = re.search(r"([0-9]{1,3}\.?[0-9]*)\s*%", line)
        if m:
            norm = _validator.normalize_cgpa(m.group(1))
            return norm["normalized"], 100.0, "percentage"
    return None, None, None


_EDU_FIELD_WORDS = ("computer applications", "computer science", "information technology",
                   "data science", "electronics", "mechanical", "civil", "electrical",
                   "artificial intelligence", "machine learning", "commerce", "arts",
                   "physics", "chemistry", "mathematics", "statistics", "business")


def extract_education(section: str) -> dict:
    out = []
    for lines in _split_entries(section or ""):
        lines = [_strip_bullet(l) for l in lines]
        # One line carrying both degree and org ("BCA — Institute of X"):
        # split on the dash so each half is searchable on its own.
        expanded: List[str] = []
        for line in lines:
            parts = re.split(r"\s+[—–-]\s+", line, maxsplit=1)
            if len(parts) == 2 and any(
                    w in parts[0].lower() for w in _EDU_DEGREE_WORDS):
                expanded.extend([parts[0].strip(), parts[1].strip()])
            else:
                expanded.append(line)
        lines = expanded
        low = [line.lower() for line in lines]
        degree = next(
            (lines[i] for i, l in enumerate(low)
             if any(w in l for w in _EDU_DEGREE_WORDS)), lines[0] if lines else None)
        institution = next(
            (lines[i] for i, l in enumerate(low)
             if any(w in l for w in _EDU_ORG_WORDS)
             and lines[i] != degree
             and not _LABEL_LINE_RE.match(lines[i])
             and not _DATE_CONTEXT_RE.match(lines[i])), None)
        if institution is None:
            institution = next(
                (lines[i] for i, l in enumerate(low)
                 if any(w in l for w in _EDU_ORG_WORDS)
                 and not _LABEL_LINE_RE.match(lines[i])), None)
        if institution:
            # Org name wrapped across lines ("Institute of ... and" +
            # "Management, Kolkata"): append the next substantive line,
            # skipping date-context/label lines in between.
            idx = lines.index(institution)
            if re.search(r"(and|,)\s*$", institution):
                for nxt in lines[idx + 1:]:
                    if not nxt.strip() or _LABEL_LINE_RE.match(nxt) \
                            or _DATE_CONTEXT_RE.match(nxt) \
                            or _DATE_ONLY_RE.match(nxt):
                        continue
                    if len(nxt) < 50 and not _DATE_TOKEN_RE.search(nxt) \
                            and not _BULLET_RE.match(nxt):
                        institution = f"{institution} {nxt}".strip()
                    break
        field = None
        for line in lines:
            m = re.search(r"\bin\s+([A-Z][A-Za-z &/+-]+)", line)
            if m and len(m.group(1)) < 60:
                field = m.group(1).strip()
                break
            m = re.search(
                r"(?:bachelor|master|b\.?tech|b\.?e\.?|m\.?tech|bca|mca)\s+"
                r"(?:of\s+|in\s+)?([A-Z][A-Za-z &]+)", line)
            if m and len(m.group(1)) < 60:
                field = m.group(1).strip()
                break
            hit = next((w for w in _EDU_FIELD_WORDS if w in line.lower()), None)
            if hit:
                field = hit.title()
                break
        start, end = _entry_dates(lines)
        grade, scale, gtype = _grade_from_lines(lines)
        out.append({
            "institution": institution,
            "degree": degree,
            "field": field,
            "start_year": start, "end_year": end,
            "grade": grade, "grade_scale": scale, "grade_type": gtype,
            "board_university": institution,
            "coursework": [],
        })
    return {"education": out}


def _split_title_company(first: str) -> Tuple[Optional[str], Optional[str]]:
    m = re.search(r"(.+?)\s+at\s+(.+?)(?:\s*[\(\|,;]|$)", first, re.IGNORECASE)
    if m:
        return m.group(1).strip(" ,|-"), m.group(2).strip(" ,|-")
    for sep in (" - ", " | ", " @ "):
        if sep in first:
            a, b = first.split(sep, 1)
            return a.strip(" ,|-"), b.strip(" ,|-")
    if "," in first:
        a, b = first.rsplit(",", 1)
        if len(b.strip().split()) <= 4:
            return a.strip(), b.strip()
    return first.strip() or None, None


def extract_experience(section: str) -> dict:
    out = []
    for lines in _split_entries(section or ""):
        first = _strip_bullet(lines[0])
        title, company = _split_title_company(first)
        if len(lines) > 1 and not company:
            nxt = _strip_bullet(lines[1])
            if not _BULLET_RE.match(lines[1]) and not _DATE_TOKEN_RE.search(nxt) \
                    and len(nxt) < 60:
                company = nxt
        start, end = _entry_dates(lines)
        blob = " ".join(lines).lower()
        emp_type = next((v for k, v in _EXP_TYPE_WORDS.items() if k in blob), None)
        responsibilities = [_strip_bullet(l) for l in lines[1:]
                            if _BULLET_RE.match(l)]
        if not responsibilities:
            responsibilities = [_strip_bullet(l) for l in lines[1:]
                                if len(_strip_bullet(l)) > 20]
        out.append({
            "company": company, "title": title,
            "employment_type": emp_type,
            "start_date": start, "end_date": end,
            "location": None, "responsibilities": responsibilities,
        })
    return {"experience": out}


def extract_projects(section: str) -> dict:
    tax = _load_taxonomy()
    out = []
    for lines in _split_entries(section or ""):
        name = _strip_bullet(lines[0]) or None
        body = [_strip_bullet(l) for l in lines[1:]]
        description = " ".join(b for b in body if b) or None
        blob = " ".join(lines)
        tech = sorted({canonical for canonical in tax
                       if _skill_in_text(canonical, blob)})
        url_m = _URL_RE.search(blob)
        start, end = _entry_dates(lines)
        out.append({
            "name": name, "description": description,
            "tech_stack": tech,
            "url": url_m.group(0) if url_m else None,
            "role": None, "start_date": start, "end_date": end,
        })
    return {"projects": out}


# ─────────────────────────────────────────────────────────────
# Skills: delimiter split matched against the canonical taxonomy
# ─────────────────────────────────────────────────────────────

_taxonomy_cache: Optional[Dict[str, str]] = None


def _load_taxonomy() -> Dict[str, str]:
    """Canonical name-lower → display name. Mirrors SimpleSkillMapper paths."""
    global _taxonomy_cache
    if _taxonomy_cache is not None:
        return _taxonomy_cache
    candidates = []
    try:
        if getattr(settings, "SKILL_TAXONOMY_PATH", None):
            candidates.append(Path(settings.SKILL_TAXONOMY_PATH))
    except Exception:
        pass
    candidates.append(
        Path(__file__).resolve().parent / "skill_taxonomy.json")
    for path in candidates:
        try:
            if path and path.exists():
                with open(path) as f:
                    raw = json.load(f)
                _taxonomy_cache = {str(k).lower(): str(k) for k in raw.keys()}
                logger.info(f"extractors: loaded {len(_taxonomy_cache)} "
                            f"taxonomy skills from {path}")
                return _taxonomy_cache
        except Exception as e:
            logger.warning(f"extractors: taxonomy load failed for {path}: {e}")
    _taxonomy_cache = {k: k for k in
                       ("python", "java", "c++", "machine learning",
                        "data analysis")}
    return _taxonomy_cache


def _skill_in_text(canonical_lower: str, text: str) -> bool:
    if len(canonical_lower) < 3:
        return canonical_lower.lower() == text.lower().strip() or \
            bool(re.search(r"(?<![A-Za-z0-9+#])" + re.escape(canonical_lower) +
                           r"(?![A-Za-z0-9+#])", text, re.IGNORECASE))
    return bool(re.search(r"\b" + re.escape(canonical_lower) + r"\b",
                          text, re.IGNORECASE))


def _match_skill(candidate: str, tax: Dict[str, str]) -> Optional[Tuple[str, str, float]]:
    """(display_name, match_type, confidence) or None. rapidfuzz Pass-1 only.

    Order mirrors the existing matchers: exact → case-insensitive exact →
    substring (as in SimpleSkillMapper._fuzzy_match, 0.95) → rapidfuzz
    WRatio at SKILL_FUZZY_THRESHOLD (as in SkillNormalizer Pass 1).
    Candidates shorter than 3 chars require an exact match (project
    word-boundary convention).
    """
    cand = candidate.strip().strip("-•*·|").strip()
    if not cand or len(cand) > 60:
        return None
    low = cand.lower()
    if low in tax:
        return tax[low], "exact", 1.0
    for key, display in tax.items():
        if key == low:
            return display, "exact", 1.0
    if len(cand) < 3:
        return None
    try:
        from rapidfuzz import fuzz as rf_fuzz  # type: ignore
        from rapidfuzz import process as rf_process  # type: ignore
    except ImportError:
        return None
    partial = rf_process.extractOne(
        low, list(tax.keys()), scorer=rf_fuzz.partial_ratio,
        score_cutoff=90.0)
    if partial:
        key, score, _ = partial
        if len(key) >= 3:
            return tax[key], "substring", 0.95
    match = rf_process.extractOne(
        cand, list(tax.values()), scorer=rf_fuzz.WRatio,
        score_cutoff=getattr(settings, "SKILL_FUZZY_THRESHOLD", 82.0))
    if match:
        return match[0], "fuzzy", round(match[1] / 100.0, 4)
    return None


_DELIM_RE = re.compile(r"[;,|]")
_CATEGORY_PREFIX_RE = re.compile(r"^[A-Za-z][A-Za-z &/+.-]{1,30}:\s*(.+)$")


def extract_skills(skills_section: str, fallback_text: str = "") -> dict:
    """
    Split the skills section on delimiters (commas, pipes, bullets,
    newlines; 'Category: a, b' prefixes stripped), match each candidate
    against the canonical taxonomy. When the section is empty, fall back
    to taxonomy word-boundary scan of the full resume text.
    """
    tax = _load_taxonomy()
    candidates: List[str] = []
    for line in (skills_section or "").split("\n"):
        line = line.strip()
        if not line:
            continue
        line = _strip_bullet(line)
        m = _CATEGORY_PREFIX_RE.match(line)
        if m:
            prefix, rhs = line.split(":", 1)[0], m.group(1)
            if "," in rhs or "|" in rhs:
                line = rhs  # 'Category: a, b' → parse the list
            elif _match_skill(prefix, tax):
                # 'Python: prose...' → the prefix itself is the skill;
                # the prose describes it and is not parsed further.
                candidates.append(prefix)
                continue
            # else: fall through and try the whole line as one candidate
        candidates.extend(_DELIM_RE.split(line))
    # Also catch "Technologies: a, b" style inline lists anywhere in section.
    matched: Dict[str, dict] = {}
    order: List[str] = []
    for cand in candidates:
        hit = _match_skill(cand, tax)
        if hit:
            display, mtype, conf = hit
            if display.lower() not in matched:
                matched[display.lower()] = {
                    "name": display, "canonical_id": None,
                    "match_confidence": conf, "match_type": mtype}
                order.append(display.lower())
        else:
            # Keep plausible skill-like candidates as unrecognized (same
            # role as NormalizationResult.unrecognized in the LLM pipeline).
            clean = cand.strip().strip("-•*·|").strip()
            if clean and len(clean) <= 40 and len(clean.split()) <= 3 \
                    and re.match(r"^[A-Za-z0-9][A-Za-z0-9 +#./-]*$", clean) \
                    and clean.lower() not in matched:
                matched[clean.lower()] = {
                    "name": clean, "canonical_id": None,
                    "match_confidence": None, "match_type": "unrecognized"}
                order.append(clean.lower())
    if not order and fallback_text:
        for key, display in tax.items():
            if _skill_in_text(key, fallback_text) and display.lower() not in matched:
                matched[display.lower()] = {
                    "name": display, "canonical_id": None,
                    "match_confidence": 1.0, "match_type": "exact"}
                order.append(display.lower())
    skills = [matched[k] for k in order]
    # Attach canonical ids from the taxonomy file values when available.
    try:
        path = Path(settings.SKILL_TAXONOMY_PATH)
        if path.exists():
            with open(path) as f:
                id_map = {str(k).lower(): v for k, v in json.load(f).items()}
            for s in skills:
                s["canonical_id"] = id_map.get(s["name"].lower())
    except Exception:
        pass
    return {"skills": skills}


# ─────────────────────────────────────────────────────────────
# Certifications: only lines carrying a certification signal become certs.
# Bare skill bullets ("TensorFlow", "PyTorch") leak in when a resume lists
# skills under the certifications header — without a signal they stay out.
# ─────────────────────────────────────────────────────────────

# Cert words: certified / certificate / certification, license / licence
# (+ licensed/licensing), credential(s), accredit(ed/ation).
_CERT_SIGNAL_RE = re.compile(
    r"certif|licens|licenc|credential|accredit", re.IGNORECASE)
# Known issuers / awarding bodies (word-boundary matched).
_CERT_ISSUER_RE = re.compile(
    r"\b(linkedin|udemy|coursera|edx|udacity|pluralsight|datacamp|kaggle|"
    r"nptel|swayam|freecodecamp|hackerrank|aws|amazon|azure|microsoft|"
    r"google|gcp|oracle|cisco|ibm|comptia|pmi|scrum|isaca|salesforce|"
    r"adobe|meta|cloudera|snowflake|databricks)\b", re.IGNORECASE)


def _is_certification_line(text: str) -> bool:
    """True when a line carries a certification signal or known issuer."""
    return bool(_CERT_SIGNAL_RE.search(text)
                or _CERT_ISSUER_RE.search(text))

_LANGUAGE_LIST = ("english", "hindi", "bengali", "tamil", "telugu", "marathi",
                  "gujarati", "kannada", "malayalam", "punjabi", "urdu",
                  "french", "german", "spanish", "japanese", "chinese",
                  "tamil", "odia", "assamese")


def extract_extras(certifications_section: str, extras_section: str) -> dict:
    certs, awards, pubs, volunteer, langs = [], [], [], [], []
    for line in (certifications_section or "").split("\n"):
        line = _strip_bullet(line)
        # Certification signal gate: bullets without a cert word or known
        # issuer (e.g. stray skill lists under the header) stay out.
        if line and _is_certification_line(line):
            certs.append({"name": line, "issuer": None, "issue_date": None,
                          "expiry_date": None, "credential_id": None,
                          "url": None})
    for line in (extras_section or "").split("\n"):
        clean = _strip_bullet(line)
        if not clean:
            continue
        low = clean.lower()
        if any(w in low for w in ("prize", "award", "won", "winner", "rank 1",
                                  "first prize", "hackathon", "scholarship",
                                  "honor", "honour")):
            awards.append({"title": clean, "issuer": None, "year": _year(clean)})
        elif any(w in low for w in ("publish", "paper", "journal", "conference",
                                    "icml", "arxiv")):
            pubs.append({"title": clean, "venue": None, "year": _year(clean)})
        elif "volunteer" in low:
            volunteer.append({"organization": None, "role": None,
                              "description": clean})
        elif any(w in low for w in ("certif", "course", "udemy", "coursera",
                                    "aws", "azure", "gcp", "credential")) \
                and _is_certification_line(clean):
            certs.append({"name": clean, "issuer": None, "issue_date": None,
                          "expiry_date": None, "credential_id": None,
                          "url": None})
        else:
            found = [L for L in _LANGUAGE_LIST if re.search(
                r"\b" + L + r"\b", low)]
            if found and len(clean.split()) <= 6:
                langs.extend(L.title() for L in found
                             if L.title() not in langs)
    return {"certifications": certs, "awards": awards,
            "languages_spoken": langs, "publications": pubs,
            "volunteer": volunteer}


def _year(text: str) -> Optional[str]:
    m = re.search(r"\b((?:19|20)\d{2})\b", text)
    return m.group(1) if m else None


# ─────────────────────────────────────────────────────────────
# Numeric snippets: base patterns plus extended GPA/JEE/duration
# ─────────────────────────────────────────────────────────────

def extract_numeric_snippets(text: str) -> dict:
    snippets = {}
    cgpa_match = re.search(r"(CGPA[:\s]*)([0-9]+\.?[0-9]*)(/\d+\.?\d*)?", text, re.I)
    if cgpa_match:
        snippets['cgpa'] = cgpa_match.group(2)
    perc = re.search(r"([0-9]{1,3}\.?[0-9]*)\s*%", text)
    if perc:
        snippets['percentage'] = perc.group(1)
    jee = re.search(r"JEE\s*Rank[:\s]*([0-9,]+)", text, re.I)
    if jee:
        snippets['jee_rank'] = jee.group(1).replace(',', '')
    # Match full 4-digit years only
    years = re.findall(r"\b(?:19|20)\d{2}\b", text)
    if years:
        snippets['years'] = list(set(years))
    return snippets


def extract_numeric_snippets_ext(text: str) -> dict:
    """Base extract_numeric_snippets plus extra GPA/JEE/duration patterns."""
    snippets = dict(extract_numeric_snippets(text))
    m = re.search(r"(?:GPA|SGPA)\s*:?\s*([0-9]+\.?[0-9]*)(?:\s*/\s*([0-9]+))?",
                  text, re.IGNORECASE)
    if m and "cgpa" not in snippets:
        snippets["cgpa"] = m.group(1)
        if m.group(2):
            snippets["grade_scale"] = m.group(2)
    m = re.search(r"([0-9]+\.?[0-9]*)\s*/\s*10(?:\.0)?\b", text)
    if m and "cgpa" not in snippets:
        snippets["cgpa"] = m.group(1)
    m = re.search(r"JEE\s*(?:Main|Advanced)?\s*Rank\s*:?\s*([0-9,]+)",
                  text, re.IGNORECASE)
    if m:
        snippets["jee_rank"] = m.group(1).replace(",", "")
    m = re.search(r"Duration\s*:?\s*((?:19|20)\d{2}\s*[-–—]\s*(?:(?:19|20)\d{2}|present))",
                  text, re.IGNORECASE)
    if m:
        snippets["duration"] = m.group(1)
    return snippets
