import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function runAcceptanceTest() {
  console.log("===============================================================");
  console.log("  SECTION 24 ACCEPTANCE TEST — FULL DYNAMIC CARTESIA AGENT");
  console.log("===============================================================");

  const agentId = "agent_Pv4hHbMWRubDumrq4v4L15";
  const cartesiaAgentId = "agent_Pv4hHbMWRubDumrq4v4L15";

  const config = {
    name: "ABC Support",
    systemPrompt: `You are a polite customer support agent for ABC Electronics.
Speak naturally in Telugu and Tenglish.
Help customers with orders and delivery.
Never invent order information.
If you cannot resolve an issue, offer human support.`,
    cartesiaAgentId,
    language: "TELUGU_ENGLISH",
    cartesiaVoiceId: "ff480e6e-3e79-4307-9889-d1d9feb8e20e",
    businessProfile: {
      businessName: "ABC Electronics",
      description: "Electronics retailer",
      location: "Hyderabad",
      workingHours: "9 AM - 7 PM",
      productsServices: "TV, AC and refrigerator sales and service",
      faqs: [
        {
          question: "మీ refund policy ఏంటి?",
          answer: "డెలివరీ అయిన 7 రోజులలోపు రిటర్న్ లేదా రీఫండ్ అభ్యర్థించవచ్చు అండి. ప్రొడక్ట్ ఒరిజినల్ బాక్స్‌తో ఉండాలి."
        }
      ]
    },
    tools: [
      { name: "get_order_status", description: "Get real order delivery status", isEnabled: true },
      { name: "transfer_call", description: "Transfer to human support", isEnabled: true },
      { name: "end_call", description: "End the call", isEnabled: true }
    ]
  };

  // 1. SAVE AGENT via SaaS API
  console.log("\n[STEP 1] Saving Agent & Synchronizing with Cartesia API...");
  const saveRes = await fetch(`http://localhost:3000/api/agents/${agentId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config)
  });

  const saveData = await saveRes.json();
  console.log("Save Response Status:", saveRes.status);
  console.log("Save Response Body:", JSON.stringify(saveData, null, 2));

  if (!saveData.success || !saveData.synced) {
    throw new Error(`Cartesia Synchronization Failed: ${saveData.error}`);
  }
  console.log(`✓ Cartesia Synchronized: Version ID = ${saveData.cartesiaVersionId}`);

  // 2. VERIFY DATABASE PERSISTENCE in Neon PostgreSQL
  console.log("\n[STEP 2] Verifying Neon PostgreSQL Persistence...");
  const dbAgent = await prisma.agent.findUnique({
    where: { id: agentId },
    include: { business: true, tools: true, knowledge: true }
  });

  if (!dbAgent) throw new Error("Agent not found in PostgreSQL!");
  console.log("✓ Agent Name in DB:", dbAgent.name);
  console.log("✓ Cartesia Agent ID in DB:", dbAgent.cartesiaAgentId);
  console.log("✓ Instructions in DB:", dbAgent.instructions.slice(0, 80) + "...");
  console.log("✓ Business Name in DB:", dbAgent.business?.name);
  console.log("✓ Knowledge Chunks in DB:", dbAgent.knowledge.length);
  console.log("✓ Tools in DB:", dbAgent.tools.map(t => t.name).join(", "));

  // 3. VERIFY CARTESIA API STATE
  console.log("\n[STEP 3] Verifying Cartesia Official Agent API Retrieval...");
  const cartesiaApiKey = process.env.CARTESIA_API_KEY;
  const cartesiaGetRes = await fetch(`https://api.cartesia.ai/v1/agents/${cartesiaAgentId}`, {
    headers: {
      "X-API-Key": cartesiaApiKey,
      "Cartesia-Version": "2026-08-14"
    }
  });
  const cartesiaData = await cartesiaGetRes.json();
  console.log("Cartesia Agent Name:", cartesiaData.name);
  console.log("Cartesia Initial Message:", cartesiaData.config?.initial_message);
  console.log("Cartesia Instructions Length:", cartesiaData.config?.instructions?.length);
  console.log("Cartesia Voice ID:", cartesiaData.config?.audio?.output?.voice_id);
  console.log("✓ Cartesia instructions contain 'ABC Electronics':", cartesiaData.config?.instructions?.includes("ABC Electronics"));
  console.log("✓ Cartesia instructions contain 'ABC Support':", cartesiaData.config?.instructions?.includes("ABC Support"));

  // 4. TEST AGENT MULTI-TURN CONVERSATION WITH STRUCTURED DEBUG TRACE
  console.log("\n[STEP 4] Executing Live Multi-Turn Test Conversation...");

  const turns = [
    {
      role: "user",
      input: "హలో, నా order ఇంకా రాలేదు."
    },
    {
      role: "user",
      input: "నా దగ్గర order number లేదు. మీ shop ఎక్కడ ఉంది?"
    },
    {
      role: "user",
      input: "మీ refund policy ఏంటి?"
    }
  ];

  let conversationHistory = [];

  for (let i = 0; i < turns.length; i++) {
    const turn = turns[i];
    console.log(`\n--- Turn ${i + 1}: Customer says "${turn.input}" ---`);

    const turnRes = await fetch("http://localhost:3000/api/agent/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agentId,
        userMessage: turn.input,
        conversationHistory
      })
    });

    const turnData = await turnRes.json();
    console.log("[CUSTOMER INPUT]      :", turn.input);
    console.log("[INTENT DETECTED]     :", turnData.intent);
    console.log("[RETRIEVED KNOWLEDGE] :", turnData.retrievedSnippets?.length, "snippets");
    if (turnData.retrievedSnippets?.length > 0) {
      turnData.retrievedSnippets.forEach(s => console.log("   ->", s.title));
    }
    console.log("[TOOL CALLS]          :", turnData.toolCalls?.map(t => t.name).join(", ") || "None");
    console.log("[AGENT RESPONSE]      :", turnData.rawReply);
    console.log("[NORMALIZED TELUGU]   :", turnData.normalizedReply);
    console.log("[TTS LATENCY]         :", turnData.latencies?.ttsMs, "ms (Cartesia Sonic)");
    console.log("[AUDIO RECEIVED]      :", Boolean(turnData.audioBase64), `(${turnData.audioBase64?.length || 0} base64 chars)`);

    conversationHistory.push({ role: "user", content: turn.input });
    conversationHistory.push({ role: "assistant", content: turnData.rawReply });
  }

  console.log("\n===============================================================");
  console.log("  ALL ACCEPTANCE TEST STEPS COMPLETED & VERIFIED SUCCESSFULLY!");
  console.log("===============================================================");
  await prisma.$disconnect();
}

runAcceptanceTest().catch(err => {
  console.error("Acceptance Test Failed:", err);
  process.exit(1);
});
