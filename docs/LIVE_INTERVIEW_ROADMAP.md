# Live Interview Implementation Roadmap

## Directory Structure

### Backend New Directories
```
resume_pipeline/
├── resume_pipeline/
│   ├── live_interview/                    # NEW - Live Interview System
│   │   ├── __init__.py
│   │   ├── gemini_live_client.py         # Gemini Live API WebSocket client
│   │   ├── websocket_handler.py          # FastAPI WebSocket endpoint
│   │   ├── live_session_manager.py       # Session lifecycle manager
│   │   ├── audio_processor.py            # Audio encoding/decoding
│   │   ├── transcription_service.py      # Process live transcriptions
│   │   ├── interview_evaluator.py        # Post-session scoring
│   │   ├── credit_handler.py             # Live session credit management
│   │   └── constants.py                  # Live interview constants
│   │
│   ├── routes/
│   │   └── live_interview.py             # NEW - Live interview REST endpoints
│   │
│   └── app.py                             # MODIFIED - Add WebSocket routes
│
└── tests/
    └── test_live_interview.py             # NEW - Live interview tests
```

### Frontend New Directories
```
frontend/src/
├── components/
│   ├── interview/                         # EXISTING - Modify this
│   │   └── ... (existing components)
│   │
│   └── live-interview/                    # NEW - Live interview UI
│       ├── LiveInterviewPage.jsx
│       ├── AudioRecorder.jsx
│       ├── AudioPlayer.jsx
│       ├── LiveInterviewControls.jsx
│       ├── TranscriptionDisplay.jsx
│       ├── InterviewMetrics.jsx
│       ├── SessionTimer.jsx              # Reuse from previous refactor
│       └── ConnectionStatus.jsx
│
├── hooks/
│   ├── useLiveInterview.js                # NEW - Generic live interview logic
│   ├── useAudioRecorder.js                # NEW - Audio capture hook
│   ├── useAudioPlayer.js                  # NEW - Audio playback hook
│   ├── useWebSocketStream.js              # NEW - WebSocket connection hook
│   └── useInterviewSession.js             # EXISTING - Reuse if possible
│
├── utils/
│   ├── audioUtils.js                      # NEW - Audio conversion utilities
│   ├── pcmEncoder.js                      # NEW - PCM 16-bit encoding
│   └── webSocketClient.js                 # NEW - WebSocket utility class
│
└── pages/
    ├── LiveInterviewPage.jsx              # NEW - Main live interview page
    └── InterviewSessionPage.jsx           # EXISTING - Keep for backward compatibility
```

## Phase 1: Backend Foundation

### Step 1.1: Create Gemini Live Client
**File**: `resume_pipeline/live_interview/gemini_live_client.py`

```python
"""
Manages WebSocket connection to Google Gemini Live API
"""
import asyncio
import json
import logging
from typing import Optional, AsyncGenerator
import websockets
from websockets.asyncio.client import ClientConnection

logger = logging.getLogger(__name__)

class GeminiLiveClient:
    """WebSocket client for Gemini Live API"""
    
    API_URL = "wss://generativelanguage.googleapis.com/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent"
    
    def __init__(self, api_key: str, model: str = "gemini-2.0-flash-exp"):
        self.api_key = api_key
        self.model = model
        self.ws: Optional[ClientConnection] = None
        self.session_id = None
        
    async def connect(self, system_prompt: str = "") -> str:
        """
        Establish WebSocket connection to Gemini Live API
        Returns: session_id
        """
        try:
            url = f"{self.API_URL}?key={self.api_key}"
            self.ws = await websockets.connect(url)
            
            # Send initial setup message
            setup_message = {
                "setup": {
                    "model": f"models/{self.model}",
                    "generation_config": {
                        "temperature": 0.7,
                        "max_output_tokens": 1024,
                    },
                    "system_instruction": {
                        "parts": [
                            {"text": system_prompt or "You are an expert interviewer."}
                        ]
                    }
                }
            }
            
            await self.ws.send(json.dumps(setup_message))
            logger.info(f"Connected to Gemini Live API: {self.model}")
            
            return self.model  # Return session identifier
        except Exception as e:
            logger.error(f"Failed to connect to Gemini Live API: {e}")
            raise
    
    async def send_audio(self, audio_chunk: bytes):
        """
        Send audio chunk to Gemini Live API
        Audio format: PCM 16-bit, 16kHz
        """
        if not self.ws:
            raise RuntimeError("WebSocket not connected")
        
        import base64
        audio_b64 = base64.b64encode(audio_chunk).decode()
        
        message = {
            "realtime_input": {
                "media_chunks": [
                    {
                        "data": audio_b64,
                        "mime_type": "audio/pcm"
                    }
                ]
            }
        }
        
        try:
            await self.ws.send(json.dumps(message))
        except Exception as e:
            logger.error(f"Error sending audio: {e}")
            raise
    
    async def receive_stream(self) -> AsyncGenerator:
        """
        Stream responses from Gemini Live API
        Yields: {type, data} where type is 'audio' or 'transcription'
        """
        if not self.ws:
            raise RuntimeError("WebSocket not connected")
        
        try:
            async for message in self.ws:
                data = json.loads(message)
                
                # Parse server-sent events
                if "server_content" in data:
                    server_content = data["server_content"]
                    
                    # Audio response
                    if "media_chunks" in server_content:
                        for chunk in server_content["media_chunks"]:
                            yield {
                                "type": "audio",
                                "data": chunk.get("data"),
                                "mime_type": chunk.get("mime_type", "audio/pcm")
                            }
                    
                    # Text transcription
                    if "text" in server_content:
                        yield {
                            "type": "transcription",
                            "role": "model",
                            "text": server_content["text"]
                        }
                
                # User transcription
                if "client_content" in data:
                    client_content = data["client_content"]
                    if "turns" in client_content:
                        for turn in client_content["turns"]:
                            for part in turn.get("parts", []):
                                if "text" in part:
                                    yield {
                                        "type": "transcription",
                                        "role": "user",
                                        "text": part["text"]
                                    }
                
        except websockets.exceptions.ConnectionClosed:
            logger.info("Gemini WebSocket connection closed")
        except Exception as e:
            logger.error(f"Error receiving from Gemini: {e}")
            raise
    
    async def close(self):
        """Close WebSocket connection gracefully"""
        if self.ws:
            await self.ws.close()
            logger.info("Closed Gemini Live API connection")
```

### Step 1.2: Create Audio Processor
**File**: `resume_pipeline/live_interview/audio_processor.py`

```python
"""
Audio encoding/decoding utilities for Live Interview
"""
import numpy as np
import base64
import logging
from typing import Tuple

logger = logging.getLogger(__name__)

class AudioProcessor:
    """Handles PCM audio conversion"""
    
    # Audio specifications
    INPUT_SAMPLE_RATE = 16000      # 16kHz input
    OUTPUT_SAMPLE_RATE = 24000     # 24kHz output
    CHANNELS = 1
    SAMPLE_WIDTH = 2  # 16-bit = 2 bytes
    
    @staticmethod
    def decode_audio_chunk(base64_chunk: str) -> bytes:
        """Decode base64 audio chunk to raw PCM"""
        try:
            return base64.b64decode(base64_chunk)
        except Exception as e:
            logger.error(f"Error decoding audio: {e}")
            raise
    
    @staticmethod
    def pcm_to_float32(pcm_data: bytes) -> np.ndarray:
        """Convert PCM 16-bit to float32"""
        try:
            int16_data = np.frombuffer(pcm_data, dtype=np.int16)
            float32_data = int16_data.astype(np.float32) / 32768.0
            return float32_data
        except Exception as e:
            logger.error(f"Error converting PCM to float32: {e}")
            raise
    
    @staticmethod
    def float32_to_pcm(float32_data: np.ndarray) -> bytes:
        """Convert float32 to PCM 16-bit"""
        try:
            int16_data = (float32_data * 32767).astype(np.int16)
            return int16_data.tobytes()
        except Exception as e:
            logger.error(f"Error converting float32 to PCM: {e}")
            raise
    
    @staticmethod
    def resample_audio(
        audio_data: np.ndarray,
        orig_sr: int = 16000,
        target_sr: int = 24000
    ) -> np.ndarray:
        """Resample audio using linear interpolation"""
        import scipy.signal
        try:
            num_samples = int(len(audio_data) * target_sr / orig_sr)
            resampled = scipy.signal.resample(audio_data, num_samples)
            return resampled
        except Exception as e:
            logger.error(f"Error resampling audio: {e}")
            raise
    
    @staticmethod
    def calculate_volume(pcm_data: bytes) -> float:
        """Calculate RMS volume level (0.0 - 1.0)"""
        try:
            float32_data = AudioProcessor.pcm_to_float32(pcm_data)
            rms = np.sqrt(np.mean(float32_data ** 2))
            return float(np.clip(rms, 0.0, 1.0))
        except Exception as e:
            logger.error(f"Error calculating volume: {e}")
            return 0.0
```

### Step 1.3: Create WebSocket Handler
**File**: `resume_pipeline/live_interview/websocket_handler.py`

```python
"""
FastAPI WebSocket endpoint for live interview streaming
"""
import asyncio
import json
import logging
from typing import Optional
from fastapi import WebSocket, WebSocketDisconnect, HTTPException, Depends
from sqlalchemy.orm import Session

from ..db import get_db()
from ..auth import get_current_user
from ..core.credit_service import CreditService
from .gemini_live_client import GeminiLiveClient
from .audio_processor import AudioProcessor
from .interview_evaluator import InterviewEvaluator

logger = logging.getLogger(__name__)

class LiveInterviewWebSocketManager:
    """Manages WebSocket connection for live interview"""
    
    def __init__(
        self,
        websocket: WebSocket,
        session_id: str,
        db_session: Session,
        user_id: int
    ):
        self.websocket = websocket
        self.session_id = session_id
        self.db = db_session
        self.user_id = user_id
        self.gemini_client: Optional[GeminiLiveClient] = None
        self.interview_session = None
        self.transcription_buffer = {"user": [], "model": []}
        self.audio_buffer = b""
    
    async def connect(self):
        """Initialize WebSocket connection"""
        await self.websocket.accept()
        logger.info(f"WebSocket connected for session {self.session_id}")
    
    async def disconnect(self):
        """Clean up on disconnect"""
        try:
            if self.gemini_client:
                await self.gemini_client.close()
            logger.info(f"WebSocket disconnected for session {self.session_id}")
        except Exception as e:
            logger.error(f"Error during disconnect: {e}")
    
    async def forward_client_audio_to_gemini(self):
        """
        Receive audio from client and forward to Gemini
        """
        try:
            while True:
                data = await self.websocket.receive_text()
                message = json.loads(data)
                
                if message.get("type") == "audio":
                    audio_chunk_b64 = message.get("audio_chunk")
                    audio_bytes = AudioProcessor.decode_audio_chunk(audio_chunk_b64)
                    
                    await self.gemini_client.send_audio(audio_bytes)
                    
                    # Update metrics
                    volume = AudioProcessor.calculate_volume(audio_bytes)
                    # Store for analysis later
                    
                elif message.get("type") == "end_session":
                    break
                
        except WebSocketDisconnect:
            logger.info("Client disconnected")
        except Exception as e:
            logger.error(f"Error in client audio forwarding: {e}")
            await self.websocket.send_json({
                "type": "error",
                "error_code": "AUDIO_PROCESSING_ERROR",
                "message": str(e)
            })
    
    async def forward_gemini_response_to_client(self):
        """
        Receive responses from Gemini and forward to client
        """
        try:
            async for response in self.gemini_client.receive_stream():
                
                if response["type"] == "audio":
                    # Send audio to client
                    await self.websocket.send_json({
                        "type": "audio",
                        "audio_chunk": response["data"]
                    })
                
                elif response["type"] == "transcription":
                    # Send transcription to client
                    transcription = {
                        "type": "transcription",
                        "role": response["role"],
                        "text": response["text"],
                        "is_final": True
                    }
                    
                    # Store transcription
                    self.transcription_buffer[response["role"].lower()].append(
                        response["text"]
                    )
                    
                    await self.websocket.send_json(transcription)
        
        except Exception as e:
            logger.error(f"Error in Gemini response forwarding: {e}")
            await self.websocket.send_json({
                "type": "error",
                "error_code": "GEMINI_ERROR",
                "message": str(e)
            })

# FastAPI WebSocket endpoint
async def websocket_endpoint(
    websocket: WebSocket,
    session_id: str,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    WebSocket endpoint: ws://localhost:8000/ws/interviews/{session_id}
    """
    
    manager = LiveInterviewWebSocketManager(
        websocket=websocket,
        session_id=session_id,
        db_session=db,
        user_id=current_user.id
    )
    
    try:
        await manager.connect()
        
        # Get interview session from database
        # Validate session exists and belongs to user
        
        # Initialize Gemini Live client
        manager.gemini_client = GeminiLiveClient(
            api_key=settings.GEMINI_API_KEY
        )
        await manager.gemini_client.connect(
            system_prompt="You are a technical interviewer..."
        )
        
        # Run both forwarding tasks concurrently
        await asyncio.gather(
            manager.forward_client_audio_to_gemini(),
            manager.forward_gemini_response_to_client()
        )
    
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        try:
            await websocket.send_json({
                "type": "error",
                "message": "Connection error"
            })
        except:
            pass
    
    finally:
        await manager.disconnect()
```

## Phase 2: REST API Endpoints

**File**: `resume_pipeline/routes/live_interview.py` (NEW)

```python
"""
REST API endpoints for live interview management
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime, timedelta

from ..db import get_db, InterviewSessionLive, Applicant
from ..auth import get_current_user
from ..schemas import LiveInterviewStartRequest, LiveInterviewResponse
from ..core.credit_service import CreditService
from ..constants import INTERVIEW_CONFIG

router = APIRouter(prefix="/api/interviews/live", tags=["live-interview"])

@router.post("/start", response_model=LiveInterviewResponse)
async def start_live_interview(
    request: LiveInterviewStartRequest,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Start a new live interview session
    
    Request:
    {
        "session_type": "live_technical",
        "difficulty_level": "intermediate",
        "topic": "Data Structures"
    }
    """
    
    # Check credits
    cost = INTERVIEW_CONFIG[request.session_type]["credit_cost"]
    credit_service = CreditService(db, current_user.id)
    
    if not credit_service.check_eligibility(cost):
        raise HTTPException(
            status_code=402,
            detail=f"Insufficient credits. Need {cost}, have {credit_service.get_balance()}"
        )
    
    # Create interview session
    session = InterviewSessionLive(
        applicant_id=current_user.applicant_id,
        session_type=request.session_type,
        difficulty_level=request.difficulty_level,
        start_time=datetime.utcnow(),
        duration_seconds=INTERVIEW_CONFIG[request.session_type]["duration"],
        status="active"
    )
    
    db.add(session)
    db.commit()
    db.refresh(session)
    
    return LiveInterviewResponse(
        session_id=str(session.id),
        start_time=session.start_time,
        duration_limit_seconds=session.duration_seconds
    )

@router.post("/{session_id}/end")
async def end_live_interview(
    session_id: str,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    End a live interview session and evaluate
    """
    
    session = db.query(InterviewSessionLive).filter(
        InterviewSessionLive.id == session_id
    ).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Evaluate session
    evaluator = InterviewEvaluator(session)
    score, feedback = await evaluator.evaluate()
    
    # Update session
    session.status = "completed"
    session.end_time = datetime.utcnow()
    session.score = score
    db.commit()
    
    return {"status": "completed", "score": score}
```

## Phase 2: Frontend Hooks

### React Hooks Structure

**`useWebSocketStream.js`** - WebSocket connection management
**`useAudioRecorder.js`** - Microphone capture
**`useAudioPlayer.js`** - Audio playback
**`useLiveInterview.js`** - Orchestrates all three

## Next Steps

Would you like me to:

1. **Start implementing Phase 1 backend** (create the Gemini client and WebSocket handler)?
2. **Design the frontend components** with detailed implementations?
3. **Create database migrations** for the new tables?
4. **Set up testing framework** for live interview system?
5. **Create a complete API specification** (OpenAPI/Swagger)?

**Recommendation**: Start with Phase 1 backend implementation, as frontend depends on a working WebSocket endpoint.
