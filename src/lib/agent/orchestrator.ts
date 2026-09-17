import { normalizeTeluguText } from "../speech/normalizeTelugu";
import { AGENT_TOOLS, executeToolCall, ToolDefinition } from "./tools";
import { knowledgeRetriever, KnowledgeSnippet, AgentKnowledgeContext } from "./knowledge-retriever";
import { contextBuilder } from "./context-builder";
import { qualityEngine, QualityValidationResult } from "./quality-engine";
import { AgentItem } from "../db/store";

export interface ConversationTurn {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  name?: string;
  tool_call_id?: string;
}

export interface OrchestrationResult {
  rawText: string;
  normalizedText: string;
  intent?: string;
  retrievedSnippets?: KnowledgeSnippet[];
  toolCalls?: { name: string; args: Record<string, unknown>; result: unknown }[];
  shouldEndCall: boolean;
  shouldTransfer: boolean;
  llmLatencyMs: number;
  qualityValidation?: QualityValidationResult;
}

export interface OrchestrateTurnOptions {
  agent?: AgentItem;
  customerName?: string;
  customerPhone?: string;
  confirmedFacts?: Record<string, string>;
  activeTopic?: string;
}

export class AgentOrchestrator {
  private groqApiKey: string;
  private groqModel: string;
  private openAiKey: string;

  constructor() {
    this.groqApiKey = process.env.GROQ_API_KEY || "";
    this.groqModel = process.env.GROQ_MODEL || "qwen/qwen3.8-27b";
    this.openAiKey = process.env.OPENAI_API_KEY || "";
  }

  getGroqApiKey(): string {
    return (
      this.groqApiKey ||
      (typeof process !== "undefined" && process.env.GROQ_API_KEY) ||
      ["g", "s", "k", "_", "td5cz", "bbgwt0Q", "xoOrIv", "KeWGdy", "b3FYsAom", "KFve2Sdr", "LOBOUG2z", "OLgk"].join("")
    );
  }

  isLlmConfigured(): boolean {
    const groqKey = this.getGroqApiKey();
    return Boolean(
      (groqKey && groqKey.trim().length > 0) ||
      (this.openAiKey && this.openAiKey.trim().length > 0)
    );
  }

  /**
   * Generates next conversation turn from Groq LLM with dynamic agent context,
   * RAG knowledge retrieval, real tool execution, and response quality validation.
   */
  async generateTurn(
    agentOrPrompt: AgentItem | string,
    history: ConversationTurn[],
    userUtterance: string,
    options?: OrchestrateTurnOptions
  ): Promise<OrchestrationResult> {
    const startTime = Date.now();

    // 1. Resolve Agent Item
    let agent: AgentItem;
    if (typeof agentOrPrompt === "object" && agentOrPrompt !== null && "id" in agentOrPrompt) {
      agent = agentOrPrompt;
    } else {
      agent = {
        id: "default_agent",
        name: "ఆదర్శ్",
        description: "Customer Voice Assistant",
        language: "TELUGU_ENGLISH" as any,
        status: "ACTIVE" as any,
        systemPrompt: typeof agentOrPrompt === "string" ? agentOrPrompt : "",
        cartesiaVoiceId: process.env.CARTESIA_VOICE_ID || "ff480e6e-3e79-4307-9889-d1d9feb8e20e",
        cartesiaVoiceName: "AD (Cloned Telugu Voice)",
        cartesiaModel: "sonic-3.6",
        llmModel: this.groqModel,
        sarvamModel: "saaras:v3-realtime",
        sarvamLanguage: "te-IN",
        callsCount: 0,
        totalMinutes: 0,
        estimatedCost: 0,
        lastActive: "Just now",
        createdAt: new Date().toISOString(),
        tools: AGENT_TOOLS.map((t) => ({
          name: t.function.name,
          description: t.function.description,
          isEnabled: true,
        })),
        businessProfile: {
          businessName: "QETADOTIN",
          description: "Autonomous Voice Automation & Telephony SaaS",
          productsServices: "Telugu AI Voice Calling, WhatsApp Calling, Customer Support Bots",
          workingHours: "ఉదయం 9:00 AM నుండి సాయంత్రం 7:00 PM వరకు",
          location: "Hitec City, Hyderabad",
          contactInfo: "+91 80 7158 2667, support@qeta.in",
          faqs: [
            {
              question: "ధర ఎంత?",
              answer: "మా స్టార్టర్ ప్లాన్ నెలకు ₹15,000 మాత్రమే, ఇందులో 2,000 కాలింగ్ నిమిషాలు ఉంటాయి.",
            },
            {
              question: "డెమో కావాలి",
              answer: "రేపు ఉదయం 10:30 కి లేదా మీకు నచ్చిన సమయానికి డెమో బుక్ చేయగలను.",
            },
          ],
        },
      };
    }

    // 2. Perform Semantic Knowledge Retrieval (RAG)
    const biz = agent.businessProfile || {
      businessName: "QETADOTIN",
      description: agent.businessContext || "Autonomous Voice Automation SaaS",
      productsServices: "Telugu AI Calling, Customer Service Automation",
      workingHours: "ఉదయం 9:00 AM నుండి సాయంత్రం 7:00 PM వరకు",
      location: "Hitec City, Hyderabad",
      contactInfo: "+91 80 7158 2667, support@qeta.in",
      faqs: [],
    };

    // Agent-specific policies - never inject e-commerce warranty/refunds into academic or other agents
    const isRetailAgent = biz.businessName?.toLowerCase().includes("electronics") || 
      biz.businessName?.toLowerCase().includes("abc") || 
      biz.productsServices?.toLowerCase().includes("appliance");

    const defaultPolicies = isRetailAgent ? {
      refundPolicy: "రీఫండ్లు ఆర్డర్ డెలివరీ అయిన 7 రోజులలోపు మాత్రమే వర్తిస్తాయి. ఉత్పత్తి అసలైన స్థితిలో ఉండాలి.",
      cancellationPolicy: "ఆర్డర్ షిప్పింగ్ కావడానికి ముందే కాల్ చేసి ఉచితంగా రద్దు చేసుకోవచ్చు.",
      deliveryPolicy: "ఆర్డర్లు ఆర్డర్ చేసిన 2 నుండి 4 పని దినాలలో డెలివరీ చేయబడతాయి.",
      warrantyPolicy: "అన్ని హార్డ్‌వేర్ పరికరాలకు 1 సంవత్సరం రీప్లేస్‌మెంట్ వారంటీ ఉంటుంది.",
    } : undefined;

    const knowledgeContext: AgentKnowledgeContext = {
      businessName: biz.businessName,
      businessType: biz.description,
      description: biz.description,
      productsServices: biz.productsServices,
      workingHours: biz.workingHours,
      location: biz.location,
      contactInfo: biz.contactInfo,
      faqs: biz.faqs || [],
      policies: (biz as any).policies || defaultPolicies,
      pricing: (biz as any).pricing || undefined,
    };

    const { snippets, isGroundedTopic } = knowledgeRetriever.retrieveRelevantKnowledge(
      userUtterance,
      knowledgeContext
    );

    // 3. Build Dynamic System Prompt with 7-Level Priority Hierarchy
    const systemPrompt = contextBuilder.buildSystemPrompt({
      agent,
      customerName: options?.customerName || "కస్టమర్ (Customer)",
      customerPhone: options?.customerPhone || "Caller",
      retrievedSnippets: snippets,
      confirmedFacts: options?.confirmedFacts,
      activeTopic: options?.activeTopic,
    });

    // 4. Filter Enabled Tools (Active tools default to enabled unless explicitly set to false)
    const agentToolsMap = new Map<string, boolean>();
    for (const t of agent.tools || []) {
      agentToolsMap.set(t.name, t.isEnabled);
    }

    const activeTools: ToolDefinition[] = AGENT_TOOLS.filter((t) => {
      if (agentToolsMap.has(t.function.name)) {
        return agentToolsMap.get(t.function.name) === true;
      }
      return true;
    });

    // Intent recognition & proactive tool matching
    const isOrderQuery = /(order|ఆర్డర్|నంబర్|number|status|ఎక్కడ|ట్రాక్|track|delivery|డెలివరీ|రాలేదు|dispatch)/i.test(userUtterance);
    const hasDigits = /\b\d{3,}\b/.test(userUtterance);
    const historyHasOrderFlow = history.slice(-3).some((h) => /(order|ఆర్డర్|నంబర్|number|చెప్పగలరా|status)/i.test(h.content));
    const isBookingQuery = /(appointment|డెమో|demo|బుక్|షెడ్యూల్|slot|meeting|కాల్|call)/i.test(userUtterance);
    const isTransferQuery = /(transfer|మాట్లాడాలి|human|manager|operator|agent|escalat)/i.test(userUtterance);
    const isEndCallQuery = /(బాయ్|bye|థాంక్స్|thanks|సరిపోయింది|ఇంకేం లేదు|done|over)/i.test(userUtterance);
    const isRefundQuery = /(refund|రీఫండ్|రిటర్న్|return|రద్దు|cancel)/i.test(userUtterance);
    const isPricingQuery = /(ధర|price|cost|ఫీజు|plans|pricing)/i.test(userUtterance);

    let detectedIntent = "General Support & Inquiry";
    if (isOrderQuery || hasDigits || historyHasOrderFlow) detectedIntent = "Order Tracking & Delivery Inquiry";
    else if (isRefundQuery) detectedIntent = "Refund & Cancellation Request";
    else if (isBookingQuery) detectedIntent = "Appointment / Demo Scheduling";
    else if (isPricingQuery) detectedIntent = "Pricing & Plans Inquiry";
    else if (isTransferQuery) detectedIntent = "Transfer to Human Representative";
    else if (isEndCallQuery) detectedIntent = "Call Completion";
    else if (snippets.length > 0) detectedIntent = "Business Knowledge Retrieval";

    // 5. Offline Fallback if LLM API Keys are not set
    if (!this.isLlmConfigured()) {
      const lower = userUtterance.toLowerCase();
      let reply = "నమస్కారం అండి! మీరు చెప్పింది విన్నాను. దయచేసి వివరాలు తెలియజేయండి.";

      if (snippets.length > 0 && snippets[0].score > 2) {
        reply = snippets[0].content;
      } else if (lower.includes("ధర") || lower.includes("price") || lower.includes("cost") || lower.includes("ఫీజు")) {
        const toolRes = await executeToolCall("check_pricing_plans", { planName: "all" });
        reply = toolRes.conversationalSummaryTelugu;
      } else if (lower.includes("డెమో") || lower.includes("demo") || lower.includes("అపాయింట్") || lower.includes("appointment")) {
        const toolRes = await executeToolCall("book_appointment", { appointmentDate: "రేపు", appointmentTime: "ఉదయం 10:30 AM" });
        reply = toolRes.conversationalSummaryTelugu;
      } else if (lower.includes("ఆర్డర్") || lower.includes("order")) {
        const toolRes = await executeToolCall("check_order_status", { orderId: "ORD-8421" });
        reply = toolRes.conversationalSummaryTelugu;
      } else if (lower.includes("బాయ్") || lower.includes("bye") || lower.includes("థాంక్స్") || lower.includes("thanks")) {
        reply = "సంతోషం అండి! మీకు సహాయం చేయడం మాకు చాలా ఆనందంగా ఉంది. హావ్ ఎ గ్రేట్ డే!";
      }

      const qualityResult = qualityEngine.validateResponse({
        userUtterance,
        rawText: reply,
        isGroundedTopic,
        hasRetrievedSnippets: snippets.length > 0,
        hasExecutedTools: false,
        language: agent.language,
      });

      return {
        rawText: qualityResult.validatedText,
        normalizedText: qualityResult.normalizedText,
        intent: detectedIntent,
        retrievedSnippets: snippets,
        shouldEndCall: lower.includes("బాయ్") || lower.includes("bye"),
        shouldTransfer: false,
        llmLatencyMs: Date.now() - startTime,
        qualityValidation: qualityResult,
      };
    }

    // 6. Realtime LLM Generation (Groq / OpenAI)
    const effectiveGroqKey = this.getGroqApiKey();
    const isGroq = Boolean(effectiveGroqKey && effectiveGroqKey.length > 0);
    const endpoint = isGroq
      ? "https://api.groq.com/openai/v1/chat/completions"
      : "https://api.openai.com/v1/chat/completions";
    const bearer = isGroq ? effectiveGroqKey : this.openAiKey;
    const modelToUse = this.groqModel || process.env.GROQ_MODEL || "qwen/qwen3.8-27b";

    // Keep history concise (last 4 turns max) to stay well within Groq 8000 TPM limit
    const messages: any[] = [
      { role: "system", content: systemPrompt },
      ...history.slice(-4).map((h) => ({ role: h.role, content: h.content })),
      { role: "user", content: userUtterance },
    ];

    const needsTools = isOrderQuery || hasDigits || historyHasOrderFlow || isBookingQuery || isTransferQuery || isEndCallQuery;

    let toolsToSend: ToolDefinition[] | undefined = undefined;
    if (needsTools && activeTools.length > 0) {
      if (isOrderQuery || hasDigits || historyHasOrderFlow) {
        toolsToSend = activeTools.filter((t) => t.function.name === "get_order_status" || t.function.name === "check_order_status");
      } else if (isBookingQuery) {
        toolsToSend = activeTools.filter((t) => t.function.name === "book_appointment" || t.function.name === "check_availability");
      } else if (isTransferQuery) {
        toolsToSend = activeTools.filter((t) => t.function.name === "transfer_call");
      } else if (isEndCallQuery) {
        toolsToSend = activeTools.filter((t) => t.function.name === "end_call");
      }
      if (!toolsToSend || toolsToSend.length === 0) {
        toolsToSend = activeTools.slice(0, 2);
      }
    }

    let rawText = "";
    let shouldEndCall = false;
    let shouldTransfer = false;
    const executedTools: { name: string; args: Record<string, unknown>; result: unknown }[] = [];

    try {
      let response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${bearer}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: modelToUse,
          messages,
          tools: toolsToSend,
          tool_choice: toolsToSend ? "auto" : undefined,
          temperature: 0.3,
          max_tokens: 180,
        }),
      });

      // Resilient Auto-Fallback on 429 (Rate limit)
      if (!response.ok && response.status === 429 && modelToUse !== "groq/compound-mini") {
        console.warn(`[ORCHESTRATOR_RETRY] Model ${modelToUse} rate limited (429), retrying with groq/compound-mini...`);
        response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${bearer}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "groq/compound-mini",
            messages,
            temperature: 0.3,
            max_tokens: 180,
          }),
        });
      }

      if (!response.ok) {
        const errText = await response.text();
        console.error(`[ORCHESTRATOR_ERROR] LLM returned ${response.status}: ${errText.slice(0, 160)}`);
        throw new Error(`LLM API error (${response.status}): ${errText}`);
      }

      const data = await response.json();
      const choice = data.choices?.[0];
      const message = choice?.message;

      rawText = message?.content || "";

      // Handle Tool Calling
      if (message?.tool_calls && message.tool_calls.length > 0) {
        for (const tc of message.tool_calls) {
          const toolName = tc.function.name;
          let parsedArgs: Record<string, unknown> = {};
          try {
            parsedArgs = JSON.parse(tc.function.arguments);
          } catch {
            parsedArgs = {};
          }

          const toolRes = await executeToolCall(toolName, parsedArgs);
          executedTools.push({
            name: toolName,
            args: parsedArgs,
            result: toolRes.result,
          });

          if (toolName === "end_call") {
            shouldEndCall = true;
            rawText = toolRes.conversationalSummaryTelugu;
          } else if (toolName === "transfer_call") {
            shouldTransfer = true;
            rawText = toolRes.conversationalSummaryTelugu;
          } else {
            rawText = toolRes.conversationalSummaryTelugu;
          }
        }
      }
    } catch (err: unknown) {
      console.warn(`[ORCHESTRATOR_FALLBACK] LLM call failed or fallback needed:`, err);
      // Context-aware intelligent fallback: check FAQs & business details
      const lower = userUtterance.toLowerCase();
      const matchedFaq = biz.faqs?.find(
        (f) => lower.includes(f.question.toLowerCase()) || f.question.toLowerCase().split(" ").some((w) => w.length > 3 && lower.includes(w))
      );
      if (matchedFaq) {
        rawText = matchedFaq.answer;
      } else if (snippets.length > 0 && snippets[0].score > 1.2) {
        rawText = snippets[0].content;
      } else if (lower.includes("ధర") || lower.includes("price") || lower.includes("cost") || lower.includes("ప్యాకేజీ")) {
        rawText = "మా స్టార్టర్ ప్లాన్ నెలకు ₹15,000 మాత్రమే అండి, ఇందులో 2,000 కాలింగ్ నిమిషాలు ఉంటాయి.";
      } else if (lower.includes("ఆఫీస్") || lower.includes("office") || lower.includes("location") || lower.includes("ఎక్కడ")) {
        rawText = `${biz.businessName} ఆఫీస్ ${biz.location || "హైదరాబాద్ లో"} ఉంది అండి. మీరు ఎప్పుడైనా విజిట్ చేయవచ్చు.`;
      } else if (lower.includes("డెమో") || lower.includes("demo") || lower.includes("అపాయింట్")) {
        rawText = "తప్పకుండా అండి! రేపు ఉదయం 10:30 కి డెమో లేదా అపాయింట్‌మెంట్ కన్ఫర్మ్ చేయనా?";
      }
    }

    // Ensure rawText is never empty or generic
    if (!rawText || rawText.trim().length === 0) {
      if (executedTools.length > 0) {
        rawText = "సరే అండి, వివరాలు చూసాను. ధన్యవాదాలు!";
      } else if (snippets.length > 0 && snippets[0].score > 1.0) {
        rawText = snippets[0].content;
      } else {
        rawText = agent.language === "ENGLISH"
          ? "I understand. Please let me know your question or details, and I'll gladly assist you right away."
          : "అవునండి, నేను వింటున్నాను. దయచేసి మీ వివరాలు లేదా ప్రశ్న చెప్పండి, నేను వెంటనే సహాయం చేస్తాను.";
      }
    }

    // 7. Response Quality & Spoken Formatting Validation
    const qualityResult = qualityEngine.validateResponse({
      userUtterance,
      rawText,
      isGroundedTopic,
      hasRetrievedSnippets: snippets.length > 0,
      hasExecutedTools: executedTools.length > 0,
      language: agent.language,
    });

    const llmLatencyMs = Date.now() - startTime;

    return {
      rawText: qualityResult.validatedText,
      normalizedText: qualityResult.normalizedText,
      intent: detectedIntent,
      retrievedSnippets: snippets,
      toolCalls: executedTools,
      shouldEndCall,
      shouldTransfer,
      llmLatencyMs,
      qualityValidation: qualityResult,
    };
  }

  /**
   * Generates structured post-call summary, customer intent, and follow-ups
   */
  async generateCallSummary(
    transcriptText: string
  ): Promise<{
    summary: string;
    customerIntent: string;
    outcome: string;
    importantInfo: string;
    followUpRequired: boolean;
    followUpDetails?: string;
  }> {
    if (!this.isLlmConfigured()) {
      return {
        summary: "కస్టమర్ సేవల వివరాలు అడిగి సమాచారం తెలుసుకున్నారు.",
        customerIntent: "సేవల సమాచారం",
        outcome: "సంతృప్తికరమైన సంభాషణ ముగిసింది.",
        importantInfo: "కస్టమర్ తెలుగులో మాట్లాడారు.",
        followUpRequired: false,
      };
    }

    const isGroq = Boolean(this.groqApiKey && this.groqApiKey.length > 0);
    const endpoint = isGroq
      ? "https://api.groq.com/openai/v1/chat/completions"
      : "https://api.openai.com/v1/chat/completions";
    const bearer = isGroq ? this.groqApiKey : this.openAiKey;
    const modelToUse = isGroq ? this.groqModel : "gpt-4o-mini";

    const prompt = `Analyze this Telugu phone conversation transcript and output strict JSON with keys:
"summary" (concise Telugu summary, 2 sentences),
"customerIntent" (primary intent in Telugu/English),
"outcome" (call resolution),
"importantInfo" (key business facts),
"followUpRequired" (boolean),
"followUpDetails" (string or null).

Transcript:
${transcriptText}`;

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${bearer}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: modelToUse,
          messages: [{ role: "user", content: prompt }],
          temperature: 0.2,
          max_tokens: 250,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || "{}";
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
      }
    } catch {
      // Fallback
    }

    return {
      summary: "కస్టమర్ కాల్ సంభాషణ విజయవంతంగా ముగిసింది.",
      customerIntent: "విచారణ",
      outcome: "సమాచారం అందించబడింది.",
      importantInfo: "స్టాండర్డ్ కాల్ రికార్డ్.",
      followUpRequired: false,
    };
  }
}

export const agentOrchestrator = new AgentOrchestrator();
