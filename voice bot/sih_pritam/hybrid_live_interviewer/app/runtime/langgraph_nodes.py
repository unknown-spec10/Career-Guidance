from langgraph.graph import StateGraph, END
from typing import Dict, Any
from app.logger import logger
from app.utils.prompts import build_llm_prompt, build_reprompt
from app.utils.validator import validate_single_question
import uuid

graph = StateGraph(dict)

@graph.node
async def fusion(state: Dict[str, Any]):
    stt_partial = state.get("stt_partial", {})
    audio_features = state.get("audio_features", {})
    vad = state.get("vad_state", "unknown")
    fused = {
        "text_partial": stt_partial.get("text", ""),
        "is_final": stt_partial.get("is_final", False),
        "stt_conf": stt_partial.get("confidence", 0.0),
        "audio_features": audio_features,
        "vad": vad,
    }
    state["fused"] = fused
    return state

@graph.node
async def intent_classifier(state: Dict[str, Any]):
    text = state["fused"]["text_partial"]
    text_l = (text or "").strip().lower()
    intent = "answer"
    if not text_l:
        intent = "silence"
    elif any(text_l.startswith(w) for w in ["pause","stop","resume","repeat"]):
        intent = "command"
    elif text_l.endswith("?") or text_l.split(" ")[0] in ["what","how","why","when","where","who","which"]:
        intent = "question"
    elif "also" in text_l and ("," in text_l or "?" in text_l):
        intent = "multi_question"
    state["intent"] = intent
    return state

@graph.node
async def safety_checker(state: Dict[str, Any]):
    text = state["fused"]["text_partial"]
    profane = any(word in (text or "").lower() for word in ["damn","shit","hell"])
    if profane:
        state["safety"] = {"safe": False, "action": "deescalate"}
    else:
        state["safety"] = {"safe": True, "action": "continue"}
    return state

@graph.node
async def router(state: Dict[str, Any]):
    if not state["safety"]["safe"]:
        state["route"] = "deescalate"
        return state
    intent = state.get("intent", "answer")
    stt_conf = state["fused"].get("stt_conf", 0.0)
    text = state["fused"]["text_partial"]
    wc = len((text or "").split())
    if intent == "command":
        state["route"] = "command_handler"
    elif intent == "question":
        state["route"] = "clarify_engine"
    elif intent == "multi_question":
        state["route"] = "multiq_handler"
    elif wc < 6 or stt_conf < 0.5:
        state["route"] = "clarify_engine"
    else:
        state["route"] = "question_generator"
    return state

@graph.node
async def tool_executor(state: Dict[str, Any]):
    tool_request = state.get("tool_request")
    if tool_request:
        state["tool_result"] = {"docs": [{"id":"doc1","text":"sample"}]}
    return state

@graph.node
async def question_generator(state: Dict[str, Any]):
    session = state.get("session")
    if not session:
        state["question_candidate"] = {"text":"Tell me about a recent project you led?","type":"new","topic":"projects"}
        return state
    llm_context = {
        "last_answer": state["fused"]["text_partial"],
        "memory": [m.dict() for m in getattr(session.state, "memory", [])][-8:],
        "mode": getattr(session.state, "mode").value if getattr(session.state, "mode", None) else "resume",
    }
    raw = await session.llm.generate_question(llm_context)
    if isinstance(raw, dict) and "text" in raw:
        state["question_candidate"] = raw
    elif isinstance(raw, str):
        parsed = validate_single_question(raw)
        state["question_candidate"] = parsed if parsed else {"text": raw, "type":"new", "topic":None}
    else:
        state["question_candidate"] = {"text":"Tell me about a recent project you led?","type":"new","topic":"projects"}
    return state

@graph.node
async def validator(state: Dict[str, Any]):
    qc = state.get("question_candidate")
    if not qc or "text" not in qc:
        state["valid"] = False
        state["reason"] = "no_question"
        return state
    text = qc["text"].strip()
    if len(text.split()) > 60:
        state["valid"] = False
        state["reason"] = "too_long"
        return state
    if text.count("?") > 1:
        state["valid"] = False
        state["reason"] = "multiple_questions"
        return state
    state["valid"] = True
    state["validated_question"] = qc
    return state

@graph.node
async def repair(state: Dict[str, Any]):
    if state.get("valid"):
        return state
    session = state.get("session")
    prev = state.get("question_candidate")
    if prev and "text" in prev:
        txt = prev["text"]
        if "?" in txt:
            first = txt.split("?")[0].strip() + "?"
        else:
            first = " ".join(txt.splitlines()[:1])
        repaired = {"text": first, "type": prev.get("type","new"), "topic": prev.get("topic")}
        parsed = validate_single_question(repaired)
        if parsed:
            state["validated_question"] = parsed
            state["valid"] = True
            return state
    if session:
        rr = await session.llm.generate_question({"_repr": True, "last_answer": state["fused"]["text_partial"], "memory": [m.dict() for m in getattr(session.state, "memory",[])]})
        if isinstance(rr, dict) and "text" in rr:
            state["validated_question"] = rr
            state["valid"] = True
            return state
        elif isinstance(rr, str):
            parsed = validate_single_question(rr)
            if parsed:
                state["validated_question"] = parsed
                state["valid"] = True
                return state
    state["validated_question"] = {"text":"Can you describe one recent project you worked on?","type":"new","topic":"projects"}
    state["valid"] = True
    return state

@graph.node
async def tts_stream(state: Dict[str, Any]):
    q = state.get("validated_question")
    session = state.get("session")
    if not q or not session:
        return state
    text = q["text"]
    tts_res = await session.tts.synthesize(text)
    state["tts_audio"] = tts_res.get("audio_bytes")
    import base64
    state["tts_audio_b64"] = base64.b64encode(state["tts_audio"]).decode()
    session.state.last_question = text
    return state

@graph.node
async def memory_updater(state: Dict[str, Any]):
    session = state.get("session")
    q = state.get("validated_question")
    if session and q:
        session.state.memory.append({"id": str(uuid.uuid4()), "question": q["text"], "answer": ""})
    return state
