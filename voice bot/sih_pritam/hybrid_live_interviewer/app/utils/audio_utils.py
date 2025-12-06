import base64

def decode_base64_audio(b64: str) -> bytes:
    return base64.b64decode(b64)

def ensure_wav_bytes(raw: bytes, sr: int = 16000) -> bytes:
    # Assume raw is valid WAV/PCM; conversion if needed should be implemented here.
    return raw
