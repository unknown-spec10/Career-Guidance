"""
segmenter.py — DETERMINISTIC section splitter (rule-based parser boundary).

No LLMs anywhere in this module. One job: split raw resume text into
sections using header-line regexes plus a synonym map.

Output sections: contact, education, experience, skills, projects,
certifications, extras. Text before the first recognized header belongs
to `contact` (name + contact lines live at the top of virtually every
resume). Unrecognized headers fold into `extras`, never dropped.

Public API:
    sections = split_sections(raw_text)  # -> Dict[str, str]
"""

import re
from typing import Dict, List, Optional, Tuple

# Canonical section → header synonyms (lowercased, punctuation stripped).
SECTION_SYNONYMS: Dict[str, Tuple[str, ...]] = {
    "education": (
        "education", "academic background", "academics", "academic qualifications",
        "qualifications", "educational qualifications", "scholastic record",
    ),
    "experience": (
        "experience", "work experience", "professional experience",
        "relevant experience", "related experience", "employment",
        "employment history", "work history", "career history",
        "internships", "internship", "internship experience",
        "experience and internships", "internships and experience",
        "freelance experience", "consulting experience",
        "research experience", "teaching experience",
        "leadership experience", "professional background",
        "professional journey",
    ),
    "skills": (
        "skills", "technical skills", "key skills", "core skills",
        "tech stack", "technologies", "technical expertise", "competencies",
        "core competencies", "areas of expertise", "expertise",
        "programming skills", "computer skills",
    ),
    "projects": (
        "projects", "personal projects", "academic projects", "key projects",
        "major projects", "project experience", "selected projects",
    ),
    "certifications": (
        "certifications", "certification", "certificates", "licenses",
        "courses", "training", "coursework", "relevant coursework",
        "certifications and courses",
    ),
    "extras": (
        "achievements", "accomplishments", "awards", "honors", "honours",
        "publications", "research", "volunteer", "volunteering",
        "languages", "languages known", "interests", "hobbies",
        "extracurricular", "extracurricular activities", "objective",
        "career objective", "summary", "profile", "professional summary",
        "declaration", "references", "activities",
    ),
}

_ALL_HEADERS: Dict[str, str] = {
    synonym: section for section, synonyms in SECTION_SYNONYMS.items()
    for synonym in synonyms
}

# A header line: optional numbering/bullet, the title, optional trailing
# colon/dashes. Matched case-insensitively against a short line only.
_HEADER_RE = re.compile(r"^[\s#*\-\u2022\d.)]*([A-Za-z][A-Za-z &/+,.'()-]*?)"
                        r"[\s:._\-–—|]*$")
_MAX_HEADER_LEN = 60


def _header_title(line: str) -> Optional[str]:
    """Normalized header title for a short single line, else None."""
    stripped = line.strip().strip("#*-•").strip()
    if not stripped or len(stripped) > _MAX_HEADER_LEN:
        return None
    match = _HEADER_RE.match(stripped)
    if not match:
        return None
    return re.sub(r"\s+", " ", re.sub(r"[^a-z &/]", "", match.group(1).strip().lower())).strip()


def _normalize_header(line: str) -> Optional[str]:
    """Return the canonical section for a header line, else None."""
    if re.search(r"[@]", line):  # contact lines are never headers
        return None
    title = _header_title(line)
    if title is None:
        return None
    if title in _ALL_HEADERS:
        return _ALL_HEADERS[title]
    # Single tokens (bullets like "- SQL", lone years) are never headers.
    if len(title.split()) < 2:
        return None
    # All-caps short lines are header-styled; keep them as unknown headers.
    if line.strip().isupper() and 2 <= len(line.strip().split()) <= 5:
        return "extras"
    return None


def _is_known_header(line: str) -> bool:
    """True when the line matches a synonym in the map (not the caps fallback)."""
    title = _header_title(line)
    return title is not None and title in _ALL_HEADERS


def _is_underline(line: str) -> bool:
    return bool(line.strip()) and len(set(line.strip())) == 1 \
        and line.strip()[0] in "-=~_"


def split_sections(raw_text: str) -> Dict[str, str]:
    """Split raw text into the seven canonical sections (missing → "")."""
    sections: Dict[str, List[str]] = {name: [] for name in
                                      ("contact", "education", "experience",
                                       "skills", "projects", "certifications",
                                       "extras")}
    if not raw_text or not raw_text.strip():
        return {k: "" for k in sections}

    current = "contact"
    seen_header = False
    for line in raw_text.split("\n"):
        if _is_underline(line):
            continue  # '---' underlines belong to the header above
        section = _normalize_header(line)
        if section is not None:
            # Unknown ALL-CAPS headers fold into extras — but only after the
            # first real header. Leading ALL-CAPS lines are the contact
            # block (name, location), not sections.
            if section == "extras" and not seen_header \
                    and not _is_known_header(line):
                sections[current].append(line)
                continue
            current = section
            seen_header = True
            continue
        sections[current].append(line)

    return {k: "\n".join(v).strip() for k, v in sections.items()}
