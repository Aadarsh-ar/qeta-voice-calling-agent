async function runBenchmark() {
  console.log("=== FLIPKART SUPPORT AGENT — BENCHMARK CONVERSATION TEST ===\n");

  const agentId = "cmu40722800014r20hvl070n3"; // Flipkart Support Agent in DB
  const agentRes = await fetch(`http://localhost:3000/api/agents/${agentId}`).then(r => r.json());
  console.log(`Agent: ${agentRes.agent.name}`);
  console.log(`System Prompt Preview: ${agentRes.agent.systemPrompt.slice(0, 120)}...\n`);

  const turns = [
    {
      caller: "హలో, నా order ఇంకా రాలేదు.",
      desc: "Turn 1: Caller complains order hasn't arrived (No order number given)",
    },
    {
      caller: "4567",
      desc: "Turn 2: Caller provides order number '4567'",
    },
    {
      caller: "Tomorrow definitely వస్తుందా అండి?",
      desc: "Turn 3: Caller asks follow-up about tomorrow's delivery (Context memory test)",
    },
    {
      caller: "చాలా థాంక్స్ అండి, ఇంకేం వివరాలు అవసరం లేదు. బాయ్!",
      desc: "Turn 4: Caller expresses satisfaction and says goodbye",
    },
  ];

  let conversationHistory = [];

  for (let i = 0; i < turns.length; i++) {
    const { caller, desc } = turns[i];
    console.log(`--- [${desc}] ---`);
    console.log(`Caller: "${caller}"`);

    const start = Date.now();
    const res = await fetch("http://localhost:3000/api/agent/turn", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agentId,
        userUtterance: caller,
        conversationHistory,
        customerPhone: "+916305367443",
      }),
    }).then(r => r.json());

    const elapsed = Date.now() - start;
    const reply = res.normalizedReply || res.rawReply || "";
    console.log(`Agent:  "${reply}"`);
    console.log(`Latency: ${elapsed}ms | Tool Calls: ${JSON.stringify(res.toolCalls || [])} | EndCall: ${res.shouldEndCall}`);
    console.log("");

    conversationHistory.push({ role: "user", content: caller });
    conversationHistory.push({ role: "assistant", content: reply });
  }

  console.log("=== BENCHMARK COMPLETED SUCCESSFULLY ===");
}

runBenchmark().catch(console.error);
