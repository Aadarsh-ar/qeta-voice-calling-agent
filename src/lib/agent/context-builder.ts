/**
 * Agent Context Builder with High-Efficiency Instruction Grounding
 *
 * Engineered to keep prompt under 700 tokens to strictly prevent Groq 8000 TPM rate limits,
 * while maximizing relevance, instruction following, and conversational empathy.
 */

import { AgentItem } from "../db/store";
import { KnowledgeSnippet } from "./knowledge-retriever";

export interface BuildContextOptions {
  agent: AgentItem;
  customerName?: string;
  customerPhone?: string;
  retrievedSnippets?: KnowledgeSnippet[];
  confirmedFacts?: Record<string, string>;
  activeTopic?: string;
}

export class ContextBuilder {
  buildSystemPrompt(options: BuildContextOptions): string {
    const {
      agent,
      customerName = "Caller",
      customerPhone = "",
      retrievedSnippets = [],
      confirmedFacts = {},
      activeTopic,
    } = options;

    const biz = agent.businessProfile || {
      businessName: "QETADOTIN",
      description: agent.businessContext || "Enterprise Voice Intelligence SaaS",
      productsServices: "Voice Calling Agents",
      workingHours: "9:00 AM - 7:00 PM IST",
      location: "Hyderabad, India",
      contactInfo: "+91 80 7158 2667",
      faqs: [],
    };

    // Determine language guidance
    let languageGuideline = "natural everyday Telugu mixed with conversational English (Tenglish)";
    if (agent.language === "ENGLISH") {
      languageGuideline = "clear, warm Indian English";
    } else if (agent.language === "TELUGU") {
      languageGuideline = "polite, natural conversational Telugu";
    }

    // Grounded knowledge snippets
    let knowledgeBlock = "";
    if (retrievedSnippets.length > 0) {
      knowledgeBlock = `\nRELEVANT KNOWLEDGE:\n` +
        retrievedSnippets.slice(0, 2).map((s) => `- ${s.title}: ${s.content}`).join("\n");
    }

    // Business FAQs (include up to 3 relevant FAQs)
    let faqsBlock = "";
    if (biz.faqs && biz.faqs.length > 0) {
      faqsBlock = `\nBUSINESS FAQS:\n` +
        biz.faqs.slice(0, 3).map((f) => `Q: ${f.question} -> A: ${f.answer}`).join("\n");
    }

    // User configured instructions (cleaned up and preserved)
    const userInstructions = (agent.systemPrompt || "కస్టమర్‌కు మర్యాదగా సహాయం చేయండి.").trim();

    return `You are ${agent.name}, an autonomous AI voice representative for ${biz.businessName}.
You are speaking on a LIVE PHONE CALL with a customer (${customerName}).

CORE VOICE RULES & INSTRUCTION HIERARCHY:
1. INSTRUCTION HIERARCHY: System Safety > Runtime Rules > Business Rules > Agent Persona > Retrieved Knowledge > Tool Info > Memory > Customer Request.
2. ZERO FABRICATION: Never invent order status, delivery dates, or prices. If real-time order tracking or booking is needed, call the tool. If the order ID is not known, politely ask: "మీ order number చెప్పగలరా?".
3. RELEVANCE & PROBLEM SOLVING: Directly and helpfully solve the customer's actual question or problem.
4. CONVERSATIONAL STYLE: Speak in ${languageGuideline}. Use polite markers ("అవునండి", "ఖచ్చితంగా అండి", "అర్థమైంది అండి", "ధన్యవాదాలు").
5. BREVITY: Keep answers strictly to 1 or 2 natural spoken sentences (under 25 words).
6. SINGLE QUESTION: Ask only ONE question at a time.
7. NO MARKDOWN: Output only natural spoken words without asterisks or formatting.

BUSINESS CONTEXT:
- Company: ${biz.businessName}
- About: ${biz.description || "Voice Services"}
- Services: ${biz.productsServices || "Customer Assistance"}
- Hours: ${biz.workingHours || "9:00 AM - 7:00 PM"}
- Contact: ${biz.contactInfo || "+91 80 7158 2667"}${faqsBlock}${knowledgeBlock}

AGENT INSTRUCTIONS & TRAINING:
${userInstructions}`.trim();
  }
}

export const contextBuilder = new ContextBuilder();
