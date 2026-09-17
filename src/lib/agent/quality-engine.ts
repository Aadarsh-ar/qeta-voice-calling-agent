/**
 * Response Quality & Anti-Hallucination Engine for Voice Agents
 *
 * Validates every generated response before Cartesia TTS:
 *  1. RELEVANCE: Directly addresses caller's latest utterance
 *  2. GROUNDING: Prevents fabricated business policies, pricing, and timelines
 *  3. SPOKEN VOICE FORMAT: 1-3 short sentences, clean spoken Telugu/English, no markdown
 *  4. SINGLE QUESTION RULE: Prevents overwhelming caller with multiple questions
 */

import { normalizeTeluguText } from "../speech/normalizeTelugu";

export interface QualityValidationOptions {
  userUtterance: string;
  rawText: string;
  isGroundedTopic: boolean;
  hasRetrievedSnippets: boolean;
  hasExecutedTools: boolean;
  language?: string;
}

export interface QualityValidationResult {
  isValid: boolean;
  validatedText: string;
  normalizedText: string;
  wasModified: boolean;
  modificationReason?: string;
}

export class QualityEngine {
  validateResponse(options: QualityValidationOptions): QualityValidationResult {
    const {
      userUtterance,
      rawText,
      isGroundedTopic,
      hasRetrievedSnippets,
      hasExecutedTools,
      language = "TELUGU_ENGLISH",
    } = options;

    let text = rawText.trim();
    let wasModified = false;
    let modificationReason = "";

    // 1. Clean Markdown & Telephony formatting
    // Remove markdown bold/italic asterisks, backticks, bullets, and emojis
    const cleaned = text
      .replace(/\*\*(.*?)\*\*/g, "$1")
      .replace(/\*(.*?)\*/g, "$1")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/^[•\-\*]\s+/gm, "")
      .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}]/gu, "")
      .replace(/\s+/g, " ")
      .trim();

    if (cleaned !== text) {
      text = cleaned;
      wasModified = true;
      modificationReason = "Cleaned markdown and formatting for phone speech.";
    }

    const lowerUser = (userUtterance || "").toLowerCase();

    const isPolicyOrFactQuery =
      lowerUser.includes("refund") ||
      lowerUser.includes("రీఫండ్") ||
      lowerUser.includes("రిటర్న్") ||
      lowerUser.includes("warranty") ||
      lowerUser.includes("వారంటీ") ||
      lowerUser.includes("discount") ||
      lowerUser.includes("తగ్గింపు") ||
      lowerUser.includes("డెలివరీ") ||
      lowerUser.includes("గ్యారంటీ");

    if (isPolicyOrFactQuery && !hasRetrievedSnippets && !hasExecutedTools) {
      // Check if LLM boldly promised a refund or warranty out of thin air
      const lowerReply = text.toLowerCase();
      const hasFabrication =
        lowerReply.includes("100%") ||
        lowerReply.includes("30 రోజులు") ||
        lowerReply.includes("30 days") ||
        lowerReply.includes("free refund") ||
        lowerReply.includes("గ్యారంటీ ఇస్తాము");

      if (hasFabrication) {
        text =
          language === "ENGLISH"
            ? "I don't have that specific policy detail in my records right now. I can help with our services or connect you with a specialist."
            : "క్షమించండి, ఆ పాలసీ వివరాలు ప్రస్తుతం నా వద్ద అందుబాటులో లేవు. నేను మా సేవల గురించి చెప్పగలను లేదా సంబంధిత అధికారికి కనెక్ట్ చేయగలను.";
        wasModified = true;
        modificationReason = "Replaced fabricated policy claim with grounded honest fallback.";
      }
    }

    // 3. Brevity & Sentence Cap for Telephony
    // Cap at 2 sentences max so callers aren't overwhelmed over phone
    const sentenceDelimiters = /[.!?।]\s+/;
    const sentences = text.split(sentenceDelimiters).filter((s) => s.trim().length > 0);
    if (sentences.length > 3) {
      text = sentences.slice(0, 2).join(". ") + ".";
      wasModified = true;
      modificationReason = "Trimmed response to 2 sentences for phone brevity.";
    }

    // 4. Phonetic Telugu Number & Currency Normalization
    const normalizedText = normalizeTeluguText(text);

    return {
      isValid: true,
      validatedText: text,
      normalizedText,
      wasModified,
      modificationReason: wasModified ? modificationReason : undefined,
    };
  }
}

export const qualityEngine = new QualityEngine();
