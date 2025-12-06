import json

SYSTEM_PROMPT = (
    "You are a professional technical interviewer agent. Follow the rules:\n"
    "1) Output a single JSON object with keys: text, type (followup|new), topic.\n"
    "2) Keep text short (<= 30 words) and TTS-friendly.\n"
    "3) If the last answer is short/vague, produce a targeted follow-up.\n"
)

REPROMPT_INSTRUCTION = (
    "Your previous output was invalid. Return EXACTLY one JSON object and nothing else.\n"
    "Format: {\"text\":\"<one short question>\", \"type\":\"followup|new\", \"topic\":\"<topic>\"}\n"
    "Keep the question short and suitable for TTS.\n"
)

REPAIR_FEWSHOT = (
    "Invalid: 'Tell me about A? Also explain B and C.'\n"
    "Fixed: {\"text\":\"Tell me about a time you solved a difficult problem?\",\"type\":\"new\",\"topic\":\"projects\"}\n"
)

LLM_PROMPT_TEMPLATE = """{system}

CONTEXT:
- mode: {mode}
- last_answer: {last_answer}
- memory: {memory}

INSTRUCTION:
Return a single JSON object ONLY with keys: text, type (followup|new), topic.
Keep text <= 30 words and TTS-friendly. If the last answer is short or unclear, prefer a follow-up question.
""".strip()

def build_llm_prompt(context: dict, system: str = SYSTEM_PROMPT) -> str:
    return LLM_PROMPT_TEMPLATE.format(system=system, mode=context.get("mode","resume"),
                                      last_answer=context.get("last_answer",""),
                                      memory=json.dumps(context.get("memory",[])[-6:]))
def build_reprompt():
    return SYSTEM_PROMPT + "\n\n" + REPROMPT_INSTRUCTION + "\n" + REPAIR_FEWSHOT
