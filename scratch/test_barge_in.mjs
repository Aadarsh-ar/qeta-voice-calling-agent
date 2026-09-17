import WebSocket from "ws";

const agentId = "agent_vDCfnuFdJokXJDVxgmHeZx";
const wsUrl = `ws://localhost:3000/api/vobiz/stream?agentId=${agentId}&callerNumber=%2B916305367443`;

console.log("=== TESTING BARGE-IN INTERRUPTION HANDLING ===");
const ws = new WebSocket(wsUrl);

let receivedFrames = 0;
let clearedAudioReceived = false;
const streamId = `barge_in_stream_${Date.now()}`;

ws.on("open", () => {
  console.log("[TEST] Connected to stream, sending start...");
  ws.send(
    JSON.stringify({
      event: "start",
      streamId,
      start: {
        streamId,
        callUuid: "barge_in_uuid",
        mediaFormat: { encoding: "audio/x-mulaw", sampleRate: 8000 },
      },
    })
  );
});

ws.on("message", (data) => {
  try {
    const msg = JSON.parse(data.toString());
    if (msg.event === "playAudio") {
      receivedFrames++;
      if (receivedFrames === 1) {
        console.log("[TEST] First greeting frame received. Waiting for 2.5s of greeting playback before barge-in...");
        setTimeout(() => {
          console.log("[TEST] Customer now speaking loudly to interrupt agent!");
          for (let i = 0; i < 15; i++) {
            const speechChunk = Buffer.alloc(320, 0x00);
            ws.send(
              JSON.stringify({
                event: "media",
                streamId,
                media: { payload: speechChunk.toString("base64") },
              })
            );
          }
        }, 2500);
      }
    } else if (msg.event === "clearAudio") {
      clearedAudioReceived = true;
      console.log(`[TEST] SUCCESS: clearAudio event received from server! Buffer cleared for barge-in.`);
      ws.close();
    }
  } catch {}
});

setTimeout(() => {
  console.log(`Barge-in test completed. Frames received: ${receivedFrames}, clearedAudio: ${clearedAudioReceived}`);
  ws.close();
  process.exit(0);
}, 8000);
