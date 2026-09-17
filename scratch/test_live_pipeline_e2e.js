import WebSocket from "ws";

const WS_URL = "ws://localhost:3000/api/vobiz/stream?agentId=cmu40722800014r20hvl070n3&callerNumber=%2B916305367443";

async function runTest() {
  console.log("Connecting to WebSocket:", WS_URL);
  const ws = new WebSocket(WS_URL);

  ws.on("open", () => {
    console.log("WebSocket connected. Sending 'start' event...");
    ws.send(
      JSON.stringify({
        event: "start",
        streamId: "stream_e2e_test_1",
        start: {
          streamId: "stream_e2e_test_1",
          callUuid: "call_e2e_test_1",
          mediaFormat: { encoding: "audio/x-mulaw", sampleRate: 8000 },
        },
      })
    );
  });

  let audioPacketsReceived = 0;
  let totalAudioBytes = 0;

  ws.on("message", (data) => {
    try {
      const msg = JSON.parse(data.toString());
      if (msg.event === "playAudio") {
        audioPacketsReceived++;
        const payload = Buffer.from(msg.media?.payload || "", "base64");
        totalAudioBytes += payload.length;
        if (audioPacketsReceived === 1) {
          console.log(`[VERIFY_SUCCESS] First audio frame received from Agent! Chunk: ${payload.length} bytes`);
        }
      } else if (msg.event === "checkpoint") {
        console.log(`[VERIFY_SUCCESS] Checkpoint received: ${msg.name}`);
        console.log(`Total audio received for greeting: ${totalAudioBytes} bytes (${(totalAudioBytes / 8000).toFixed(2)}s) across ${audioPacketsReceived} frames.`);

        // Simulate Vobiz playback confirmation
        ws.send(JSON.stringify({ event: "playedStream", name: msg.name, streamId: "stream_e2e_test_1" }));

        // Now simulate customer speaking: "నా ఆర్డర్ ORD-8421 స్టేటస్ చెప్పండి"
        console.log("\nSimulating customer speaking in Telugu...");
        // Send simulated silence followed by mock speech
        setTimeout(async () => {
          // Send 20 frames of human speech energy
          const speechChunk = Buffer.alloc(160, 0x55); // μ-law sample with energy
          for (let i = 0; i < 25; i++) {
            ws.send(
              JSON.stringify({
                event: "media",
                streamId: "stream_e2e_test_1",
                media: { payload: speechChunk.toString("base64") },
              })
            );
          }
          // Then silence to trigger end of utterance
          const silenceChunk = Buffer.alloc(160, 0xff); // μ-law silence
          for (let i = 0; i < 45; i++) {
            ws.send(
              JSON.stringify({
                event: "media",
                streamId: "stream_e2e_test_1",
                media: { payload: silenceChunk.toString("base64") },
              })
            );
          }
          console.log("Speech utterance sent, waiting for agent response turn...");
        }, 1000);
      }
    } catch (e) {
      console.error("Message parse error:", e);
    }
  });

  ws.on("close", (code, reason) => {
    console.log("WebSocket closed:", code, reason);
  });

  ws.on("error", (err) => {
    console.error("WebSocket error:", err);
  });
}

runTest().catch(console.error);
