import re
from ..core.interfaces import NumericValidator

class SimpleNumericValidator(NumericValidator):
    def parse_numeric(self, s: str):
        try:
            s = s.replace(',', '')
            if '.' in s:
                return float(s)
            return int(s)
        except Exception:
            return None

    def normalize_cgpa(self, value):
        flags = []
        if value is None:
            return {"normalized": None, "flags": ["missing"]}
        if isinstance(value, str):
            m = re.match(r"([0-9]+\.?[0-9]*)(?:/([0-9]+\.?[0-9]*))?", value)
            if m:
                num = float(m.group(1))
                denom = float(m.group(2)) if m.group(2) else None
            else:
                num = self.parse_numeric(value)
                denom = None
        else:
            try:
                num = float(value)
            except Exception:
                num = None
            denom = None
        if num is None:
            flags.append('parse_error')
            return {"normalized": None, "flags": flags}
        if denom:
            normalized = num/denom*10.0
        else:
            if num <= 10:
                normalized = num
            elif num <= 100:
                normalized = num/10.0
            else:
                normalized = None
                flags.append('unusual_scale')
        return {"normalized": normalized, "flags": flags}

    def validate_dates(self, start, end):
        flags = []
        if not start or not end:
            return {"ok": True, "flags": flags}
        try:
            s = str(start).split('T')[0]
            e = str(end).split('T')[0]
            if s > e:
                flags.append('date_inconsistent')
                return {"ok": False, "flags": flags}
        except Exception:
            flags.append('date_parse_error')
        return {"ok": True, "flags": flags}
