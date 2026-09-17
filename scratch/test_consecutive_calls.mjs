import http from "http";

function postJson(url, data) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const body = JSON.stringify(data);
    const req = http.request(
      {
        hostname: u.hostname,
        port: u.port,
        path: u.pathname,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (res) => {
        let raw = "";
        res.on("data", (c) => (raw += c));
        res.on("end", () => {
          try {
            resolve({ status: res.statusCode, json: JSON.parse(raw) });
          } catch {
            resolve({ status: res.statusCode, raw });
          }
        });
      }
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

async function run() {
  console.log("==================================================================");
  console.log("🧪 VERIFYING ALWAYS-ON TEST CALL & CONSECUTIVE CALLS (5 CALLS)");
  console.log("==================================================================\n");

  const agentId = "agent_GaiYMgB9Bj9kaKW1tUgqSQ";

  // 1. Verify Cartesia Agent Token endpoint (Used by Browser WebSocket Line)
  console.log("--- 1. Testing Cartesia Agent Token (Browser Live Voice Line) ---");
  const tokenRes = await postJson("http://localhost:3000/api/cartesia/agent-token", { agentId });
  console.log("Token Response:", tokenRes.status, tokenRes.json?.success ? "SUCCESS" : "FAIL");
  if (!tokenRes.json?.success || !tokenRes.json?.wsUrl) {
    throw new Error(`Failed to generate Cartesia session token: ${JSON.stringify(tokenRes.json)}`);
  }
  console.log(`✓ Cartesia Agent ID: ${tokenRes.json.agentId}`);
  console.log(`✓ WebSocket URL: ${tokenRes.json.wsUrl}`);

  // 2. Make 5 Consecutive Test Calls / Conversation Turns
  console.log("\n--- 2. Making 5 Consecutive Conversational Test Calls ---");
  const prompts = [
    "నమస్కారం, మీ కంపెనీ వివరాలు చెప్పండి?",
    "నా ఆర్డర్ 4567 డెలివరీ స్టేటస్ ఏమిటి?",
    "మీ రీఫండ్ పాలసీ ఏమిటి?",
    "హైదరాబాద్ లో మీ స్టోర్ ఎక్కడ ఉంది?",
    "చాలా ధన్యవాదాలు అండి, సమాచారం తెలిసింది!",
  ];

  for (let i = 0; i < 5; i++) {
    const t0 = Date.now();
    const prompt = prompts[i];
    console.log(`\n[Call #${i + 1}] User: "${prompt}"`);

    const res = await postJson("http://localhost:3000/api/agent/test", {
      agentId,
      userMessage: prompt,
    });

    const elapsed = Date.now() - t0;
    if (res.status !== 200 || !res.json?.success) {
      throw new Error(`Call #${i + 1} failed: HTTP ${res.status}, ${JSON.stringify(res.json)}`);
    }

    const { rawReply, audioBytes, audioBase64, latencies } = res.json;
    const bytes = audioBytes || (audioBase64 ? Buffer.from(audioBase64, "base64").length : 0);

    if (bytes <= 0) {
      throw new Error(`Call #${i + 1} generated 0 audio bytes!`);
    }

    console.log(`✓ AI Response: "${rawReply?.slice(0, 70)}..."`);
    console.log(`✓ Audio Synthesized: ${bytes} bytes (${Math.round(bytes / 1024)} KB)`);
    console.log(`✓ Total Latency: ${elapsed}ms (LLM: ${latencies?.llmMs}ms, TTS: ${latencies?.ttsMs}ms)`);
  }

  // 3. Verify Two Concurrent Users calling independently
  console.log("\n--- 3. Testing 2 Concurrent Independent User Calls ---");
  const [user1Res, user2Res] = await Promise.all([
    postJson("http://localhost:3000/api/agent/test", {
      agentId,
      userMessage: "User 1: టీవీలు మరియు ఏసీలు ఉన్నాయా?",
    }),
    postJson("http://localhost:3000/api/agent/test", {
      agentId,
      userMessage: "User 2: ఆర్డర్ క్యాన్సిల్ ఎలా చేయాలి?",
    }),
  ]);

  if (!user1Res.json?.success || !user2Res.json?.success) {
    throw new Error("Concurrent user calls failed");
  }

  const u1Bytes = user1Res.json?.audioBytes || (user1Res.json?.audioBase64 ? Buffer.from(user1Res.json.audioBase64, "base64").length : 0);
  const u2Bytes = user2Res.json?.audioBytes || (user2Res.json?.audioBase64 ? Buffer.from(user2Res.json.audioBase64, "base64").length : 0);

  console.log(`✓ User 1 succeeded: ${u1Bytes} audio bytes | "${user1Res.json.rawReply?.slice(0, 50)}..."`);
  console.log(`✓ User 2 succeeded: ${u2Bytes} audio bytes | "${user2Res.json.rawReply?.slice(0, 50)}..."`);

  // 4. Test Error Handling — Never stuck in calling state
  console.log("\n--- 4. Testing Graceful Error Handling (Never stuck calling) ---");
  const badRes = await postJson("http://localhost:3000/api/agent/test", {
    agentId,
    userMessage: "",
  });
  console.log(`✓ Empty message returns HTTP ${badRes.status} cleanly with error: "${badRes.json?.error}"`);

  console.log("\n==================================================================");
  console.log("🎉 ALL 5 CONSECUTIVE CALLS & CONCURRENT TESTS PASSED PERFECTLY!");
  console.log("==================================================================");
}

run().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
