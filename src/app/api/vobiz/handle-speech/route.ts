import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { compileAgentInstructions } from "@/lib/agent/promptCompiler";

/**
 * Vobiz Speech Handler — Conversational AI Loop
 *
 * Flow:
 * 1. Vobiz POSTs caller's transcribed speech here
 * 2. We load the REAL agent instructions from PostgreSQL (agent behavior ground truth)
 * 3. We send it to Groq LLM for a response using the actual agent prompt
 * 4. We return XML with <Gather><Speak> to speak the response and listen for more
 * 5. Loop continues until caller says bye or hangs up
 */

// In-memory conversation history per call (keyed by CallUUID)
const callSessions = new Map<string, { role: string; content: string; agentPrompt?: string; agentName?: string }[]>();

// In-memory agent config cache per call (avoid repeated DB hits)
const callAgentCache = new Map<string, { systemPrompt: string; agentName: string; language: string }>();

/**
 * Loads the real agent instructions from the database for the given call/agent
 */
async function resolveAgentConfig(callUUID: string, queryAgentId?: string): Promise<{ systemPrompt: string; agentName: string; language: string }> {
  // Check cache first
  if (callAgentCache.has(callUUID)) {
    return callAgentCache.get(callUUID)!;
  }

  let dbAgent: any = null;

  // 1. Try to find agent via call record
  try {
    const callRecord = await prisma.call.findFirst({
      where: {
        OR: [
          { id: callUUID },
          { vobizCallId: callUUID },
        ],
      },
      include: {
        agent: {
          include: { business: true, knowledge: true, tools: true },
        },
      },
    });
    if (callRecord?.agent) {
      dbAgent = callRecord.agent;
    }
  } catch (e) {
    console.warn("[SPEECH] Call record lookup warning:", e);
  }

  // 2. Fallback: Find agent directly by ID
  if (!dbAgent && queryAgentId) {
    try {
      dbAgent = await prisma.agent.findFirst({
        where: {
          OR: [
            { id: queryAgentId },
            { cartesiaAgentId: queryAgentId },
          ],
        },
        include: { business: true, knowledge: true, tools: true },
      });
    } catch {}
  }

  // 3. Fallback: Use first active agent
  if (!dbAgent) {
    try {
      dbAgent = await prisma.agent.findFirst({
        where: { status: "ACTIVE" },
        include: { business: true, knowledge: true, tools: true },
        orderBy: { updatedAt: "desc" },
      });
    } catch {}
  }

  if (!dbAgent) {
    // Absolute fallback — generic prompt
    const fallback = {
      systemPrompt: `You are a helpful AI voice assistant on a LIVE PHONE CALL.
STRICT RULES:
1. Keep EVERY response to 1-2 sentences MAX (under 25 words).
2. Speak in natural Telugu/Tenglish.
3. Be warm and polite. Use "అండి", "ఖచ్చితంగా", "ధన్యవాదాలు".
4. If caller says bye/thanks, give a warm farewell and include [END_CALL] at the end.
5. NEVER output markdown, asterisks, bullet points, or emojis.
6. Ask only ONE question at a time.`,
      agentName: "AI Assistant",
      language: "TELUGU_ENGLISH",
    };
    callAgentCache.set(callUUID, fallback);
    return fallback;
  }

  // Compile the agent's real instructions from the DB
  const agentName = dbAgent.name || "AI Assistant";
  const rawInstructions = (dbAgent.instructions || dbAgent.systemPrompt || "").trim();
  const language = dbAgent.language || "TELUGU_ENGLISH";

  let bizProfile: any = {};
  if (dbAgent.businessContext && dbAgent.businessContext.trim().startsWith("{")) {
    try { bizProfile = JSON.parse(dbAgent.businessContext); } catch {}
  }
  if (!bizProfile.businessName && dbAgent.business) {
    bizProfile = {
      businessName: dbAgent.business.name,
      description: dbAgent.business.description || "",
      productsServices: dbAgent.business.information || "",
      workingHours: dbAgent.business.operatingHours || "",
      location: dbAgent.business.address || "",
      contactInfo: dbAgent.business.contactInformation || "",
      website: dbAgent.business.website || "",
    };
  }

  const systemPrompt = rawInstructions
    ? compileAgentInstructions({
        agentName,
        instructions: rawInstructions,
        businessName: bizProfile.businessName,
        businessDescription: bizProfile.description,
        businessInformation: bizProfile.productsServices,
        operatingHours: bizProfile.workingHours,
        address: bizProfile.location,
        contactInformation: bizProfile.contactInfo,
        website: bizProfile.website,
        faqs: (dbAgent.knowledge || []).map((k: any) => ({ question: k.title, answer: k.content })),
        tools: (dbAgent.tools || []).map((t: any) => ({ name: t.name, description: t.description, isEnabled: t.enabled && t.isEnabled })),
        language,
      })
    : compileAgentInstructions({
        agentName,
        instructions: "Assist the caller helpfully, politely, and concisely.",
        businessName: bizProfile.businessName || "QETADOTIN",
        language,
      });

  const result = { systemPrompt, agentName, language };
  callAgentCache.set(callUUID, result);

  console.log(`[SPEECH] Loaded real agent config for call ${callUUID}: agent="${agentName}", language="${language}", prompt=${systemPrompt.length} chars`);
  return result;
}

export async function POST(req: Request) {
  try {
    // Parse Vobiz webhook payload
    const contentType = req.headers.get("content-type") || "";
    let params: Record<string, string> = {};

    if (contentType.includes("application/x-www-form-urlencoded")) {
      const text = await req.text();
      for (const pair of text.split("&")) {
        const [k, v] = pair.split("=");
        params[decodeURIComponent(k)] = decodeURIComponent(v || "");
      }
    } else if (contentType.includes("application/json")) {
      params = await req.json();
    } else {
      const text = await req.text();
      try { params = JSON.parse(text); } catch {
        for (const pair of text.split("&")) {
          const [k, v] = pair.split("=");
          if (k) params[decodeURIComponent(k)] = decodeURIComponent(v || "");
        }
      }
    }

    const callUUID = params.CallUUID || params.call_uuid || params.callSid || `call_${Date.now()}`;
    const speechResult = params.SpeechResult || params.speech || params.Digits || params.digits || "";
    const confidence = params.SpeechResultConfidence || params.confidence || "0";
    const queryAgentId = params.agentId || params.agent_id || "";

    console.log(`[SPEECH] CallUUID: ${callUUID}`);
    console.log(`[SPEECH] Caller said: "${speechResult}" (confidence: ${confidence})`);

    // Load REAL agent instructions from DB (cached per call)
    const agentConfig = await resolveAgentConfig(callUUID, queryAgentId);

    // Get or initialize conversation history
    if (!callSessions.has(callUUID)) {
      callSessions.set(callUUID, []);
    }
    const history = callSessions.get(callUUID)!;

    // Add caller's speech to history
    if (speechResult && speechResult.trim().length > 0) {
      history.push({ role: "user", content: speechResult });
    }

    // ─── Get LLM Response using REAL agent prompt ──────────────────────
    let agentReply = "";
    let shouldEnd = false;

    const groqKey = process.env.GROQ_API_KEY || "";
    const openaiKey = process.env.OPENAI_API_KEY || "";
    const isGroq = Boolean(groqKey && groqKey.length > 10);
    const endpoint = isGroq
      ? "https://api.groq.com/openai/v1/chat/completions"
      : "https://api.openai.com/v1/chat/completions";
    const bearer = isGroq ? groqKey : openaiKey;
    const model = isGroq ? (process.env.GROQ_MODEL || "qwen/qwen3.8-27b") : "gpt-4o-mini";

    if (bearer && speechResult) {
      try {
        const messages = [
          { role: "system", content: agentConfig.systemPrompt },
          ...history.slice(-8).map(h => ({ role: h.role, content: h.content })),
        ];

        const t0 = Date.now();
        const res = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${bearer}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ model, messages, temperature: 0.3, max_tokens: 50 }),
        });

        if (res.ok) {
          const data = await res.json();
          agentReply = (data.choices?.[0]?.message?.content || "")
            .replace(/\*\*(.*?)\*\*/g, "$1")   // Strip bold markdown
            .replace(/\*(.*?)\*/g, "$1")         // Strip italic markdown
            .replace(/`([^`]+)`/g, "$1")         // Strip code ticks
            .replace(/^[•\-\*]\s+/gm, "")       // Strip bullet points
            .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}]/gu, "") // Strip emojis
            .trim();
          console.log(`[LLM] Agent "${agentConfig.agentName}" responded in ${Date.now() - t0}ms: "${agentReply}"`);

          // Check for end-call signal
          if (agentReply.includes("[END_CALL]")) {
            shouldEnd = true;
            agentReply = agentReply.replace("[END_CALL]", "").trim();
          }

          // Detect explicit ending phrases from caller
          const lowerSpeech = speechResult.toLowerCase();
          const isExplicitEnd = /(^|\s)(bye|goodbye|thanks?\s*bye|that'?s\s*all|i'?m\s*done|no\s*more|బై|థాంక్యూ\s*బై|ఇంక\s*చాలు|సరే\s*మరి|ఇంకేమీ\s*లేదు|అంతే\s*అండి)(\s|$)/i.test(lowerSpeech);
          if (isExplicitEnd && !shouldEnd) {
            shouldEnd = true;
          }
        } else {
          const err = await res.text();
          console.error(`[LLM] Error (${res.status}): ${err.slice(0, 200)}`);
        }
      } catch (llmErr) {
        console.error("[LLM] Fetch error:", llmErr);
      }
    }

    // Fallback responses using agent's language preference
    if (!agentReply) {
      const lower = (speechResult || "").toLowerCase();
      const isEnglish = agentConfig.language === "ENGLISH";
      if (lower.includes("price") || lower.includes("ధర") || lower.includes("cost")) {
        agentReply = isEnglish
          ? "Our starter plan is ₹15,000 per month with 2,000 calling minutes. Would you like a demo?"
          : "మా starter plan నెలకు ₹15,000 అండి, 2,000 calling minutes తో. మీకు demo కావాలా?";
      } else if (lower.includes("bye") || lower.includes("thanks") || lower.includes("థాంక్స్")) {
        agentReply = isEnglish
          ? "Thank you so much! It was great speaking with you. Have a wonderful day!"
          : "చాలా సంతోషం అండి! మీతో మాట్లాడటం చాలా బాగుంది. శుభ దినం!";
        shouldEnd = true;
      } else if (lower.includes("demo") || lower.includes("డెమో")) {
        agentReply = isEnglish
          ? "Absolutely! I'll schedule a demo for you tomorrow at 10:30 AM. Can I have your name?"
          : "ఖచ్చితంగా అండి! రేపు morning 10:30 కి demo schedule చేస్తాను. మీ name చెప్పగలరా?";
      } else {
        agentReply = isEnglish
          ? "I understand. Please tell me your requirement and I'll be happy to assist."
          : "అవునండి, నేను మీ మాటలు విన్నాను. దయచేసి మీ requirement చెప్పండి.";
      }
    }

    // Add agent reply to history
    history.push({ role: "assistant", content: agentReply });
    console.log(`[AGENT] ${agentConfig.agentName} Reply: "${agentReply}"`);

    const publicUrl = process.env.NEXT_PUBLIC_SERVER_URL || "";
    const handleSpeechUrl = `${publicUrl}/api/vobiz/handle-speech`;

    // Determine Polly voice based on language
    const pollyVoice = agentConfig.language === "ENGLISH" ? "Polly.Aditi" : "Polly.Aditi";
    const pollyLang = agentConfig.language === "ENGLISH" ? "en-IN" : "te-IN";

    let xml: string;

    if (shouldEnd) {
      // End the call gracefully
      xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Speak voice="${pollyVoice}" language="${pollyLang}">${escapeXml(agentReply)}</Speak>
  <Hangup/>
</Response>`;
      // Clean up session and cache
      callSessions.delete(callUUID);
      callAgentCache.delete(callUUID);
    } else {
      // Continue conversation loop
      xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather inputType="speech" action="${handleSpeechUrl}" method="POST" speechEndTimeout="2" speechModel="default" language="${pollyLang}">
    <Speak voice="${pollyVoice}" language="${pollyLang}">${escapeXml(agentReply)}</Speak>
  </Gather>
  <Speak voice="${pollyVoice}" language="${pollyLang}">${agentConfig.language === "ENGLISH" ? "I couldn't hear your response." : "మీ సమాధానం వినపడలేదు అండి."}</Speak>
  <Redirect method="POST">${publicUrl}/api/vobiz/incoming-call</Redirect>
</Response>`;
    }

    return new NextResponse(xml, {
      status: 200,
      headers: { "Content-Type": "application/xml" },
    });
  } catch (err: unknown) {
    console.error("[SPEECH] Handler error:", err);
    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?><Response><Speak>ప్రస్తుతం సాంకేతిక సమస్య ఉంది. దయచేసి తర్వాత ప్రయత్నించండి.</Speak><Hangup/></Response>`,
      { status: 200, headers: { "Content-Type": "application/xml" } }
    );
  }
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
