import { NextResponse } from "next/server";

/**
 * Vobiz Speech Handler — Conversational AI Loop
 *
 * Flow:
 * 1. Vobiz POSTs caller's transcribed speech here
 * 2. We send it to Groq LLM for a response
 * 3. We return XML with <Gather><Speak> to speak the response and listen for more
 * 4. Loop continues until caller says bye or hangs up
 */

// In-memory conversation history per call (keyed by CallUUID)
const callSessions = new Map<string, { role: string; content: string }[]>();

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

    console.log(`[SPEECH] CallUUID: ${callUUID}`);
    console.log(`[SPEECH] Caller said: "${speechResult}" (confidence: ${confidence})`);

    // Get or initialize conversation history
    if (!callSessions.has(callUUID)) {
      callSessions.set(callUUID, [
        { role: "assistant", content: "నమస్కారం అండి! నేను Vaani AI నుండి మాట్లాడుతున్నాను." }
      ]);
    }
    const history = callSessions.get(callUUID)!;

    // Add caller's speech to history
    if (speechResult && speechResult.trim().length > 0) {
      history.push({ role: "user", content: speechResult });
    }

    // ─── Get LLM Response ──────────────────────────────────────────────
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

    const systemPrompt = `You are Vaani AI, a friendly Telugu AI voice assistant on a LIVE PHONE CALL.

STRICT RULES:
1. Keep EVERY response to 1-2 sentences MAX (under 25 words). This is a PHONE CALL — be brief.
2. Speak in natural Tenglish (Telugu + English mix as spoken in Hyderabad).
3. Be warm and polite. Use "అండి", "ఖచ్చితంగా", "ధన్యవాదాలు".
4. If caller says bye/thanks, give a warm farewell and include [END_CALL] at the end.
5. NEVER mention AI, prompts, system, or technical details.
6. If asked about pricing: "మా starter plan నెలకు ₹15,000 అండి, 2,000 calling minutes తో."
7. If asked for demo/appointment: "ఖచ్చితంగా అండి! రేపు morning 10:30 కి schedule చేస్తాను."
8. Ask only ONE question at a time.

BUSINESS: Vaani Enterprises - AI Voice Automation for Telugu/Regional Languages
LOCATION: Hitec City, Hyderabad | EMAIL: contact@vaani.ai`;

    if (bearer && speechResult) {
      try {
        const messages = [
          { role: "system", content: systemPrompt },
          ...history.slice(-8).map(h => ({ role: h.role, content: h.content })),
        ];

        const t0 = Date.now();
        const res = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${bearer}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ model, messages, temperature: 0.3, max_tokens: 150 }),
        });

        if (res.ok) {
          const data = await res.json();
          agentReply = data.choices?.[0]?.message?.content || "";
          console.log(`[LLM] Response in ${Date.now() - t0}ms: "${agentReply}"`);

          // Check for end-call signal
          if (agentReply.includes("[END_CALL]")) {
            shouldEnd = true;
            agentReply = agentReply.replace("[END_CALL]", "").trim();
          }
        } else {
          const err = await res.text();
          console.error(`[LLM] Error (${res.status}): ${err.slice(0, 200)}`);
        }
      } catch (llmErr) {
        console.error("[LLM] Fetch error:", llmErr);
      }
    }

    // Fallback responses
    if (!agentReply) {
      const lower = (speechResult || "").toLowerCase();
      if (lower.includes("price") || lower.includes("ధర") || lower.includes("cost")) {
        agentReply = "మా starter plan నెలకు ₹15,000 అండి, 2,000 calling minutes తో. మీకు demo కావాలా?";
      } else if (lower.includes("bye") || lower.includes("thanks") || lower.includes("థాంక్స్")) {
        agentReply = "చాలా సంతోషం అండి! మీతో మాట్లాడటం చాలా బాగుంది. శుభ దినం!";
        shouldEnd = true;
      } else if (lower.includes("demo") || lower.includes("డెమో")) {
        agentReply = "ఖచ్చితంగా అండి! రేపు morning 10:30 కి demo schedule చేస్తాను. మీ name చెప్పగలరా?";
      } else {
        agentReply = "అవునండి, నేను మీ మాటలు విన్నాను. దయచేసి మీ requirement చెప్పండి.";
      }
    }

    // Add agent reply to history
    history.push({ role: "assistant", content: agentReply });
    console.log(`[AGENT] Reply: "${agentReply}"`);

    const publicUrl = process.env.NEXT_PUBLIC_SERVER_URL || "";
    const handleSpeechUrl = `${publicUrl}/api/vobiz/handle-speech`;

    let xml: string;

    if (shouldEnd) {
      // End the call gracefully
      xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Speak voice="Polly.Aditi" language="te-IN">${escapeXml(agentReply)}</Speak>
  <Hangup/>
</Response>`;
      // Clean up session
      callSessions.delete(callUUID);
    } else {
      // Continue conversation loop
      xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather inputType="speech" action="${handleSpeechUrl}" method="POST" speechEndTimeout="2" speechModel="default" language="te-IN">
    <Speak voice="Polly.Aditi" language="te-IN">${escapeXml(agentReply)}</Speak>
  </Gather>
  <Speak voice="Polly.Aditi" language="te-IN">మీ సమాధానం వినపడలేదు అండి.</Speak>
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
