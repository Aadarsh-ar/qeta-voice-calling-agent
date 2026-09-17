import WebSocket from "ws";

console.log("Starting WebSocket simulation client...");
const ws = new WebSocket("ws://localhost:3000/api/vobiz/stream");

ws.on("open", () => {
  console.log("[CLIENT] Connected to /api/vobiz/stream");
  ws.send(
    JSON.stringify({
      event: "start",
      start: {
        streamId: "stream_test_001",
        callUuid: "call_test_001",
        mediaFormat: {
          encoding: "audio/x-mulaw",
          sampleRate: 8000,
        },
      },
    })
  );
});

let framesReceived = 0;
let bytesReceived = 0;
let turn = 0;

ws.on("message", (raw) => {
  const msg = JSON.parse(raw.toString());
  if (msg.event === "playAudio") {
    framesReceived++;
    const len = Buffer.from(msg.media.payload, "base64").length;
    bytesReceived += len;
    if (framesReceived === 1 || framesReceived % 20 === 0) {
      console.log(`[CLIENT] Received audio frame #${framesReceived}: ${len} bytes (total: ${bytesReceived} bytes)`);
    }
  } else if (msg.event === "checkpoint") {
    turn++;
    console.log(`[CLIENT] Turn #${turn} checkpoint received: "${msg.name}"! Total audio: ${bytesReceived} bytes across ${framesReceived} frames.`);
    ws.send(JSON.stringify({ event: "playedStream", name: msg.name }));

    if (turn === 1) {
      console.log("[CLIENT] Caller hears greeting! Now simulating caller saying: 'హలో, డెమో కావాలి'...");
      // Send 30 frames (600ms) of real speech level audio (RMS ~8000)
      let f = 0;
      const interval = setInterval(() => {
        f++;
        let frameData;
        if (f <= 30) {
          // Speech frame
          frameData = Buffer.alloc(160);
          for (let i = 0; i < 160; i++) frameData[i] = (i % 2 === 0) ? 0x20 : 0xa0;
        } else {
          // Silence / line noise after speaking
          frameData = Buffer.alloc(160, 0xff);
        }

        ws.send(
          JSON.stringify({
            event: "media",
            streamId: "stream_test_001",
            media: {
              payload: frameData.toString("base64"),
            },
          })
        );

        if (f >= 75) { // 30 speech frames + 45 silence frames = 1.5s
          clearInterval(interval);
        }
      }, 20);
    } else if (turn >= 2) {
      console.log("🎉 [SUCCESS] Turn #2 AI response audio received from Cartesia through Vobiz stream!");
      setTimeout(() => {
        ws.close();
        process.exit(0);
      }, 1000);
    }
  } else if (msg.event === "clearAudio") {
    console.log("[CLIENT] ClearAudio event received (barge-in flush)");
  } else {
    console.log(`[CLIENT] Event: ${msg.event}`, msg);
  }
});

ws.on("error", (err) => {
  console.error("[CLIENT ERROR]", err);
});

ws.on("close", (code, reason) => {
  console.log(`[CLIENT CLOSED] code=${code}, reason=${reason}`);
  process.exit(0);
});

// Timeout after 15s
setTimeout(() => {
  console.log("[CLIENT] Test complete. Closing connection.");
  ws.close();
  process.exit(0);
}, 12000);
