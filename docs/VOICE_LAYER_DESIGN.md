# Voice Layer Design — Interview System
### STT Strategy, Tradeoffs & Ideal Architecture

---

## The Decision We Had to Make

For Speech-to-Text (STT), two options were on the table:

1. **Groq Whisper large-v3** — high accuracy, API-based
2. **Web Speech API** — browser-native, real-time, free

The instinct was to use Whisper large-v3 for everything because it is the higher
quality model. This is the right instinct — but the wrong application of it.
Here is why.

---

## Why Whisper-Only is the Wrong Choice Here

### The Latency Problem

Whisper large-v3 via Groq requires this flow for every single answer:

```
User finishes speaking
→ Browser packages audio into a blob (WebM/MP3)
→ POST audio file to your FastAPI backend     (network upload: 200-500ms)
→ Backend forwards audio to Groq Whisper API  (processing: 500-1500ms)
→ Transcript comes back
→ Frontend displays what the user just said
```

**Total delay: 700ms - 2000ms after every answer.**

For a 10-question interview, the user hits this wall 10 times. That is not a
minor inconvenience — it fundamentally breaks the interview rhythm. Speaking
naturally requires seeing your words appear as you talk. A 1-2 second delay
after every answer makes the experience feel broken, not polished.

### The Feedback Loop Problem

In a real interview, you hear yourself speak. You self-correct. You know what
you said. With Whisper-only, the user speaks into silence and then waits to
find out what the system heard. That is deeply unnatural.

Web Speech API solves this by design — words appear on screen in real time as
the user speaks. This is not just a nice-to-have. It is the difference between
the voice mode feeling like a real interview versus feeling like leaving a
voicemail.

### The Cost Problem

Groq's Whisper is free tier — but every audio file upload counts against your
API quota. If you send every answer through Whisper (10 questions × every user
× every session), you will burn through free tier faster than any other part of
the system. The LLaMA 3 calls for question generation and evaluation are text —
cheap and fast. Audio transcription is significantly heavier.

---

## Why Web Speech API Alone is Also Not Enough

Web Speech API is browser-native and has real limitations:

- **Accuracy varies** significantly by accent, background noise, and browser
- **No punctuation** in most implementations — transcripts come back as a
  wall of words
- **Chrome-dependent** — works best in Chrome, inconsistent in Firefox and
  Safari
- **No offline support** — it actually sends audio to Google's servers
  internally (you just don't control it)
- **Fails silently** on some devices and OS combinations

For a professional tool being used in a mock interview context, these failure
modes matter. A candidate with a non-native accent or a noisy environment will
get a garbled transcript and a poor evaluation score — not because their answer
was bad but because the STT failed them.

---

## The Ideal Solution — Hybrid Architecture

Do not choose between them. Layer them:

```
Web Speech API         →   Real-time display WHILE user is speaking
       +
Groq Whisper large-v3  →   Silent quality correction AFTER user finishes
```

### How It Feels to the User

```
User speaks:
  "I think the main difference is that REST uses fixed endpoints..."
  → Words appear live on screen as they speak        [Web Speech API]
  → User sees their answer being transcribed in real time

User stops speaking:
  → Transcript looks complete on screen
  → In the background: audio blob sent to Groq Whisper
  → Whisper produces a cleaner, more accurate version
  → If Whisper's version differs: transcript silently updates on screen
  → User reviews final transcript and clicks Submit   [Groq Whisper result]
```

The user gets:
- **Immediate feedback** — they see words appearing as they speak
- **High accuracy** — the final submitted answer is Whisper-quality
- **No frustrating wait** — the Whisper call happens in the background
  while the user is naturally pausing after finishing their answer

### The Timeline

```
0ms      User starts speaking
0ms      Web Speech API begins transcribing live
~3000ms  User finishes speaking (average answer: 20-40 seconds)
3000ms   Browser sends audio blob to backend (background, non-blocking)
3000ms   User sees "complete" transcript on screen
4000ms   Whisper returns corrected transcript
4000ms   Screen silently updates if correction differs
5000ms   User clicks Submit (they had ~1-2 seconds to review)
```

The Whisper latency (1-2 seconds) is hidden inside the natural pause after
speaking. The user does not wait for it — it completes while they are reading
their own answer.

---

## Implementation Design

### Frontend — Three Parallel Jobs

```javascript
const useVoiceAnswer = () => {
  const [liveTranscript, setLiveTranscript] = useState("");
  const [finalTranscript, setFinalTranscript] = useState("");
  const [isListening, setIsListening] = useState(false);
  const audioChunksRef = useRef([]);
  const mediaRecorderRef = useRef(null);

  const startRecording = async () => {
    // Job 1: Web Speech API — live display
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((r) => r[0].transcript)
        .join("");
      setLiveTranscript(transcript); // Shows live on screen
    };
    recognition.start();

    // Job 2: MediaRecorder — capture audio blob for Whisper
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream);
    audioChunksRef.current = [];

    recorder.ondataavailable = (e) => audioChunksRef.current.push(e.data);
    recorder.start();
    mediaRecorderRef.current = recorder;

    setIsListening(true);
    return { recognition, recorder, stream };
  };

  const stopRecording = async ({ recognition, recorder, stream }) => {
    // Stop live transcription
    recognition.stop();
    setIsListening(false);

    // Stop audio recording
    recorder.stop();
    stream.getTracks().forEach((t) => t.stop());

    // Job 3: Send audio to Whisper in background (non-blocking)
    recorder.onstop = async () => {
      const audioBlob = new Blob(audioChunksRef.current, {
        type: "audio/webm",
      });

      // Don't await — runs in background while user reads their transcript
      sendToWhisper(audioBlob).then((whisperTranscript) => {
        if (whisperTranscript && whisperTranscript !== liveTranscript) {
          setFinalTranscript(whisperTranscript); // Silent correction
        } else {
          setFinalTranscript(liveTranscript); // Web Speech was accurate enough
        }
      });
    };
  };

  const sendToWhisper = async (audioBlob) => {
    const formData = new FormData();
    formData.append("audio", audioBlob, "answer.webm");

    try {
      const res = await fetch("/api/interview/transcribe", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      return data.transcript;
    } catch {
      return null; // Whisper failed — keep Web Speech result, do not block
    }
  };

  // The answer text to actually submit:
  // finalTranscript if Whisper finished, liveTranscript as fallback
  const answerToSubmit = finalTranscript || liveTranscript;

  return {
    liveTranscript,
    finalTranscript,
    answerToSubmit,
    isListening,
    startRecording,
    stopRecording,
  };
};
```

---

### Backend — Whisper Transcription Endpoint

```python
# voice.py

from fastapi import APIRouter, UploadFile, File, HTTPException
from groq import Groq
import logging

router = APIRouter()
logger = logging.getLogger(__name__)
groq_client = Groq(api_key=settings.GROQ_API_KEY)


@router.post("/api/interview/transcribe")
async def transcribe_audio(audio: UploadFile = File(...)):
    """
    Accepts a WebM audio blob from the browser.
    Returns a high-accuracy transcript via Groq Whisper large-v3.
    Called in the background after user stops speaking.
    """
    try:
        audio_bytes = await audio.read()

        # Validate size — reject if too large (>25MB Groq limit)
        if len(audio_bytes) > 25 * 1024 * 1024:
            raise HTTPException(
                status_code=413,
                detail="Audio file too large. Max 25MB."
            )

        transcription = groq_client.audio.transcriptions.create(
            model="whisper-large-v3",
            file=("answer.webm", audio_bytes, "audio/webm"),
            language="en",
            response_format="text"
        )

        return {"transcript": transcription}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Whisper transcription failed: {e}")
        # Return empty — frontend falls back to Web Speech result
        return {"transcript": None}
```

---

## Failure Modes & How Each Is Handled

| Failure | What Happens |
|---|---|
| Web Speech API unavailable (Firefox/Safari) | Skip live display, use Whisper-only with a recording spinner |
| Groq Whisper API fails | Keep the Web Speech transcript — interview continues normally |
| Both fail simultaneously | Show text input fallback — user types their answer |
| User in noisy environment | Whisper handles background noise better than Web Speech |
| Non-native accent | Whisper large-v3 is significantly better than Web Speech for accents |
| User stops mid-sentence | Web Speech shows partial, Whisper corrects to best interpretation |

### The Fallback Chain

```
Voice Mode enabled
        ↓
Web Speech API available?
  YES → Live display + Whisper correction in background
  NO  → Recording spinner + Whisper-only (user waits ~1-2s after stopping)
        ↓
Whisper call succeeds?
  YES → Use Whisper transcript
  NO  → Use Web Speech transcript
        ↓
Web Speech transcript available?
  YES → Use it
  NO  → Show text input — "Voice unavailable, please type your answer"
```

The interview never breaks. Every failure degrades gracefully to the next option.

---

## TTS — Browser SpeechSynthesis

For reading questions aloud, browser SpeechSynthesis is the right call for v1.

**Why it is sufficient:**
- Zero latency — no API call, reads instantly
- Free — no quota, no cost
- Works offline
- Adequate quality for reading structured interview questions

**Its one weakness:** robotic voice quality.

**Why this is acceptable:** the candidate is focused on the question content, not
the voice quality. A slightly robotic voice reading "Explain the difference
between REST and GraphQL" is completely fine. The content is what matters.

### Implementation

```javascript
const speakQuestion = (questionText) => {
  // Cancel any ongoing speech first
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(questionText);
  utterance.rate = 0.9;    // Slightly slower — more natural for interview context
  utterance.pitch = 1.0;
  utterance.volume = 1.0;

  // Prefer a natural-sounding voice if available
  const voices = window.speechSynthesis.getVoices();
  const preferred = voices.find(
    (v) =>
      v.name.includes("Google US English") ||
      v.name.includes("Samantha") ||       // macOS natural voice
      v.name.includes("Natural")
  );
  if (preferred) utterance.voice = preferred;

  window.speechSynthesis.speak(utterance);
};
```

### TTS Upgrade Path (v2)

When voice quality becomes a priority, the upgrade is **Kokoro TTS**:
- Apache 2.0 license — fully free, self-hostable
- Runs on CPU — no GPU required
- Significantly more natural than browser SpeechSynthesis
- Deployed as a sidecar service alongside your FastAPI backend
- Frontend calls `/api/tts?text=...` → receives audio blob → plays it

This is a drop-in swap. No interview logic changes — just the audio output source.

---

## Summary

| Component | Choice | Reason |
|---|---|---|
| STT — live display | Web Speech API | Zero latency, real-time word appearance |
| STT — final accuracy | Groq Whisper large-v3 | High accuracy, accent-robust, runs in background |
| STT — strategy | Hybrid (both layered) | Speed of browser + accuracy of Whisper |
| TTS — v1 | Browser SpeechSynthesis | Free, instant, good enough |
| TTS — v2 upgrade | Kokoro TTS | Natural voice, self-hosted, Apache 2.0 |

**The core principle:** Web Speech API handles the user experience (real-time
feedback). Groq Whisper handles the accuracy (correct final transcript). They
are not alternatives — they do different jobs and work together.

---

*This document is a companion to [INTERVIEW_SYSTEM_ARCHITECTURE.md](./INTERVIEW_SYSTEM_ARCHITECTURE.md).
Read that first for the full system context.*
