import json
from pathlib import Path
from typing import Tuple
from jsonschema import validate, ValidationError
import logging

logger = logging.getLogger(__name__)

from ..config import settings
from ..core.interfaces import ParserService
from .llm_gemini import GeminiLLMClient
from .preprocessor import PdfTextExtractor, TesseractOCR, clean_text, extract_numeric_snippets
from .validators_numeric import SimpleNumericValidator
from .skill_mapper_simple import SimpleSkillMapper
from .skill_taxonomy_builder import SkillTaxonomyBuilder

SCHEMA_PATH = Path(__file__).resolve().parents[2] / 'schema.json'
SCHEMA = json.loads(SCHEMA_PATH.read_text(encoding='utf-8'))

STRICT_SYSTEM = (
    "Return ONLY JSON matching the schema. Unknown numerics -> null and flag 'numeric_uncertain'. No extra text."
)
STRICTER_SYSTEM = STRICT_SYSTEM + " If invalid, minimize keys and ensure strict schema."


class ResumeParserService(ParserService):
    def __init__(self):
        self.llm = GeminiLLMClient()
        self.text = PdfTextExtractor()
        self.ocr = TesseractOCR()
        self.num = SimpleNumericValidator()
        self.skills = SimpleSkillMapper()

    def _build_payload(self, applicant_id: str, pre: dict) -> dict:
        doc_text = pre.get('doc_text_summary') or pre.get('doc_text') or ''
        ocr_snips = pre.get('ocr_snippets', {})
        payload = {
            'applicant_id': applicant_id,
            'doc_text': doc_text,
            'ocr_snippets': ocr_snips,
            'canonical_skill_list': list(self.skills.get_canonical_skills().keys()),
            'instructions_schema': SCHEMA,
            'metadata': {'page_count': pre.get('page_count', 0)}
        }
        return payload

    def _validate_response(self, data: dict) -> Tuple[bool, list[str]]:
        flags = []
        try:
            validate(instance=data, schema=SCHEMA)
            return True, flags
        except ValidationError as e:
            flags.append(f'schema_invalid:{e.message}')
            return False, flags

    def _post_validate_normalize(self, resp: dict, ocr_snips: dict):
        flags = []
        needs_review = False
        cgpa_snip = ocr_snips.get('cgpa')
        jee_snip = ocr_snips.get('jee_rank')

        llm_cgpa = None
        for edu in resp.get('education', []) or []:
            if 'grade' in edu and edu.get('grade') is not None:
                llm_cgpa = edu['grade']
                break
        llm_jee = resp.get('jee_rank')

        if cgpa_snip is not None:
            det_cg = self.num.normalize_cgpa(str(cgpa_snip))
            if det_cg['flags']:
                flags.extend([f'cgpa_{f}' for f in det_cg['flags']])
            det_val = det_cg['normalized']
            if det_val is not None:
                if llm_cgpa is not None and abs(float(llm_cgpa) - float(det_val)) > settings.CGPA_MISMATCH_THRESHOLD:
                    flags.append('cgpa_mismatch_overridden')
                    for edu in resp.get('education', []) or []:
                        if 'grade' in edu:
                            edu['grade'] = float(det_val)
                            edu['grade_scale'] = '10'
                            break
                elif llm_cgpa is None:
                    for edu in resp.get('education', []) or []:
                        if 'grade' in edu:
                            edu['grade'] = float(det_val)
                            edu['grade_scale'] = '10'
                            break
        if jee_snip is not None:
            det_jee = self.num.parse_numeric(str(jee_snip))
            if det_jee is not None:
                if llm_jee is not None and int(llm_jee) != int(det_jee):
                    flags.append('jee_rank_mismatch_overridden')
                    resp['jee_rank'] = int(det_jee)
                elif llm_jee is None:
                    resp['jee_rank'] = int(det_jee)

        for edu in resp.get('education', []) or []:
            v = self.num.validate_dates(edu.get('start_date'), edu.get('end_date'))
            if not v['ok'] or v['flags']:
                flags.extend(['education_' + f for f in v['flags']])

        if isinstance(resp.get('skills'), list):
            names = [s.get('name') if isinstance(s, dict) else str(s) for s in resp['skills']]
            resp['skills'] = self.skills.map([n for n in names if n])
            unknowns = [x for x in resp['skills'] if x['canonical_id'] is None]
            if len(unknowns) > settings.MAX_UNKNOWN_SKILLS:
                flags.append('many_unknown_skills')

        try:
            if float(resp.get('llm_confidence', 0)) < settings.LLM_CONFIDENCE_THRESHOLD:
                needs_review = True
        except Exception:
            needs_review = True
        if flags:
            needs_review = True

        return resp, flags, needs_review

    def _preprocess_applicant(self, applicant_dir: str) -> dict:
        p = Path(applicant_dir)
        resume_files = list(p.glob('*'))
        resume_path = None
        for f in resume_files:
            if f.suffix.lower() in ['.pdf', '.docx', '.doc', '.txt'] and 'metadata.json' not in f.name:
                resume_path = str(f)
                break
        result = { 'doc_text': None, 'ocr_snippets': {}, 'page_count': 0 }
        if resume_path and resume_path.lower().endswith('.pdf'):
            raw = self.text.extract_text(resume_path)
            if not raw or len(raw.strip())==0:
                pages = self.ocr.ocr_pdf_pages(resume_path)
                raw = "\n\n".join(pages.values())
                result['page_count'] = len(pages)
            result['doc_text'] = clean_text(raw)
            result['ocr_snippets'] = extract_numeric_snippets(raw)
        else:
            agg = []
            for f in resume_files:
                if f.suffix.lower() in ['.png', '.jpg', '.jpeg', '.tiff']:
                    agg.append(self.ocr.ocr_image(str(f)))
            full = "\n\n".join(agg)
            result['doc_text'] = clean_text(full)
            result['ocr_snippets'] = extract_numeric_snippets(full)
        if len((result['doc_text'] or '').split()) > 2000:
            result['doc_text_summary'] = self.text.summarize(result['doc_text'], max_sentences=10)
        else:
            result['doc_text_summary'] = result['doc_text']
        return result

    def run_parse(self, applicant_root: str, applicant_id: str) -> dict:
        pre = self._preprocess_applicant(applicant_root)
        
        # Log extracted text for debugging
        doc_text = pre.get('doc_text') or ''
        logger.info(f"Extracted text length: {len(doc_text)} characters")
        logger.info(f"First 500 chars: {doc_text[:500]}")
        logger.info(f"OCR snippets: {pre.get('ocr_snippets', {})}")
        
        payload = self._build_payload(applicant_id, pre)

        resp = self.llm.call_parse(settings.GEMINI_SMALL_MODEL, payload, images=None, system_instruction=STRICT_SYSTEM)
        retry_used = False

        if not isinstance(resp, dict) or 'error' in resp:
            resp = self.llm.call_parse(settings.GEMINI_SMALL_MODEL, payload, images=None, system_instruction=STRICTER_SYSTEM)
            retry_used = True

        ok, val_flags = self._validate_response(resp if isinstance(resp, dict) else {})
        flags = list(val_flags)

        low_conf = float(resp.get('llm_confidence', 0)) < settings.LLM_CONFIDENCE_THRESHOLD if isinstance(resp, dict) else True
        if (not ok) or low_conf:
            big = self.llm.call_parse(settings.GEMINI_LARGE_MODEL, payload, images=None, system_instruction=STRICT_SYSTEM)
            if isinstance(big, dict) and 'error' not in big:
                resp = big
                ok, more = self._validate_response(resp)
                flags.extend(more)

        normalized, more_flags, needs_review = self._post_validate_normalize(resp if isinstance(resp, dict) else {}, payload.get('ocr_snippets', {}))
        flags.extend(more_flags)

        provenance = resp.get('_provenance', {}) if isinstance(resp, dict) else {}
        result = {
            'applicant_id': applicant_id,
            'normalized': normalized,
            'flags': flags,
            'needs_review': needs_review,
            'llm_provenance': provenance,
            'preprocess': {'page_count': pre.get('page_count', 0)},
            'retry_used': retry_used,
        }

        # After normalization, append any new skills to taxonomy JSONs
        try:
            skills_list = normalized.get('skills', []) or []
            raw_skill_names = []
            for s in skills_list:
                if isinstance(s, dict):
                    nm = s.get('name')
                    if nm:
                        raw_skill_names.append(str(nm))
            # Identify unknown skills (no canonical_id assigned)
            unknown = [s for s in skills_list if isinstance(s, dict) and not s.get('canonical_id') and s.get('name')]
            unknown_names = [str(s.get('name')) for s in unknown]

            if unknown_names:
                builder = SkillTaxonomyBuilder()
                repo_root = Path(__file__).resolve().parents[2]
                mapping_path = str(repo_root / 'skill_taxonomy.json')
                metadata_path = str(repo_root / 'skill_taxonomy_metadata.json')
                added = builder.append_new_skills(unknown_names, mapping_path, metadata_path)
                if added:
                    # Reload mapper and re-map skills to include newly assigned canonical IDs
                    self.skills.reload_taxonomy()
                    
                    # Sync new skills to database
                    try:
                        from ..db import SessionLocal, CanonicalSkill
                        db_session = SessionLocal()
                        try:
                            for skill_key, metadata in added.items():
                                existing = db_session.query(CanonicalSkill).filter(
                                    CanonicalSkill.skill_id == metadata['skill_id']
                                ).first()
                                if not existing:
                                    canonical_skill = CanonicalSkill(
                                        skill_id=metadata['skill_id'],
                                        name=metadata.get('display_name', skill_key),
                                        category=metadata.get('category', 'other'),
                                        aliases=[skill_key] if skill_key != metadata.get('display_name', '').lower() else [],
                                        market_demand=metadata.get('market_demand', 'unknown'),
                                        related_skills=metadata.get('related_skills', [])
                                    )
                                    db_session.add(canonical_skill)
                            db_session.commit()
                            logger.info(f"Synced {len(added)} new skills to database")
                        finally:
                            db_session.close()
                    except Exception as db_err:
                        logger.error(f"Failed to sync skills to database: {db_err}")
                    
                    names_for_map = []
                    for s in skills_list:
                        if isinstance(s, dict):
                            n = s.get('name')
                            if isinstance(n, str):
                                names_for_map.append(n)
                        elif isinstance(s, str):
                            names_for_map.append(s)
                    remapped = self.skills.map(names_for_map)
                    normalized['skills'] = remapped
                    result['taxonomy_updates'] = {
                        'added_count': len(added),
                        'added': added,
                        'db_synced': True
                    }
        except Exception as e:
            # Non-fatal; include note in result
            result['taxonomy_update_error'] = str(e)

        return result
