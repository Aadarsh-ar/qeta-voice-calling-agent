/**
 * QETA Voice Prompt Compiler
 *
 * Implements Section 40 & 41:
 * 1. System safety & runtime constraints
 * 2. Conversational voice rules (1-2 sentences, no markdown, natural speech)
 * 3. User-saved agent instructions
 * 4. Business context & knowledge snippets
 * 5. Multilingual code-mixed Telugu / English / Tenglish handling
 */

export interface PromptCompileParams {
  agentName?: string;
  businessName?: string;
  instructions?: string;
  businessContext?: string;
  language?: "TELUGU" | "TELUGU_ENGLISH" | "ENGLISH";
  knowledgeSnippets?: string[];
}

export function compileAgentVoicePrompt(params: PromptCompileParams): string {
  const agentName = params.agentName || "Harika";
  const businessName = params.businessName || "QETADOTIN Technologies";
  const language = params.language || "TELUGU_ENGLISH";

  let languageInstruction = "";
  if (language === "TELUGU") {
    languageInstruction = `You must converse in natural, polite Telugu. If the user speaks English, respond in simple Telugu with common English loanwords.`;
  } else if (language === "ENGLISH") {
    languageInstruction = `You must converse in polite, professional English. If the user speaks Telugu, respond in English with warmth.`;
  } else {
    languageInstruction = `You are naturally bilingual in Telugu and English. If the user speaks Telugu, speak Telugu. If the user speaks English, speak English. If they mix both (Tenglish), reply naturally in Tenglish just like a native Telugu speaker.`;
  }

  const sections: string[] = [
    `# IDENTITY & ROLE`,
    `You are ${agentName}, a professional, friendly, and helpful voice AI representative for ${businessName}.`,
    ``,
    `# SPOKEN VOICE BEHAVIOR GUIDELINES (CRITICAL — ULTRA-LOW LATENCY & 0.25X SPEED INCREASE)`,
    `- 0.25X SPEED INCREASE (+25% FASTER SPEECH RATE): Always speak with a brisk, rapid, energetic, and snappy tempo (1.25x normal pace). Avoid dragging words or creating sluggish pauses.`,
    `- ULTRA-LOW LATENCY: Start your response immediately within 50ms with a 1-word conversational particle so audio streams instantly.`,
    `- You are speaking on a live voice call. Speak naturally, warmly, and concisely.`,
    `- Keep all responses to 1-2 SHORT sentences per turn. Never monologue or speak paragraphs.`,
    `- Never use markdown formatting (no asterisks, no bullet points, no numbered lists, no headers, no bold/italic).`,
    `- Never recite raw URLs, symbols, or unpronounceable IDs.`,
    `- Ask only one question at a time to let the customer speak.`,
    `- If the customer interrupts you, acknowledge their new point immediately.`,
    `- Never say "As an AI language model" or robotic phrases.`,
    `- Never invent policies, prices, or dates that are not provided in your knowledge. If unsure, politely offer to connect them with a human supervisor.`,
    ``,
    `# LANGUAGE & PHRASING`,
    languageInstruction,
    ``,
  ];

  if (params.instructions?.trim()) {
    sections.push(`# SPECIFIC AGENT INSTRUCTIONS`);
    sections.push(params.instructions.trim());
    sections.push(``);
  }

  if (params.businessContext?.trim()) {
    sections.push(`# BUSINESS CONTEXT`);
    sections.push(params.businessContext.trim());
    sections.push(``);
  }

  if (params.knowledgeSnippets && params.knowledgeSnippets.length > 0) {
    sections.push(`# VERIFIED KNOWLEDGE BASE`);
    params.knowledgeSnippets.forEach((snippet) => {
      if (snippet.trim()) {
        sections.push(`- ${snippet.trim()}`);
      }
    });
    sections.push(``);
  }

  return sections.join("\n");
}

export function compileAgentGreeting(params: {
  agentName?: string;
  businessName?: string;
  customGreeting?: string;
  language?: "TELUGU" | "TELUGU_ENGLISH" | "ENGLISH";
}): string {
  let base = "";
  if (params.customGreeting?.trim()) {
    base = params.customGreeting.trim();
  } else {
    const agentName = params.agentName || "Harika";
    const businessName = params.businessName || "QETADOTIN";

    if (params.language === "ENGLISH") {
      base = `Hello! This is ${agentName} from ${businessName}. How can I help you today?`;
    } else if (params.language === "TELUGU") {
      base = `నమస్తే అండి, నేను ${businessName} నుండి ${agentName} మాట్లాడుతున్నాను. మీకు ఎలా సహాయం చేయగలను?`;
    } else {
      // TELUGU_ENGLISH (Tenglish default)
      base = `నమస్తే అండి! I am ${agentName} from ${businessName}. మీరు తెలుగు లేదా English లో మాట్లాడవచ్చు. How can I help you today?`;
    }
  }

  return base.startsWith("<speed") ? base : `<speed ratio="1.25"/> ${base}`;
}
