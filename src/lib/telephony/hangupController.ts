/**
 * Centralized Call Termination & Conversation-End Controller
 * Enforces strict Auto-Hangup and Lifecycle Rules:
 * 
 * 1. Keep calls active during natural conversations.
 * 2. NEVER terminate prematurely due to pauses, thinking, STT/TTS latency, or network delay.
 * 3. Terminate ONLY when conversation has clearly concluded.
 * 4. Detect explicit user endings in English, Telugu, and Hinglish/Tenglish.
 * 5. Speak short natural closing before disconnecting.
 * 6. Always finish speaking the closing sentence before dropping the line.
 * 7. Single centralized function `endCall(reason)` with idempotency protection.
 * 8. Distinguish PREMATURE_DISCONNECT vs INTENTIONAL_CONVERSATION_END.
 */

import { dataStore } from "../db/store";
import { CallStatus } from "../types/models";

export enum EndCallReason {
  USER_ENDED = "USER_ENDED",
  AGENT_ENDED = "AGENT_ENDED",
  CONVERSATION_COMPLETED = "CONVERSATION_COMPLETED",
  MAX_DURATION = "MAX_DURATION",
  PROVIDER_TERMINATED = "PROVIDER_TERMINATED",
  FATAL_ERROR = "FATAL_ERROR",
  PREMATURE_DISCONNECT = "PREMATURE_DISCONNECT",
  INTENTIONAL_CONVERSATION_END = "INTENTIONAL_CONVERSATION_END",
}

export interface TerminationLogEntry {
  callId: string;
  reason: EndCallReason;
  classification: "PREMATURE_DISCONNECT" | "INTENTIONAL_CONVERSATION_END";
  timestamp: string;
  durationSeconds?: number;
  finalConversationState?: string;
  transcriptCount?: number;
}

// Track active terminations to prevent multiple handlers from racing / terminating twice
const terminatingCalls = new Map<string, { startedAt: number; reason: EndCallReason }>();
const terminationLogs: TerminationLogEntry[] = [];

/**
 * Detects explicit user phrases indicating they want to end the call.
 * Covers English, Telugu, and mixed Tenglish/Hinglish idioms.
 */
export function detectExplicitUserEnding(text: string): {
  isEnding: boolean;
  matchedPhrase?: string;
  language?: "en" | "te" | "mixed";
} {
  if (!text || typeof text !== "string") return { isEnding: false };

  const clean = text.trim().toLowerCase();

  // English phrases
  const englishEndings = [
    /\bbye\b/i,
    /\bgoodbye\b/i,
    /\bthank you[, ]+bye\b/i,
    /\bthanks[, ]+bye\b/i,
    /\bthat'?s all\b/i,
    /\bi'?m done\b/i,
    /\bno more questions\b/i,
    /\bnothing else\b/i,
    /\bthat is all\b/i,
    /\bhave a (good|great|nice) day\b/i,
    /\btalk to you later\b/i,
    /\bcall you later\b/i,
    /\bhang up\b/i,
    /\bsee you\b/i,
  ];

  for (const regex of englishEndings) {
    const match = clean.match(regex);
    if (match) {
      return { isEnding: true, matchedPhrase: match[0], language: "en" };
    }
  }

  // Telugu & Tenglish phrases
  const teluguEndings = [
    /బై/i,
    /గుడ్\s*బై/i,
    /థాంక్యూ\s*(అండి)?\s*బై/i,
    /థాంక్స్\s*(అండి)?\s*బై/i,
    /ఇంక\s*చాలు/i,
    /ఇక\s*చాలు/i,
    /ఇంకేమీ\s*లేదు/i,
    /ఇంకేమి\s*లేదు/i,
    /సరే\s*మరి/i,
    /సరే\s*(అండి)?\s*బై/i,
    /సరే\s*ఉంటాను/i,
    /ఇక\s*ఉంటాను/i,
    /నో\s*మోర్\s*క్వశ్చన్స్/i,
    /నో\s*మోర్/i,
    /అంతే\s*(అండి)?/i,
    /చాలండి/i,
    /సరే\s*థాంక్యూ/i,
    /ధన్యవాదాలు\s*(అండి)?\s*బై/i,
    /ok\s*bye/i,
    /okay\s*bye/i,
    /k\s*bye/i,
  ];

  for (const regex of teluguEndings) {
    const match = clean.match(regex);
    if (match) {
      return { isEnding: true, matchedPhrase: match[0], language: "te" };
    }
  }

  return { isEnding: false };
}

/**
 * Returns a polite, brief spoken closing sentence.
 * Rule 6: Before terminating, agent gives short natural closing.
 */
export function getSpokenClosingPhrase(language: string = "TELUGU_ENGLISH"): string {
  if (language === "ENGLISH") {
    return "Thank you! Have a great day. Bye!";
  }
  if (language === "TELUGU") {
    return "సరే అండి! మాట్లాడినందుకు చాలా ధన్యవాదాలు, హావ్ ఎ గ్రేట్ డే, బై!";
  }
  // Default Tenglish / Conversational Telugu
  return "థాంక్యూ అండి! హావ్ ఎ గ్రేట్ డే, బై!";
}

export interface EndCallParams {
  callId: string;
  reason: EndCallReason;
  /** Function to perform the physical disconnect (SIP BYE, WebSocket close, LiveKit disconnect) */
  disconnectFn: () => Promise<void> | void;
  /** Milliseconds to wait for audio playback buffer to finish playing to carrier */
  audioDurationMs?: number;
  finalConversationState?: string;
  language?: string;
}

/**
 * Rule 10: Single centralized function for intentional termination.
 * Idempotent, logged, distinguishes PREMATURE vs INTENTIONAL, waits for final TTS audio to finish.
 */
export async function endCall(params: EndCallParams): Promise<boolean> {
  const { callId, reason, disconnectFn, audioDurationMs = 0, finalConversationState, language } = params;

  if (!callId) {
    console.warn("[END_CALL] Invoked without callId, skipping.");
    return false;
  }

  // Rule 14: Never allow multiple hangup handlers to terminate the same call
  if (terminatingCalls.has(callId)) {
    console.log(`[END_CALL_LOCKED] Call ${callId} is already terminating (reason: ${terminatingCalls.get(callId)?.reason}). Ignoring duplicate trigger.`);
    return false;
  }

  terminatingCalls.set(callId, { startedAt: Date.now(), reason });

  // Rule 12: Distinguish between PREMATURE_DISCONNECT and INTENTIONAL_CONVERSATION_END
  const isIntentional = [
    EndCallReason.USER_ENDED,
    EndCallReason.AGENT_ENDED,
    EndCallReason.CONVERSATION_COMPLETED,
    EndCallReason.INTENTIONAL_CONVERSATION_END,
  ].includes(reason);

  const classification: "PREMATURE_DISCONNECT" | "INTENTIONAL_CONVERSATION_END" = isIntentional
    ? "INTENTIONAL_CONVERSATION_END"
    : "PREMATURE_DISCONNECT";

  // Rule 11: Every intentional hangup must be logged
  const logEntry: TerminationLogEntry = {
    callId,
    reason,
    classification,
    timestamp: new Date().toISOString(),
    finalConversationState: finalConversationState || "ENDED",
  };
  terminationLogs.push(logEntry);

  console.log(
    `[CALL_TERMINATION_INITIATED] callId=${callId} reason=${reason} classification=${classification} audioWaitMs=${audioDurationMs} timestamp=${logEntry.timestamp}`
  );

  // Rule 15: Stop accepting new conversation turns and update store
  try {
    const existingCall = dataStore.getCall(callId);
    if (existingCall) {
      existingCall.status = isIntentional ? CallStatus.COMPLETED : CallStatus.FAILED;
      existingCall.stage = "ENDED";
      dataStore.updateCall(existingCall);
    }
  } catch (err) {
    console.warn(`[END_CALL] Could not update store for ${callId}:`, err);
  }

  // Update Neon database asynchronously
  import("../db/prisma").then(({ prisma }) => {
    prisma.call.update({
      where: { id: callId },
      data: {
        status: isIntentional ? CallStatus.COMPLETED : CallStatus.FAILED,
        endedAt: new Date(),
      },
    }).catch(() => {});
  }).catch(() => {});

  // Rule 8 & 9: After the final TTS audio finishes playing, wait for audio completion buffer + 600ms safety buffer
  // Do NOT terminate immediately after generating final TTS text.
  const waitTime = Math.max(audioDurationMs + 600, 300);

  setTimeout(async () => {
    try {
      console.log(`[CALL_TERMINATION_EXECUTING] Dropping line for ${callId} after ${waitTime}ms audio playback window.`);
      await disconnectFn();
    } catch (err: any) {
      console.error(`[CALL_TERMINATION_ERROR] Error in disconnectFn for ${callId}:`, err?.message || err);
    } finally {
      console.log(`[CALL_TERMINATED_CLEANLY] Call ${callId} terminated successfully. Reason: ${reason} (${classification})`);
    }
  }, waitTime);

  return true;
}

/**
 * Inactivity Tracker for telephone turns
 * Rule 13: Silence alone must NOT immediately end the call.
 * Flow:
 * 1. First silence -> wait
 * 2. Prolonged silence (12s) -> "హలో అండి, లైన్ లో ఉన్నారా?" / "Are you still there?"
 * 3. Only after repeated prolonged silence (another 12s) -> gracefully endCall(CONVERSATION_COMPLETED)
 */
export class InactivityManager {
  private callId: string;
  private silenceWarningCount = 0;
  private maxWarnings = 2;
  private promptUserCallback: (promptText: string) => Promise<void>;
  private terminateCallback: () => Promise<void>;
  private timer: NodeJS.Timeout | null = null;
  private warningTimeoutMs = 12000; // 12 seconds silence threshold
  private language: string;

  constructor(opts: {
    callId: string;
    language?: string;
    promptUserCallback: (promptText: string) => Promise<void>;
    terminateCallback: () => Promise<void>;
    silenceThresholdMs?: number;
  }) {
    this.callId = opts.callId;
    this.language = opts.language || "TELUGU_ENGLISH";
    this.promptUserCallback = opts.promptUserCallback;
    this.terminateCallback = opts.terminateCallback;
    if (opts.silenceThresholdMs) this.warningTimeoutMs = opts.silenceThresholdMs;
  }

  public recordSpeechActivity(): void {
    this.silenceWarningCount = 0;
    this.resetTimer();
  }

  public start(): void {
    this.resetTimer();
  }

  public stop(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private resetTimer(): void {
    if (this.timer) clearTimeout(this.timer);

    this.timer = setTimeout(async () => {
      this.silenceWarningCount++;
      if (this.silenceWarningCount < this.maxWarnings) {
        // Step 2: Prompt user to check if they are still on the line
        const prompt = this.language === "ENGLISH"
          ? "Hello, are you still there? I can help you with anything else."
          : "హలో అండి, లైన్ లో ఉన్నారా? నేను మీకు ఇంకేమైనా సహాయం చేయవచ్చా?";
        console.log(`[INACTIVITY] Silence warning ${this.silenceWarningCount}/${this.maxWarnings} for ${this.callId}. Checking with caller.`);
        await this.promptUserCallback(prompt);
        this.resetTimer();
      } else {
        // Step 3: Repeated prolonged silence -> end gracefully with short closing
        console.log(`[INACTIVITY] Repeated silence reached threshold for ${this.callId}. Gracefully concluding call.`);
        await this.terminateCallback();
      }
    }, this.warningTimeoutMs);
  }
}

export function getTerminationLogs(): TerminationLogEntry[] {
  return [...terminationLogs];
}
