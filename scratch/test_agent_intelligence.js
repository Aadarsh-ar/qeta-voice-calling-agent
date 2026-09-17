// Automated Multi-Scenario Evaluation Suite for Configured Agent Intelligence
const BASE_URL = "http://127.0.0.1:3000";

const scenarios = [
  {
    name: "Scenario 1: Greeting & Business Identity",
    endpoint: "/api/agent/turn",
    payload: {
      action: "greeting",
      agentId: "cmu3vwach00034r98dvgsyjy6",
    },
    validate: (res) => {
      console.log("  Greeting:", res.greeting);
      if (!res.greeting || !res.agent?.name) throw new Error("Greeting or agent name missing");
      return true;
    },
  },
  {
    name: "Scenario 2: RAG Knowledge Grounding (Refund Policy)",
    endpoint: "/api/agent/turn",
    payload: {
      agentId: "cmu3vwach00034r98dvgsyjy6",
      userUtterance: "మీ రీఫండ్ పాలసీ ఏమిటి? నాకు రీఫండ్ వస్తుందా?",
      customerPhone: "+916305367443",
    },
    validate: (res) => {
      console.log("  Raw Reply:", res.rawReply);
      console.log("  Normalized Spoken Text:", res.normalizedReply);
      console.log("  Retrieved Chunks:", (res.retrievedSnippets || []).map((s) => `[${s.source}] ${s.title}`));
      if (!res.retrievedSnippets || res.retrievedSnippets.length === 0) {
        throw new Error("Expected RAG to retrieve refund policy snippet");
      }
      return true;
    },
  },
  {
    name: "Scenario 3: Anti-Hallucination on Ungrounded Topic",
    endpoint: "/api/agent/turn",
    payload: {
      agentId: "cmu3vwach00034r98dvgsyjy6",
      userUtterance: "మీ వద్ద స్పేస్ రాకెట్ ఇంజిన్లు లేదా హెలికాప్టర్లు దొరుకుతాయా?",
      customerPhone: "+916305367443",
    },
    validate: (res) => {
      console.log("  Anti-Hallucination Reply:", res.normalizedReply);
      const text = (res.normalizedReply || "").toLowerCase();
      // Should decline or state not available, never invent selling helicopters
      const isGrounded = text.includes("లేదు") || text.includes("అందుబాటులో") || text.includes("క్షమించండి") || text.includes("సహాయపడగలను");
      if (!isGrounded) throw new Error("Expected honest fallback for ungrounded inquiry");
      return true;
    },
  },
  {
    name: "Scenario 4: Real Tool Execution (Order Tracking ORD-8421)",
    endpoint: "/api/agent/turn",
    payload: {
      agentId: "cmu3vwach00034r98dvgsyjy6",
      userUtterance: "నా ఆర్డర్ ORD-8421 ఎక్కడ ఉంది? స్టేటస్ చెప్పండి.",
      customerPhone: "+916305367443",
    },
    validate: (res) => {
      console.log("  Tool Reply:", res.normalizedReply);
      console.log("  Executed Tools:", JSON.stringify(res.toolCalls));
      if (!res.toolCalls || res.toolCalls.length === 0) {
        throw new Error("Expected check_order_status tool to be called");
      }
      const tc = res.toolCalls[0];
      if (tc.name !== "check_order_status") {
        throw new Error(`Expected check_order_status, got ${tc.name}`);
      }
      return true;
    },
  },
  {
    name: "Scenario 5: Pricing Knowledge / Tool (Pricing Tiers)",
    endpoint: "/api/agent/turn",
    payload: {
      agentId: "cmu3vwach00034r98dvgsyjy6",
      userUtterance: "మీ ప్లాన్స్ మరియు ధరల వివరాలు చెప్పండి.",
      customerPhone: "+916305367443",
    },
    validate: (res) => {
      console.log("  Pricing Reply:", res.normalizedReply);
      const text = res.normalizedReply || "";
      const hasPricing = text.includes("15,000") || text.includes("₹") || text.includes("స్టార్టర్") || text.includes("రూపాయలు") || res.retrievedSnippets?.length > 0;
      if (!hasPricing) throw new Error("Expected pricing information in response");
      return true;
    },
  },
  {
    name: "Scenario 6: Test Agent Modal API with Audio & Latency",
    endpoint: "/api/agent/test",
    payload: {
      agentId: "cmu3vwach00034r98dvgsyjy6",
      userMessage: "నమస్కారం, రేపు ఉదయం 10:30 కి డెమో కావాలి.",
    },
    validate: (res) => {
      console.log("  Modal Reply:", res.normalizedReply);
      console.log("  Latencies (STT/LLM/TTS):", res.latencies);
      console.log("  Has Base64 Audio:", Boolean(res.audioBase64));
      if (!res.success) throw new Error("Test agent modal API failed");
      return true;
    },
  },
];

async function runEvaluation() {
  console.log("═══════════════════════════════════════════════════════");
  console.log("     STARTING AGENT INTELLIGENCE EVALUATION SUITE     ");
  console.log("═══════════════════════════════════════════════════════\n");

  let passed = 0;

  for (const s of scenarios) {
    console.log(`▶ Running: ${s.name}`);
    try {
      const res = await fetch(`${BASE_URL}${s.endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(s.payload),
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`HTTP ${res.status}: ${txt}`);
      }

      const json = await res.json();
      s.validate(json);
      console.log(`  ✓ PASSED\n`);
      passed++;
    } catch (err) {
      console.error(`  ✗ FAILED: ${err.message}\n`);
    }
    // 1.5s delay to keep Groq on-demand TPM quota healthy
    await new Promise((r) => setTimeout(r, 1500));
  }

  console.log("═══════════════════════════════════════════════════════");
  console.log(`  RESULT: ${passed}/${scenarios.length} Scenarios Passed`);
  console.log("═══════════════════════════════════════════════════════");
}

runEvaluation();
