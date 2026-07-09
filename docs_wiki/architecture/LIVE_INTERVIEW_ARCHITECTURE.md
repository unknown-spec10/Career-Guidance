# Gemini Live API Interview Integration Architecture

## Overview

This document outlines the architecture for integrating Google's Gemini Live API into the Career Guidance interview system, enabling real-time conversational interviews instead of the current question-by-question format.

## Implementation Approach: Server-to-Server

```
┌─────────────┐         ┌──────────────────┐         ┌─────────────────┐
│   Frontend  │◄──────►│  Backend         │◄────────┤  Gemini Live    │
│  (Browser)  │ HTTP   │  (FastAPI)       │ WebSocket│     API         │
│             │ /WS    │  Proxy           │         │   (Google)      │
└─────────────┘        └──────────────────┘         └─────────────────┘
  Audio Input/Output      WebSocket Proxy            Session Management
  UI Rendering           Audio Routing              Real-time Processing
  Transcription Display  Credit Handling
```

## System Architecture

### 1. Frontend Layer (`frontend/src/`)

#### New Components
- **LiveInterviewPage.jsx** - Main live interview container
- **AudioRecorder.jsx** - Captures user audio (Web Audio API)
- **AudioPlayer.jsx** - Plays model responses
- **LiveInterviewControls.jsx** - Start/Stop/Pause/Resume controls
- **TranscriptionDisplay.jsx** - Shows live transcription of user + model
- **InterviewMetrics.jsx** - Real-time stats (duration, credit usage, etc.)

#### Data Flow
```javascript
// Frontend → Backend (HTTP REST)
1. POST /api/interviews/live/start
   - Creates InterviewSession
   - Returns sessionId, stream token, etc.

// Frontend ↔ Backend (WebSocket)
2. ws://localhost:8000/ws/interviews/{sessionId}
   - Frontend sends: audio chunks (Base64 encoded)
   - Backend receives: audio chunks, routes to Live API
   - Frontend receives: model audio response, transcriptions
```

### 2. Backend Layer (`resume_pipeline/`)

#### New Modules

**`resume_pipeline/live_interview/`** - Live Interview Service
```
live_interview/
├── __init__.py
├── live_session_manager.py      # Session lifecycle management
├── websocket_handler.py          # WebSocket connection management
├── audio_processor.py            # Audio encoding/decoding
├── gemini_live_client.py         # Gemini Live API client
├── transcription_service.py      # Transcription processing
├── credit_handler.py             # Credit deduction for live sessions
└── interview_evaluator.py        # Post-session evaluation & scoring
```

#### API Endpoints (New)

```python
# REST Endpoints
POST /api/interviews/live/start
  - Input: {session_type, difficulty_level, topic}
  - Output: {session_id, stream_token, start_time, duration_limit}
  - Credit check before allowing start
  - Creates initial InterviewSession record

GET /api/interviews/live/{session_id}/status
  - Returns current session status, elapsed time, credit usage

POST /api/interviews/live/{session_id}/end
  - Ends the session gracefully
  - Triggers evaluation and scoring
  - Records final metrics

POST /api/interviews/live/{session_id}/pause
  - Pauses but doesn't end session
  - Retains all audio/transcription data

POST /api/interviews/live/{session_id}/resume
  - Resumes paused session
  - Validates session state

# WebSocket Endpoint
ws://localhost:8000/ws/interviews/{session_id}
  - Bidirectional audio & control stream
```

### 3. Live API Integration Flow

```
User speaks into microphone
         ↓
Web Audio API captures audio
         ↓
Frontend encodes (PCM 16-bit, 16kHz)
         ↓
Frontend sends via WebSocket
         ↓
Backend receives audio chunk
         ↓
Backend forwards to Gemini Live API
         ↓
Live API processes & generates response
         ↓
Live API streams audio back
         ↓
Backend receives audio + transcription
         ↓
Backend sends to frontend via WebSocket
         ↓
Frontend plays audio + displays transcription
         ↓
[Loop continues until session ends]
```

## Database Schema Changes

### New Table: InterviewSessionLive
```sql
CREATE TABLE interview_session_live (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    applicant_id INT NOT NULL,
    session_type VARCHAR(50),        -- 'live_technical', 'live_behavioral', etc.
    difficulty_level VARCHAR(20),     -- 'beginner', 'intermediate', 'advanced'
    start_time DATETIME,
    end_time DATETIME,
    duration_seconds INT,
    status VARCHAR(20),               -- 'active', 'paused', 'completed', 'timeout'
    gemini_session_id VARCHAR(255),   -- Gemini Live API session ID
    
    -- Audio & Transcription
    audio_url VARCHAR(500),           -- S3/storage path
    user_transcript TEXT,             -- Full user transcription
    model_transcript TEXT,            -- Full model responses
    
    -- Scoring
    score DECIMAL(5,2),
    confidence_level DECIMAL(3,2),
    skill_tags JSON,                  -- Detected skills
    
    -- Credits
    credits_used INT,
    credit_transaction_id INT,
    
    FOREIGN KEY (applicant_id) REFERENCES applicant(id),
    FOREIGN KEY (credit_transaction_id) REFERENCES credit_transaction(id)
);
```

### New Table: LiveInterviewMetrics
```sql
CREATE TABLE live_interview_metrics (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    session_id BIGINT NOT NULL,
    
    -- Audio Quality
    input_audio_quality DECIMAL(3,2),    -- 0-1
    output_latency_ms INT,               -- Latency in ms
    interruptions_count INT,             -- Times user interrupted
    
    -- Communication Metrics
    speech_pace DECIMAL(3,2),            -- Words per minute (estimated)
    filler_words INT,                    -- 'um', 'ah', etc.
    silence_duration_seconds INT,        -- Total silence
    engagement_score DECIMAL(3,2),       -- 0-100
    
    FOREIGN KEY (session_id) REFERENCES interview_session_live(id)
);
```

## WebSocket Protocol Specification

### Message Types

#### Frontend → Backend

```javascript
// 1. Audio Chunk (continuous)
{
  type: "audio",
  session_id: "uuid",
  audio_chunk: "base64_encoded_pcm",    // PCM 16-bit, 16kHz
  timestamp: 1712000000
}

// 2. Control Messages
{
  type: "pause",
  session_id: "uuid"
}

{
  type: "resume",
  session_id: "uuid"
}

{
  type: "end_session",
  session_id: "uuid",
  early_completion: false
}
```

#### Backend → Frontend

```javascript
// 1. Audio Response (continuous)
{
  type: "audio",
  audio_chunk: "base64_encoded_pcm",    // PCM 16-bit, 24kHz output
  timestamp: 1712000000
}

// 2. Transcription Update
{
  type: "transcription",
  role: "user" | "model",
  text: "transcribed text",
  is_final: false,  // True when transcription is complete
  timestamp: 1712000000
}

// 3. Session Status
{
  type: "status",
  status: "active" | "paused" | "completed",
  elapsed_time: 45000,  // ms
  credits_remaining: 50
}

// 4. Error
{
  type: "error",
  error_code: "AUDIO_PROCESSING_ERROR",
  message: "Audio processing failed",
  action: "retry" | "reconnect" | "end_session"
}
```

## Backend Implementation: Python WebSocket Handler

### Core Components

#### 1. `gemini_live_client.py`
```python
class GeminiLiveClient:
    """Manages WebSocket connection to Gemini Live API"""
    
    def __init__(self, api_key: str, model: str = "gemini-2.0-flash-exp"):
        self.api_key = api_key
        self.model = model
        self.ws = None  # WebSocket connection
        
    async def connect(self):
        """Establish WebSocket connection to Gemini Live API"""
        
    async def send_audio(self, audio_chunk: bytes):
        """Send audio chunk to Live API"""
        
    async def receive_stream(self) -> AsyncGenerator:
        """Receive audio + transcription stream from Live API"""
        
    async def close(self):
        """Close connection gracefully"""
```

#### 2. `websocket_handler.py`
```python
@app.websocket("/ws/interviews/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    """
    Bi-directional WebSocket proxy between client and Gemini Live API
    """
    await websocket.accept()
    
    try:
        # Get session from database
        session = get_interview_session(session_id)
        
        # Initialize Gemini Live client
        gemini_client = GeminiLiveClient(settings.GEMINI_API_KEY)
        await gemini_client.connect()
        
        # Handle bidirectional streaming
        async with asyncio.TaskGroup() as tg:
            # Task 1: Frontend → Backend → Gemini
            tg.create_task(
                forward_client_audio(websocket, gemini_client, session)
            )
            # Task 2: Gemini → Backend → Frontend
            tg.create_task(
                forward_gemini_response(websocket, gemini_client, session)
            )
            
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        await websocket.close(code=1011, reason="Server error")
    finally:
        await gemini_client.close()
```

#### 3. `live_session_manager.py`
```python
class LiveSessionManager:
    """Manages interview session lifecycle"""
    
    async def create_session(self, applicant_id: int, session_type: str):
        """Create new live interview session"""
        
    async def get_session(self, session_id: str):
        """Retrieve session details"""
        
    async def update_metrics(self, session_id: str, metrics: dict):
        """Update real-time metrics"""
        
    async def end_session(self, session_id: str, score: float):
        """Complete session and generate score"""
```

## Frontend Implementation

### Audio Capture & Playback

```javascript
// AudioRecorder.jsx (using Web Audio API)
class AudioRecorder {
  constructor() {
    this.audioContext = new AudioContext()
    this.processor = null
    this.stream = null
  }
  
  async start() {
    // Get microphone access
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        sampleRate: 16000,  // 16kHz as per spec
        echoCancellation: true,
        noiseSuppression: true
      }
    })
    
    // Create audio worklet for PCM encoding
    const source = this.audioContext.createMediaStreamSource(this.stream)
    this.processor = this.audioContext.createScriptProcessor(4096, 1, 1)
    
    this.processor.onaudioprocess = (e) => {
      const pcmData = this.encodePCM(e.inputBuffer)
      const base64 = btoa(String.fromCharCode.apply(null, pcmData))
      this.onAudioChunk(base64)
    }
    
    source.connect(this.processor)
    this.processor.connect(this.audioContext.destination)
  }
  
  encodePCM(buffer) {
    // Convert Float32 to PCM 16-bit
  }
  
  stop() {
    this.processor.disconnect()
    this.stream.getTracks().forEach(track => track.stop())
  }
}
```

## Integration with Existing Interview System

### Architecture Decision

**Replace Q&A Flow with Live Conversation**

```
Current Flow:
User → Q1 → Answer → Submit → Evaluation → Q2 → ...

New Flow:
User → Start Live Interview → In-depth conversation with Gemini → Auto-evaluation → Results

Benefits:
- More natural interview experience
- Covers multiple topics dynamically
- Better skill assessment through conversation depth
- Immediate feedback during interview
```

### Session Type Mapping

```python
INTERVIEW_SESSION_TYPES = {
    'live_technical': {
        'system_prompt': 'You are a technical interviewer...',
        'duration': 1800,  # 30 minutes
        'credit_cost': 100
    },
    'live_behavioral': {
        'system_prompt': 'You are a behavioral interviewer...',
        'duration': 1200,  # 20 minutes
        'credit_cost': 80
    },
    'live_coding': {
        'system_prompt': 'You are a coding interview expert...',
        'duration': 2400,  # 40 minutes
        'credit_cost': 150
    }
}
```

## Error Handling & Resilience

### Connection Drop Recovery
```
1. WebSocket disconnects
2. Frontend retries connection (exponential backoff)
3. Backend checks session state
4. Resume from last checkpoint
5. Alert user if recovery fails
```

### Credit Management
```
- Charge per minute of live interview
- Pause timer when session paused
- Refund if session fails due to server error
- Track in CreditTransaction table
```

### Timeout Handling
```
- Server-side timeout: Session auto-ends after duration_limit
- Client-side inactivity: Close after 2 minutes no audio
- Network timeout: WebSocket heartbeat (ping/pong every 30s)
```

## Performance Considerations

### Latency Targets
- Audio capture → transmission: <50ms
- Audio transmission → model response: <200ms (Gemini Live spec)
- Model response → playback: <100ms
- **Total latency: <350ms** (acceptable for conversation)

### Bandwidth Requirements
- Input: PCM 16-bit, 16kHz = ~256 kbps
- Output: PCM 16-bit, 24kHz = ~384 kbps
- Total: ~640 kbps
- With overhead: ~1 Mbps (acceptable)

### Scalability
- Each session uses 1 WebSocket proxy process
- Sessions can run in parallel
- Consider horizontal scaling with session distribution

## Security Considerations

### API Key Management
```
- Store GEMINI_API_KEY in environment variables
- Use ephemeral tokens for frontend (future enhancement)
- Implement rate limiting per user (X sessions/day)
```

### Audio Data Privacy
```
- Encrypt audio in transit (WSS, not WS)
- Store audio temporarily only (delete after 30 days)
- Never log complete transcriptions with PII
- GDPR/CCPA compliance for data retention
```

### Authentication
```
- Verify JWT token on WebSocket connection
- Require active interview session
- Credit check before starting session
```

## Testing Strategy

### Unit Tests
- Audio encoding/decoding
- Protocol message parsing
- Session state transitions

### Integration Tests
- Full WebSocket connection lifecycle
- Audio streaming end-to-end
- Error recovery scenarios

### Performance Tests
- Latency measurements
- Memory usage during long sessions
- Concurrent session limits

## Implementation Timeline

### Phase 1: Backend Foundation (Week 1)
- [ ] Set up Gemini Live API client
- [ ] Implement WebSocket handler
- [ ] Database schema migrations

### Phase 2: Frontend Integration (Week 1-2)
- [ ] Audio capture component
- [ ] WebSocket client
- [ ] UI components (start/stop/pause)

### Phase 3: Testing & Refinement (Week 2-3)
- [ ] End-to-end testing
- [ ] Performance optimization
- [ ] Error handling

### Phase 4: Deployment (Week 3-4)
- [ ] Staging environment testing
- [ ] Production deployment
- [ ] Monitoring & logging setup

## Monitoring & Observability

### Key Metrics to Track
```
- Sessions per day
- Average session duration
- Success/error rates
- Latency percentiles (P50, P95, P99)
- Audio quality scores
- Credit usage trends
```

### Logging Strategy
```
- Session lifecycle events
- Audio chunk processing timestamps
- Error details (but not full transcriptions)
- Performance metrics
```

## Future Enhancements

1. **Ephemeral Tokens**: Move to client-to-server for lower latency
2. **Recording & Playback**: Store sessions for review
3. **Multi-language Support**: Use Gemini's 70+ language support
4. **Video Option**: Add video interview capability
5. **Real-time Skill Detection**: Identify skills being discussed
6. **Interruption Coaching**: Provide feedback on communication patterns
7. **Post-Interview Analytics**: Detailed performance breakdown

---

**Status**: Under review
**Last Updated**: April 11, 2026
**Owner**: Dev Team
