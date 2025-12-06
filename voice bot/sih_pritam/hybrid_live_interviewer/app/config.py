import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    GROQ_API_URL = os.getenv("GROQ_API_URL")
    GROQ_API_KEY = os.getenv("GROQ_API_KEY")
    GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")

    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
    COQUI_MODEL = os.getenv("COQUI_MODEL", "tts_models/en/ljspeech/tacotron2-DDC")

    HOST = os.getenv("HOST", "0.0.0.0")
    PORT = int(os.getenv("PORT", 8000))

settings = Settings()
