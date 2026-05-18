# Live Interview WebSocket Test Guide

## Quick Start

### 1. Prerequisites
- Backend running on port 8000: `uvicorn resume_pipeline.app:app --reload --port 8000`
- Python venv activated with required packages
- SECRET_KEY environment variable set

### 2. Get Your SECRET_KEY

The SECRET_KEY is required to create valid JWT tokens for testing.

**Option A: From running backend (if configured)**
```powershell
# The backend uses SECRET_KEY from environment
# Check your .env file or environment variables
```

**Option B: Set a test SECRET_KEY**
```powershell
# Windows PowerShell
$env:SECRET_KEY = "test-secret-key-for-development-at-least-32-chars"

# Or add to .env file in project root
echo "SECRET_KEY=test-secret-key-for-development-at-least-32-chars" | Out-File -Append .env
```

### 3. Create a Test User (if needed)

If you don't have a test user ID, create one:

```bash
# In Python shell or directly
python scripts/seed_database.py
```

This creates test users. Update `TEST_USER_ID` in the test script if needed.

### 4. Run the WebSocket Test

**Windows PowerShell:**
```powershell
# Navigate to backend directory
cd .\resume_pipeline

# Set SECRET_KEY
$env:SECRET_KEY = "your-secret-key-here"

# Run test
.\test_live_interview_ws.ps1
```

**Linux/macOS Bash:**
```bash
cd ./resume_pipeline
export SECRET_KEY="your-secret-key-here"
python test_live_interview_ws.py
```

## What the Test Does

1. **Verifies Backend Connectivity**
   - Checks if backend is running on port 8000

2. **Creates JWT Token**
   - Generates a test token with user ID 2

3. **Creates Live Interview Session**
   - Calls `POST /api/interviews/live/start`
   - Creates a session in the database
   - Gets WebSocket URL and session ID

4. **Tests WebSocket Connection**
   - Connects to `/ws/interviews/live/{session_id}`
   - Receives "connected" confirmation from backend
   - Sends control events: ping, start_turn, audio, end_turn, disconnect
   - Listens for responses from Gemini Live API

5. **Validates Bidirectional Communication**
   - Tests client→server: control events, audio
   - Tests server→client: responses, transcriptions, audio chunks

## Troubleshooting

### "SECRET_KEY not set"
```powershell
# Make sure to export before running:
$env:SECRET_KEY = "your-key"
# Or add to .env file
```

### "Backend not accessible"
```powershell
# Start backend in separate terminal:
uvicorn resume_pipeline.app:app --reload --port 8000
```

### "Applicant profile not found"
- Make sure test user ID (2) exists in database
- Run: `python scripts/seed_database.py`
- Or update `TEST_USER_ID` in test script to valid user

### "WebSocket closed before established"
- Check browser console for auth errors
- Verify token is valid and has 'sub' (user_id) claim
- Check backend logs for detailed error

### "No responses from Gemini (timeout)"
- Verify `GEMINI_API_KEY` is set in backend
- Check Gemini API quota and rate limits
- Try with `GEMINI_MOCK_MODE=true` for mock responses

## Expected Output

```
============================================================
Live Interview WebSocket Test
============================================================

🔍 Checking backend at http://localhost:8000...
✓ Backend is running

🔐 Creating test JWT token...
✓ Created test token for user 2

🎥 Creating live interview session...
✓ Created live interview session: 13
  WebSocket URL: /ws/interviews/live/13
  Credits used: 10

🚀 Testing WebSocket connection for session 13...
📡 Attempting WebSocket connection...
✓ WebSocket connected!

📨 Waiting for server 'connected' message...
✓ Received: {'type': 'control', 'action': 'connected'}
✓ Server confirmed connection ready

📤 Sending control: ping
📥 Waiting for pong response...
✓ Received: {'type': 'control', 'action': 'pong'}
✓ Ping-pong successful!

📤 Sending control: start_turn
✓ Sent start_turn

📤 Sending sample audio event
✓ Sent audio event

📥 Listening for Gemini responses (10 seconds)...
📥 Response 1: transcription
   Role: model, Text: Hello! I'm ready to start the technical interview...

✓ No more responses (timeout)
✓ Received 1 response(s) from Gemini Live

📤 Sending control: end_turn
✓ Sent end_turn

📤 Sending control: disconnect
✓ Sent disconnect
✓ Received final: {'type': 'control', 'action': 'ended'}

✅ WebSocket test completed successfully!

============================================================
✅ All tests passed!
============================================================
```

## Common Issues with Live Interview

### Issue: WebSocket closes immediately
**Cause:** Auth token expired or invalid session
**Fix:** Ensure SECRET_KEY matches backend, use fresh token

### Issue: No Gemini responses
**Cause:** API key not configured, quota exceeded, or mock mode
**Fix:** Set `GEMINI_API_KEY`, check quota, disable `GEMINI_MOCK_MODE`

### Issue: Connection established but no data flow
**Cause:** Event schema mismatch or Gemini Live endpoint down
**Fix:** Check event formats in `live_interview/event_schema.py`, test Gemini API directly

## Next Steps

After confirming WebSocket works:

1. **Test in Frontend**
   - Open browser DevTools Console
   - Go to live interview page
   - Should see WebSocket connection establish

2. **Test with Audio**
   - Allow microphone permissions
   - Speak to the interviewer
   - Check transcription appears

3. **Debug Issues**
   - Check browser console for errors
   - Check backend logs: `tail -f resume_pipeline.log`
   - Enable debug logging in test script

## Files

- `test_live_interview_ws.py` - Main Python test script
- `test_live_interview_ws.ps1` - PowerShell runner (Windows)
- This guide for reference

## Support

If tests fail:
1. Check backend logs
2. Verify all environment variables
3. Ensure database has test data
4. Confirm Gemini API key is valid
