from typing import Any


CLIENT_EVENT_TYPES = {"audio", "text", "control"}
CONTROL_ACTIONS = {"start_turn", "end_turn", "pause", "resume", "ping", "disconnect"}
SERVER_EVENT_TYPES = {"audio", "transcription", "control", "error"}


def parse_client_event(payload: dict[str, Any]) -> dict[str, Any]:
    event_type = payload.get("type")
    if event_type not in CLIENT_EVENT_TYPES:
        raise ValueError("Invalid client event type")

    if event_type == "audio":
        chunk_base64 = payload.get("chunk_base64")
        if not isinstance(chunk_base64, str) or not chunk_base64:
            raise ValueError("Audio event requires non-empty chunk_base64")
        mime_type = payload.get("mime_type") or "audio/pcm"
        return {
            "type": "audio",
            "sequence": int(payload.get("sequence", 0)),
            "chunk_base64": chunk_base64,
            "mime_type": str(mime_type),
        }

    if event_type == "text":
        text = payload.get("text")
        if not isinstance(text, str) or not text.strip():
            raise ValueError("Text event requires non-empty text")
        return {
            "type": "text",
            "text": text.strip(),
        }

    action = payload.get("action")
    if action not in CONTROL_ACTIONS:
        raise ValueError("Invalid control action")
    return {
        "type": "control",
        "action": action,
    }


def to_gemini_event(client_event: dict[str, Any]) -> dict[str, Any] | None:
    event_type = client_event["type"]

    if event_type == "audio":
        return {
            "realtimeInput": {
                "mediaChunks": [
                    {
                        "mimeType": client_event["mime_type"],
                        "data": client_event["chunk_base64"],
                    }
                ]
            }
        }

    if event_type == "text":
        return {
            "clientContent": {
                "turns": [
                    {
                        "role": "user",
                        "parts": [{"text": client_event["text"]}],
                    }
                ],
                "turnComplete": True,
            }
        }

    if client_event["action"] == "end_turn":
        return {"clientContent": {"turnComplete": True}}

    if client_event["action"] == "start_turn":
        return {"clientContent": {"turnComplete": False}}

    # pause/resume/ping/disconnect are handled by bridge control flow.
    return None


def from_gemini_event(event: dict[str, Any]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []

    server_content = event.get("serverContent") or event.get("server_content")
    if isinstance(server_content, dict):
        model_turn = server_content.get("modelTurn") or {}
        parts = model_turn.get("parts") or []

        for part in parts:
            if not isinstance(part, dict):
                continue

            inline_data = part.get("inlineData") or part.get("inline_data")
            if isinstance(inline_data, dict) and inline_data.get("data"):
                out.append(
                    {
                        "type": "audio",
                        "chunk_base64": inline_data["data"],
                        "mime_type": inline_data.get("mimeType") or inline_data.get("mime_type") or "audio/pcm",
                    }
                )

            text_val = part.get("text")
            if isinstance(text_val, str) and text_val.strip():
                out.append(
                    {
                        "type": "transcription",
                        "role": "model",
                        "text": text_val,
                        "is_final": bool(server_content.get("turnComplete") or server_content.get("turn_complete")),
                    }
                )

        # Some responses include direct output transcription fields.
        output_transcription = server_content.get("outputTranscription") or server_content.get("output_transcription")
        if isinstance(output_transcription, dict):
            text_val = output_transcription.get("text")
            if isinstance(text_val, str) and text_val.strip():
                out.append(
                    {
                        "type": "transcription",
                        "role": "model",
                        "text": text_val,
                        "is_final": bool(output_transcription.get("finished") or output_transcription.get("is_final")),
                    }
                )

    input_transcription = event.get("inputTranscription") or event.get("input_transcription")
    if isinstance(input_transcription, dict):
        text_val = input_transcription.get("text")
        if isinstance(text_val, str) and text_val.strip():
            out.append(
                {
                    "type": "transcription",
                    "role": "user",
                    "text": text_val,
                    "is_final": bool(input_transcription.get("finished") or input_transcription.get("is_final")),
                }
            )

    if not out:
        out.append({"type": "control", "action": "ack"})

    return out
