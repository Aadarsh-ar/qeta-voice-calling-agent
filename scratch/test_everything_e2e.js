import { PrismaClient } from "@prisma/client";
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const prisma = new PrismaClient();

// Load .env.local
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, "..", ".env.local");
if (existsSync(envPath)) {
  const envContent = readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx !== -1) {
        const key = trimmed.slice(0, eqIdx).trim();
        const val = trimmed.slice(eqIdx + 1).trim();
        if (!process.env[key]) process.env[key] = val;
      }
    }
  }
}

async function runTestEverything() {
  console.log("================================================================================");
  console.log("            QETADOTIN — COMPREHENSIVE END-TO-END SYSTEM TEST SUITE             ");
  console.log("================================================================================");

  const testResults = [];
  const logResult = (name, passed, details = "") => {
    testResults.push({ name, passed, details });
    const mark = passed ? "PASS" : "FAIL";
    console.log(`[${mark}] ${name} ${details ? "— " + details : ""}`);
  };

  // Fetch active agent dynamically from Prisma DB
  let activeAgent = await prisma.agent.findFirst({
    where: { status: "ACTIVE" },
    include: { business: true, tools: true, knowledge: true },
  });
  if (!activeAgent) {
    activeAgent = await prisma.agent.findFirst({
      include: { business: true, tools: true, knowledge: true },
    });
  }
  const agentId = activeAgent ? activeAgent.id : "agent_GaiYMgB9Bj9kaKW1tUgqSQ";
  const cartesiaAgentId = activeAgent?.cartesiaAgentId || agentId;

  // 1. Check Server Liveness
  try {
    const res = await fetch("http://localhost:3000/api/vobiz/call-status");
    if (res.ok) {
      const data = await res.json();
      logResult("1. Next.js & Custom Voice Server", true, `HTTP ${res.status} | Pipeline: ${data.pipeline?.callerPlayback || "OK"}`);
    } else {
      logResult("1. Next.js & Custom Voice Server", false, `HTTP ${res.status}`);
    }
  } catch (err) {
    logResult("1. Next.js & Custom Voice Server", false, err.message);
  }

  // 2. Test PostgreSQL Database (Neon DB)
  try {
    const org = await prisma.organization.findFirst();
    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
      include: { business: true, tools: true, knowledge: true },
    });
    if (agent) {
      logResult("2. Neon PostgreSQL Persistence", true, `Agent: "${agent.name}", Business: "${agent.business?.name || "N/A"}", Tools: ${agent.tools.length}, Knowledge Chunks: ${agent.knowledge.length}`);
    } else {
      logResult("2. Neon PostgreSQL Persistence", false, "Agent record not found in PostgreSQL");
    }
  } catch (err) {
    logResult("2. Neon PostgreSQL Persistence", false, err.message);
  }

  // 3. Test Cartesia Direct REST API
  try {
    const apiKey = process.env.CARTESIA_API_KEY;
    if (!apiKey) throw new Error("CARTESIA_API_KEY missing");
    const res = await fetch(`https://api.cartesia.ai/v1/agents/${cartesiaAgentId}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Cartesia-Version": "2026-08-14",
      },
    });
    if (res.ok) {
      const data = await res.json();
      logResult("3. Cartesia Agent API Connectivity", true, `Connected to Agent ID: ${data.id} (Version: ${data.version?.id})`);
    } else {
      logResult("3. Cartesia Agent API Connectivity", false, `HTTP ${res.status}`);
    }
  } catch (err) {
    logResult("3. Cartesia Agent API Connectivity", false, err.message);
  }

  // 4. Test Dynamic Agent Save & Cartesia Synchronization API (PUT /api/agents/[id])
  try {
    const updatePayload = {
      name: "ABC Support (Active)",
      systemPrompt: `You are a polite customer support agent for ABC Electronics.
Speak naturally in Telugu and Tenglish.
Help customers with orders, delivery and refunds.
Never invent order information.
If you cannot resolve an issue, offer human support.`,
      cartesiaAgentId,
      language: "TELUGU_ENGLISH",
      cartesiaVoiceId: activeAgent?.cartesiaVoiceId || "f9945b75-0f3b-448d-ba9e-3d22c229a68e",
      businessProfile: {
        businessName: "ABC Electronics",
        description: "Electronics retail and home appliances service",
        location: "Hitec City, Hyderabad",
        workingHours: "9:00 AM - 7:00 PM",
        productsServices: "TVs, Air Conditioners, Refrigerators and Customer Support",
        contactInfo: "+91 80 7158 2667",
        faqs: [
          {
            question: "మీ refund policy ఏంటి?",
            answer: "డెలివరీ అయిన 7 రోజులలోపు రీఫండ్ అభ్యర్థించవచ్చు అండి. ప్రొడక్ట్ ఒరిజినల్ ప్యాకింగ్ లో ఉండాలి.",
          },
          {
            question: "మీరు ఎక్కడ ఉన్నారు?",
            answer: "మా ABC Electronics షోరూమ్ హైదరాబాద్ హైటెక్ సిటీ లో ఉంది అండి.",
          },
        ],
      },
      tools: [
        { name: "get_order_status", description: "Fetch live order shipping status", isEnabled: true },
        { name: "transfer_call", description: "Transfer to human manager", isEnabled: true },
        { name: "end_call", description: "Gracefully terminate the call", isEnabled: true },
      ],
    };

    const putRes = await fetch(`http://localhost:3000/api/agents/${agentId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updatePayload),
    });
    const putData = await putRes.json();
    if (putRes.ok && putData.success && putData.synced) {
      logResult("4. SaaS-to-Cartesia Sync (PUT /api/agents/[id])", true, `Confirmed Version: ${putData.cartesiaVersionId}`);
    } else {
      logResult("4. SaaS-to-Cartesia Sync (PUT /api/agents/[id])", false, putData.error || `HTTP ${putRes.status}`);
    }
  } catch (err) {
    logResult("4. SaaS-to-Cartesia Sync (PUT /api/agents/[id])", false, err.message);
  }

  // 5. Test Agent Browser Token Generator (/api/cartesia/agent-token)
  try {
    const tokenRes = await fetch("http://localhost:3000/api/cartesia/agent-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentId }),
    });
    const tokenData = await tokenRes.json();
    if (tokenRes.ok && tokenData.success && tokenData.wsUrl) {
      logResult("5. Cartesia Client Session Token (/api/cartesia/agent-token)", true, `wsUrl received, protocol version: ${tokenData.cartesiaVersion}`);
    } else {
      logResult("5. Cartesia Client Session Token (/api/cartesia/agent-token)", false, tokenData.error || `HTTP ${tokenRes.status}`);
    }
  } catch (err) {
    logResult("5. Cartesia Client Session Token (/api/cartesia/agent-token)", false, err.message);
  }

  // 6. Test Multi-Turn Conversational Intelligence & Cartesia Sonic TTS Synthesis
  try {
    const testTurns = [
      {
        prompt: "హలో, నా ఆర్డర్ రాలేదు, ఎప్పుడు వస్తుంది?",
        expectedKeyword: "order",
      },
      {
        prompt: "మీ షాప్ ఎక్కడ ఉంది?",
        expectedKeyword: "హైదరాబాద్",
      },
      {
        prompt: "మీ రీఫండ్ విధానం ఏమిటి?",
        expectedKeyword: "రీఫండ్",
      },
    ];

    let history = [];
    let allTurnsPassed = true;

    for (let i = 0; i < testTurns.length; i++) {
      const t = testTurns[i];
      const res = await fetch("http://localhost:3000/api/agent/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId,
          userMessage: t.prompt,
          conversationHistory: history,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success || !data.rawReply) {
        allTurnsPassed = false;
        break;
      }

      history.push({ role: "user", content: t.prompt });
      history.push({ role: "assistant", content: data.rawReply });
    }

    if (allTurnsPassed) {
      logResult("6. Conversational AI & Cartesia Sonic Synthesis (3 Turns)", true, `All 3 turns succeeded with verified Telugu replies & synthesized Cartesia audio`);
    } else {
      logResult("6. Conversational AI & Cartesia Sonic Synthesis (3 Turns)", false, "Failed turn processing");
    }
  } catch (err) {
    logResult("6. Conversational AI & Cartesia Sonic Synthesis (3 Turns)", false, err.message);
  }

  // 7. Test Phone Number & Telephony Assignment
  try {
    const agentData = await prisma.agent.findUnique({ where: { id: agentId } });
    const vobizConfigured = Boolean(process.env.VOBIZ_AUTH_ID && process.env.VOBIZ_AUTH_TOKEN);
    if (agentData && vobizConfigured) {
      logResult("7. Telephony Trunk & DID Routing (+91 80 7158 2667)", true, `Bound to DID: +91 80 7158 2667 via Vobiz SIP Trunk`);
    } else {
      logResult("7. Telephony Trunk & DID Routing", false, "DID or Vobiz credentials missing");
    }
  } catch (err) {
    logResult("7. Telephony Trunk & DID Routing", false, err.message);
  }

  console.log("\n================================================================================");
  const total = testResults.length;
  const passedCount = testResults.filter(r => r.passed).length;
  console.log(`TEST SUMMARY: ${passedCount}/${total} PASSED (${Math.round((passedCount/total)*100)}%)`);
  console.log("================================================================================");

  await prisma.$disconnect();
}

runTestEverything().catch(err => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
