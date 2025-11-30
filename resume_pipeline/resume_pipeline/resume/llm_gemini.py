import json, time, requests, re
from typing import Optional, List
from ..config import settings
from ..core.interfaces import LLMClient

class GeminiLLMClient(LLMClient):
    def __init__(self, api_key: Optional[str] = None, base_url: Optional[str] = None):
        self.api_key = api_key or settings.GEMINI_API_KEY
        self.base_url = base_url or settings.GEMINI_API_URL

    def _mock_parse(self, model_name: str, payload: dict) -> dict:
        text = payload.get('doc_text') or ''
        ocr = payload.get('ocr_snippets') or {}
        email = None
        m = re.search(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}", text)
        if m:
            email = m.group(0)
        # very naive skills: include canonical terms found in text
        skills = []
        for sk in payload.get('canonical_skill_list', []):
            if sk.lower() in text.lower():
                skills.append({"name": sk, "canonical_id": None})
        resp = {
            "applicant_id": payload.get('applicant_id'),
            "personal": {"name": None, "email": email, "phone": None, "location": None},
            "education": [],
            "skills": skills,
            "ocr_snippets": ocr,
            "jee_rank": None,
            "llm_confidence": 0.9,
            "flags": [],
            "_provenance": {"model": model_name, "latency": 0.0, "mock": True}
        }
        return resp

    def call_parse(self, model_name: str, payload: dict, images: Optional[List[str]] = None, system_instruction: Optional[str] = None) -> dict:
        if settings.GEMINI_MOCK_MODE or (self.base_url and "example" in self.base_url):
            return self._mock_parse(model_name, payload)
        
        # Use real Google Gemini API
        start = time.time()
        
        # Build the prompt
        doc_text = payload.get('doc_text', '')
        schema = payload.get('instructions_schema', {})
        canonical_skills = payload.get('canonical_skill_list', [])
        applicant_id = payload.get('applicant_id', '')
        
        prompt = f"""You are a resume parser. Extract information from the following resume text and return ONLY valid JSON matching this schema.

Resume Text:
{doc_text}

Available Skills (use these canonical names when possible):
{', '.join(canonical_skills[:50])}

Return JSON with this structure:
{{
  "applicant_id": "{applicant_id}",
  "personal": {{
    "name": "Full name from resume",
    "email": "email@example.com",
    "phone": "phone number",
    "location": "City, State"
  }},
  "education": [
    {{
      "institution": "University/College name",
      "degree": "Degree name",
      "field": "Field of study",
      "start_date": "YYYY-MM",
      "end_date": "YYYY-MM",
      "grade": 8.5,
      "grade_scale": "10"
    }}
  ],
  "experience": [
    {{
      "company": "Company name",
      "title": "Job title",
      "start_date": "YYYY-MM",
      "end_date": "YYYY-MM or Present",
      "description": "Brief description"
    }}
  ],
  "skills": [
    {{"name": "skill1"}},
    {{"name": "skill2"}}
  ],
  "jee_rank": null,
  "llm_confidence": 0.9
}}

Return ONLY the JSON object, no other text."""

        # Call Google Gemini API
        url = f"{self.base_url}/models/{model_name}:generateContent?key={self.api_key}"
        headers = {"Content-Type": "application/json"}
        body = {
            "contents": [{
                "parts": [{
                    "text": prompt
                }]
            }],
            "generationConfig": {
                "temperature": 0.1,
                "topK": 1,
                "topP": 1,
                "maxOutputTokens": 8192,
                "responseMimeType": "application/json"
            }
        }
        
        try:
            r = requests.post(url, headers=headers, json=body, timeout=60)
            latency = time.time() - start
            
            if r.status_code != 200:
                print(f"Gemini API Error: {r.status_code} - {r.text}")
                return {"error": f"status {r.status_code}", "raw_text": r.text, "_provenance": {"model": model_name, "latency": latency, "mock": False}}
            
            result = r.json()
            
            # Extract the generated text from Gemini response
            if 'candidates' in result and len(result['candidates']) > 0:
                candidate = result['candidates'][0]
                if 'content' in candidate and 'parts' in candidate['content']:
                    generated_text = candidate['content']['parts'][0].get('text', '{}')
                    
                    # Parse the JSON response
                    try:
                        parsed_data = json.loads(generated_text)
                        
                        # Add provenance and missing fields
                        parsed_data['_provenance'] = {"model": model_name, "latency": latency, "mock": False}
                        parsed_data['flags'] = []
                        parsed_data['ocr_snippets'] = payload.get('ocr_snippets', {})
                        
                        # Ensure required fields exist
                        if 'applicant_id' not in parsed_data:
                            parsed_data['applicant_id'] = applicant_id
                        if 'personal' not in parsed_data:
                            parsed_data['personal'] = {"name": None, "email": None, "phone": None, "location": None}
                        if 'education' not in parsed_data:
                            parsed_data['education'] = []
                        if 'skills' not in parsed_data:
                            parsed_data['skills'] = []
                        if 'llm_confidence' not in parsed_data:
                            parsed_data['llm_confidence'] = 0.8
                        if 'jee_rank' not in parsed_data:
                            parsed_data['jee_rank'] = None
                        
                        return parsed_data
                    except json.JSONDecodeError as e:
                        print(f"Failed to parse Gemini JSON response: {e}")
                        print(f"Response text: {generated_text}")
                        return {"error": f"JSON parse error: {e}", "raw_text": generated_text, "_provenance": {"model": model_name, "latency": latency, "mock": False}}
            
            return {"error": "No valid response from Gemini", "raw_response": result, "_provenance": {"model": model_name, "latency": latency, "mock": False}}
        
        except Exception as e:
            latency = time.time() - start
            print(f"Exception calling Gemini API: {e}")
            return {"error": str(e), "_provenance": {"model": model_name, "latency": latency, "mock": False}}

    def call_rerank(self, model_name: str, payload: dict) -> dict:
        headers = {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}
        body = {"model": model_name, "input": payload}
        r = requests.post(self.base_url + "/rerank", headers=headers, data=json.dumps(body), timeout=60)
        if r.status_code != 200:
            return {"error": f"status {r.status_code}", "raw_text": r.text}
        return r.json()
