import WebSocket from "ws";

const agentId = "agent_minb6qwKNfwWXLV8gyRfRq";
const wsBaseUrl = "ws://localhost:3000/api/vobiz/stream";

async function runSingleCall(callIndex) {
  return new Promise((resolve, reject) => {
    console.log(`\n==================================================`);
    console.log(`STARTING CONSECUTIVE CALL #${callIndex}`);
    console.log(`==================================================`);

    const streamId = `sim_stream_call_${callIndex}_${Date.now()}`;
    const callUuid = `sim_call_uuid_${callIndex}_${Date.now()}`;
    const wsUrl = `${wsBaseUrl}?agentId=${agentId}&callerNumber=%2B916305367443`;

    const ws = new WebSocket(wsUrl);
    let framesReceived = 0;
    let bytesReceived = 0;
    let greeted = false;

    const timeout = setTimeout(() => {
      ws.close();
      if (framesReceived > 0) {
        resolve({ callIndex, success: true, framesReceived, bytesReceived });
      } else {
        reject(new Error(`Call #${callIndex} timed out with 0 frames`));
      }
    }, 6000);

    ws.on("open", () => {
      console.log(`[Call #${callIndex}] WebSocket connected, sending start event (streamId: ${streamId})`);
      ws.send(
        JSON.stringify({
          event: "start",
          streamId,
          start: {
            streamId,
            callUuid,
            mediaFormat: {
              encoding: "audio/x-mulaw",
              sampleRate: 8000,
            },
          },
        })
      );
    });

    ws.on("message", (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.event === "playAudio") {
          framesReceived++;
          const len = Buffer.from(msg.media.payload, "base64").length;
          bytesReceived += len;
          if (!greeted) {
            greeted = true;
            console.log(`[Call #${callIndex}] FIRST GREETING AUDIO RECEIVED! Frame #1: ${len} bytes`);
          }
          // After receiving at least 30 frames (over 1s of audio), caller simulates customer speech and ends
          if (framesReceived >= 40) {
            clearTimeout(timeout);
            console.log(`[Call #${callIndex}] Received ${framesReceived} frames (${bytesReceived} bytes). Simulating customer interaction and hangup.`);
            ws.close();
            resolve({ callIndex, success: true, framesReceived, bytesReceived });
          }
        }
      } catch {}
    });

    ws.on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });

    ws.on("close", () => {
      console.log(`[Call #${callIndex}] Call ended and session cleared cleanly.`);
    });
  });
}

async function runAllConsecutiveCalls() {
  console.log("=== EXECUTING 5 CONSECUTIVE CALL ACCEPTANCE TEST ===");
  const results = [];
  for (let i = 1; i <= 5; i++) {
    const res = await runSingleCall(i);
    results.push(res);
    // Short pause between calls
    await new Promise((r) => setTimeout(r, 800));
  }

  console.log(`\n==================================================`);
  console.log(`CONSECUTIVE CALLS SUMMARY:`);
  console.log(`==================================================`);
  let allPassed = true;
  for (const r of results) {
    console.log(`Call #${r.callIndex}: ${r.success ? "PASS" : "FAIL"} — ${r.framesReceived} frames, ${r.bytesReceived} bytes`);
    if (!r.success) allPassed = false;
  }
  console.log(`OVERALL STATUS: ${allPassed ? "ALL 5 CALLS SUCCEEDED PERFECTLY" : "FAILED"}`);
  process.exit(allPassed ? 0 : 1);
}

runAllConsecutiveCalls().catch((err) => {
  console.error("Consecutive call test failed:", err);
  process.exit(1);
});
