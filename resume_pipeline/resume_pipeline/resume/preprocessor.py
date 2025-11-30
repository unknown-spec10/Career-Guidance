import subprocess, re
from pathlib import Path
from typing import Dict
import pytesseract
from pdf2image import convert_from_path
from pdfminer.high_level import extract_text
import easyocr
import pdfplumber

from ..core.interfaces import TextExtractor, OCRService

reader = easyocr.Reader(["en"])  # may be slow on import

class PdfTextExtractor(TextExtractor):
    def extract_text(self, path: str) -> str:
        # 1) Try pdfplumber for accurate layout-preserving extraction
        try:
            with pdfplumber.open(path) as pdf:
                pages_text = []
                for page in pdf.pages:
                    pages_text.append(page.extract_text(x_tolerance=2, y_tolerance=2) or "")
                text = "\n\n".join(pages_text)
                if text and len(text.strip()) > 0:
                    return text
        except Exception:
            pass
        # 2) Fallback to pdfminer.six
        try:
            text = extract_text(path)
            if text and len(text.strip()) > 0:
                return text
        except Exception:
            pass
        # 3) Fallback to system pdftotext if available
        try:
            out = subprocess.check_output(["pdftotext", path, "-"])
            return out.decode("utf-8", errors="ignore")
        except Exception:
            return ""

    def summarize(self, text: str, max_sentences: int) -> str:
        sentences = re.split(r'(?<=[.!?])\s+', text)
        if len(sentences) <= max_sentences:
            return text
        scored = [(s, (len(s), bool(re.search(r'\d', s)))) for s in sentences]
        scored_sorted = sorted(scored, key=lambda x: (x[1][1], x[1][0]), reverse=True)
        chosen = [s for s, _ in scored_sorted[:max_sentences]]
        return " ".join(chosen)


class TesseractOCR(OCRService):
    def ocr_image(self, path: str) -> str:
        try:
            return pytesseract.image_to_string(path)
        except Exception:
            result = reader.readtext(path, detail=0)
            # Coerce each item to str before joining to satisfy typing and handle mixed item types
            return "\n".join(map(str, result))

    def ocr_pdf_pages(self, path: str) -> Dict[int, str]:
        pages = convert_from_path(path)
        ocr_text = {}
        for i, page in enumerate(pages, start=1):
            tmp = Path(path).parent / f"_tmp_page_{i}.png"
            page.save(tmp, "PNG")
            ocr_text[i] = self.ocr_image(str(tmp))
            try:
                tmp.unlink(missing_ok=True)
            except Exception:
                pass
        return ocr_text


def clean_text(text: str) -> str:
    s = text.replace('\r','\n')
    s = re.sub(r"\n{2,}", "\n\n", s)
    s = re.sub(r"[^\x00-\x7F]+"," ", s)
    return s.strip()


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
        snippets['jee_rank'] = jee.group(1).replace(',','')
    # Match full 4-digit years only
    years = re.findall(r"\b(?:19|20)\d{2}\b", text)
    if years:
        snippets['years'] = list(set(years))
    return snippets
