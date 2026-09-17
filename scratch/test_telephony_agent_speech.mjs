import { WebSocket } from "ws";

async function testAgentCall(agentId, name) {
  console.log(`\n======================================================`);
  console.log(`📞 INITIATING CALL FOR: ${name} (${agentId})`);
  console.log(`======================================================`);

  return new Promise((resolve) => {
    const ws = new WebSocket(`ws://localhost:3000/api/vobiz/stream?streamId=stream_${Date.now()}&agentId=${agentId}&callerNumber=%2B916305367443`);
    let framesReceived = 0;
    let totalBytes = 0;

    ws.on("open", () => {
      console.log(`[VOBIZ_MOCK] WebSocket connected. Sending start event...`);
      ws.send(JSON.stringify({
        event: "start",
        streamId: `stream_${Date.now()}`,
        start: {
          callUuid: `call_${Date.now()}`,
          from: "+916305367443",
          to: "+918071582667",
        }
      }));
    });

    ws.on("message", (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.event === "playAudio") {
          framesReceived++;
          const bytes = Buffer.from(msg.media?.payload || "", "base64").length;
          totalBytes += bytes;
          if (framesReceived === 1 || framesReceived % 20 === 0) {
            console.log(`[PSTN AUDIO RECEIVED] frame #${framesReceived}, totalBytes=${totalBytes}B`);
          }
        }
      } catch (e) {}
    });

    ws.on("error", (err) => {
      console.error(`[TEST_ERR]`, err.message);
      resolve(false);
    });

    setTimeout(() => {
      console.log(`\n📊 CALL RESULT for ${name}:`);
      console.log(`- Audio Frames Received: ${framesReceived}`);
      console.log(`- Total Audio Bytes Delivered to Phone: ${totalBytes} bytes`);
      const passed = framesReceived > 10;
      console.log(`- Status: ${passed ? "✅ PASSED (AGENT TALKED IN CALL)" : "❌ FAILED"}`);
      try { ws.close(); } catch {}
      resolve(passed);
    }, 10000);
  });
}

async function run() {
  const collegePass = await testAgentCall("agent_minb6qwKNfwWXLV8gyRfRq", "College Attendance Support");
  const abcPass = await testAgentCall("agent_GaiYMgB9Bj9kaKW1tUgqSQ", "ABC Support");

  console.log(`\n======================================================`);
  console.log(`FINAL RESULTS:`);
  console.log(`College Attendance: ${collegePass ? "PASSED" : "FAILED"}`);
  console.log(`ABC Support: ${abcPass ? "PASSED" : "FAILED"}`);
  console.log(`======================================================\n`);
  process.exit(collegePass && abcPass ? 0 : 1);
}

run();
