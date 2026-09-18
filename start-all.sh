#!/bin/sh
# QETADOTIN Production Startup — runs web server + LiveKit voice agent worker together
# Used by Railway to ensure 24/7 availability of both services in a single dyno

echo "=== QETADOTIN Starting All Services ==="
echo "Node: $(node --version)"
echo "LiveKit URL: ${LIVEKIT_URL:-wss://ai-voice-agent-44qkuva3.livekit.cloud}"

# Ensure Silero VAD model files are downloaded before starting
echo "[STARTUP] Pre-downloading plugin files..."
npx tsx src/agent/worker.ts download-files 2>&1 || echo "[STARTUP] download-files skipped (may already exist)"

# Start LiveKit voice agent worker in background
echo "[STARTUP] Starting LiveKit voice agent worker..."
npx tsx src/agent/worker.ts start &
AGENT_PID=$!
echo "[STARTUP] Agent worker PID: $AGENT_PID"

# Start Next.js web server in foreground (Railway monitors this process)
echo "[STARTUP] Starting Next.js web server..."
NODE_ENV=production node server.js

# If web server exits, kill agent worker too
kill $AGENT_PID 2>/dev/null
