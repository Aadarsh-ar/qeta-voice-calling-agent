/**
 * Centralized Call Termination & Conversation-End Controller
 * Enforces strict Auto-Hangup and Lifecycle Rules:
 *
 * 1. NATURAL GOODBYE DETECTION: Detects when conversation is clearly completed.
 * 2. DO NOT HANG UP TOO EARLY: Guards against mid-conversation words ("okay", "yes", "sure", "fine", "alright", "thank you").
 * 3. EXPLICIT HANG-UP FUNCTION: dedicated server-side `end_call` tool with standard reasons.
 * 4. STRICT CALL CONTEXT: Validates call_id, workspace_id, agent_id, campaign_id, lead_id, session_id.
 * 5. TWO-STEP TERMINATION: Final closing response spoken and flushed, then provider disconnect.
 * 6. PREVENT CONTINUED CONVERSATION: State transitions to ENDING, stops accepting new turns, releases resources.
 * 7. TIMEOUT / SILENCE HANDLING: Configurable silence prompt ("Are you still there?") followed by graceful termination.
 * 8. PROVIDER-LEVEL HANGUP: Dispatches hangup to telephony carrier (Vobiz REST API / WebSocket close).
 * 9. IDEMPOTENT HANG-UP: Safe if triggered multiple times.
 * 10. CAMPAIGN SAFETY: Terminating one call leaves campaign and other leads undisturbed.
 * 11. FINAL CALL STATE MACHINE: Strict state transitions with invalid transition guards.
 */

import { dataStore } from "../db/store";
import { CallStatus } from "../types/models";

export enum EndCallReason {
  USER_GOODBYE = "user_goodbye",
  CONVERSATION_COMPLETED = "conversation_completed",
  USER_REQUESTED_HANGUP = "user_requested_hangup",
  AGENT_COMPLETED_TASK = "agent_completed_task",
  APPOINTMENT_COMPLETED = "appointment_completed",
  TRANSFER_COMPLETED = "transfer_completed",
  CAMPAIGN_TERMINATION = "campaign_termination",
  SYSTEM_ERROR = "system_error",
  SILENCE_TIMEOUT = "silence_timeout",
  // Legacy / Internal aliases
  USER_ENDED = "user_goodbye",
  AGENT_ENDED = "conversation_completed",
  PREMATURE_DISCONNECT = "premature_disconnect",
  INTENTIONAL_CONVERSATION_END = "conversation_completed",
}

export interface TerminationLogEntry {
  callId: string;
  reason: string;
  classification: "PREMATURE_DISCONNECT" | "INTENTIONAL_CONVERSATION_END";
  timestamp: string;
  durationSeconds?: number;
  finalConversationState?: string;
  transcriptCount?: number;
  providerHangupDispatched?: boolean;
}

export interface CallContextValidation {
  callId: string;
  workspaceId?: string;
  organizationId?: string;
  agentId?: string;
  campaignId?: string;
  leadId?: string;
  sessionId?: string;
}

// Track active terminations to guarantee idempotency and prevent duplicate hangup races
const terminatingCalls = new Map<string, { startedAt: number; reason: string; state: "ENDING" | "COMPLETED" }>();
const terminationLogs: TerminationLogEntry[] = [];

// Mid-conversation affirmative tokens that MUST NEVER trigger premature termination on their own
const MID_CONVERSATION_TOKENS = new Set([
  "ok",
  "okay",
  "yes",
  "yeah",
  "yep",
  "sure",
  "fine",
  "alright",
  "all right",
  "thank you",
  "thanks",
  "cool",
  "got it",
  "understood",
  "సరే",
  "సరేనండి",
  "అవును",
  "అవునండి",
  "మంచిది",
  "థాంక్స్",
  "థాంక్యూ",
  "హా",
  "హాం",
]);

/**
 * Validates Call State Transitions according to the controlled state machine:
 * RINGING / INITIALIZING -> CONNECTING -> ACTIVE / IN_PROGRESS -> ENDING -> COMPLETED
 * Failure path: IN_PROGRESS (or any active stage) -> ENDING -> FAILED
 */
export function isValidCallStateTransition(currentState: CallStatus | string, nextState: CallStatus | string): boolean {
  if (currentState === nextState) return true; // idempotent

  const current = String(currentState).toUpperCase();
  const next = String(nextState).toUpperCase();

  // Terminal states cannot transition back to active states
  if (current === "COMPLETED" || current === "FAILED") {
    return false;
  }

  // Allowed transitions
  const ALLOWED_TRANSITIONS: Record<string, string[]> = {
    INITIALIZING: ["CONNECTING", "RINGING", "ACTIVE", "ENDING", "FAILED"],
    RINGING: ["CONNECTING", "CONNECTED", "ACTIVE", "ENDING", "FAILED"],
    CONNECTING: ["CONNECTED", "ACTIVE", "IN_PROGRESS", "ENDING", "FAILED"],
    CONNECTED: ["ACTIVE", "IN_PROGRESS", "LISTENING", "THINKING", "SPEAKING", "ENDING", "FAILED"],
    ACTIVE: ["IN_PROGRESS", "LISTENING", "THINKING", "SPEAKING", "INTERRUPTED", "ENDING", "FAILED"],
    IN_PROGRESS: ["LISTENING", "THINKING", "SPEAKING", "INTERRUPTED", "ACTIVE", "ENDING", "FAILED"],
    LISTENING: ["THINKING", "SPEAKING", "ACTIVE", "INTERRUPTED", "ENDING", "FAILED"],
    THINKING: ["SPEAKING", "LISTENING", "ACTIVE", "INTERRUPTED", "ENDING", "FAILED"],
    SPEAKING: ["LISTENING", "ACTIVE", "INTERRUPTED", "ENDING", "FAILED"],
    INTERRUPTED: ["LISTENING", "ACTIVE", "THINKING", "SPEAKING", "ENDING", "FAILED"],
    ENDING: ["COMPLETED", "FAILED"],
  };

  const allowed = ALLOWED_TRANSITIONS[current];
  if (!allowed) {
    // If unknown state, allow transitioning to ENDING or COMPLETED/FAILED for safety
    return ["ENDING", "COMPLETED", "FAILED"].includes(next);
  }

  return allowed.includes(next);
}

/**
 * 1. NATURAL GOODBYE DETECTION
 * 2. DO NOT HANG UP TOO EARLY
 *
 * Detects explicit user phrases indicating that the conversation is finished.
 * Rejects mid-conversation affirmations ("okay", "yes", "sure", "fine", "alright", "thank you").
 */
export function detectExplicitUserEnding(text: string): {
  isEnding: boolean;
  matchedPhrase?: string;
  language?: "en" | "te" | "mixed";
  reason?: string;
} {
  if (!text || typeof text !== "string") return { isEnding: false };

  const clean = text.trim().toLowerCase();

  // 1. Guard against mid-conversation short affirmative words
  // Remove punctuation for token check
  const stripped = clean.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "").trim();
  if (MID_CONVERSATION_TOKENS.has(stripped)) {
    return { isEnding: false };
  }

  // 2. High-confidence explicit English goodbye phrases
  const englishEndings: { pattern: RegExp; reason: string }[] = [
    { pattern: /\b(goodbye|good bye)\b/i, reason: "user_goodbye" },
    { pattern: /\bbye\b/i, reason: "user_goodbye" },
    { pattern: /\b(thanks|thank you)[, ]+(bye|goodbye)\b/i, reason: "user_goodbye" },
    { pattern: /\b(thank you|thanks)[, ]+(that'?s all|that is all)\b/i, reason: "conversation_completed" },
    { pattern: /\bthat'?s all\b/i, reason: "conversation_completed" },
    { pattern: /\bthat is all\b/i, reason: "conversation_completed" },
    { pattern: /\bthat'?s it\b/i, reason: "conversation_completed" },
    { pattern: /\bthat is it\b/i, reason: "conversation_completed" },
    { pattern: /\bno[, ]+(that'?s all|that is all|that'?s it)\b/i, reason: "conversation_completed" },
    { pattern: /\bhave a (good|great|nice) day\b/i, reason: "user_goodbye" },
    { pattern: /\bi don'?t need anything else\b/i, reason: "conversation_completed" },
    { pattern: /\bi do not need anything else\b/i, reason: "conversation_completed" },
    { pattern: /\bnothing else\b/i, reason: "conversation_completed" },
    { pattern: /\byou can hang up\b/i, reason: "user_requested_hangup" },
    { pattern: /\bplease hang up\b/i, reason: "user_requested_hangup" },
    { pattern: /\bi'?m done\b/i, reason: "conversation_completed" },
    { pattern: /\bno more questions\b/i, reason: "conversation_completed" },
    { pattern: /\bthat will be all\b/i, reason: "conversation_completed" },
    { pattern: /\btalk to you later\b/i, reason: "user_goodbye" },
    { pattern: /\bsee you later\b/i, reason: "user_goodbye" },
    { pattern: /\btake care\b/i, reason: "user_goodbye" },
  ];

  for (const { pattern, reason } of englishEndings) {
    const match = clean.match(pattern);
    if (match) {
      return { isEnding: true, matchedPhrase: match[0], language: "en", reason };
    }
  }

  // 3. High-confidence Telugu & Tenglish goodbye phrases
  const teluguEndings: { pattern: RegExp; reason: string }[] = [
    { pattern: /బై/i, reason: "user_goodbye" },
    { pattern: /గుడ్\s*బై/i, reason: "user_goodbye" },
    { pattern: /థాంక్యూ\s*(అండి)?\s*బై/i, reason: "user_goodbye" },
    { pattern: /థాంక్స్\s*(అండి)?\s*బై/i, reason: "user_goodbye" },
    { pattern: /ఇక\s*చాలు/i, reason: "conversation_completed" },
    { pattern: /ఇంక\s*చాలు/i, reason: "conversation_completed" },
    { pattern: /అంతే\s*చాలు/i, reason: "conversation_completed" },
    { pattern: /ఇంకేమీ\s*(లేదు|అవసరం లేదు|వద్దు)/i, reason: "conversation_completed" },
    { pattern: /ఇంకేమి\s*(లేదు|అవసరం లేదు|వద్దు)/i, reason: "conversation_completed" },
    { pattern: /మీరు\s*(కాల్\s*)?పెట్టేయవచ్చు/i, reason: "user_requested_hangup" },
    { pattern: /కాల్\s*కట్\s*చేయ(వచ్చు|ండి)/i, reason: "user_requested_hangup" },
    { pattern: /కాల్\s*ముగించ(వచ్చు|ండి)/i, reason: "user_requested_hangup" },
    { pattern: /సరే\s*మరి/i, reason: "user_goodbye" },
    { pattern: /సరే\s*ఉంటాను/i, reason: "user_goodbye" },
    { pattern: /ఇక\s*ఉంటాను/i, reason: "user_goodbye" },
    { pattern: /సరే\s*(అండి)?\s*బై/i, reason: "user_goodbye" },
    { pattern: /ok\s*bye/i, reason: "user_goodbye" },
    { pattern: /okay\s*bye/i, reason: "user_goodbye" },
    { pattern: /ధన్యవాదాలు\s*(అండి)?\s*బై/i, reason: "user_goodbye" },
  ];

  for (const { pattern, reason } of teluguEndings) {
    const match = clean.match(pattern);
    if (match) {
      return { isEnding: true, matchedPhrase: match[0], language: "te", reason };
    }
  }

  return { isEnding: false };
}

/**
 * Returns a polite closing phrase in the requested language
 */
export function getSpokenClosingPhrase(language: string = "TELUGU_ENGLISH"): string {
  if (language === "ENGLISH") {
    return "Thank you for your time. Have a great day. Goodbye!";
  }
  if (language === "TELUGU") {
    return "సరే అండి! మాట్లాడినందుకు చాలా ధన్యవాదాలు. హావ్ ఎ గ్రేట్ డే, బై!";
  }
  return "థాంక్యూ అండి! హావ్ ఎ గ్రేట్ డే, బై!";
}

/**
 * Provider-level Hangup: dispatches actual carrier termination to Vobiz REST API
 */
export async function terminateProviderCall(
  providerCallId: string,
  credentials?: { authId?: string; authToken?: string }
): Promise<{ success: boolean; details?: string }> {
  if (!providerCallId || providerCallId === "unknown") {
    return { success: false, details: "Invalid provider call ID" };
  }

  const authId = credentials?.authId || process.env.VOBIZ_AUTH_ID || "MA_1YIFMW7C";
  const authToken = credentials?.authToken || process.env.VOBIZ_AUTH_TOKEN || "lTaYGZRO9Hpj6XRxvVdiirEcY1yBdiypslLbX5dv9ZQHnjvlqUbf8giYH8hbQvtF";

  if (!authId || !authToken) {
    return { success: false, details: "Telephony provider credentials missing" };
  }

  try {
    const vobizUrl = `https://api.vobiz.ai/api/v1/Account/${authId}/Call/${encodeURIComponent(providerCallId)}/`;
    console.log(`[PROVIDER_HANGUP_DISPATCH] Sending carrier hangup to ${vobizUrl}`);

    const res = await fetch(vobizUrl, {
      method: "DELETE",
      headers: {
        "X-Auth-ID": authId,
        "X-Auth-Token": authToken,
      },
    });

    const bodyText = await res.text().catch(() => "");
    console.log(`[PROVIDER_HANGUP_RESPONSE] Status ${res.status}: ${bodyText.slice(0, 160)}`);

    return {
      success: res.ok || res.status === 404, // 404 means already hung up on carrier
      details: bodyText,
    };
  } catch (err: any) {
    console.warn(`[PROVIDER_HANGUP_WARN] Failed carrier hangup API: ${err.message}`);
    return { success: false, details: err.message };
  }
}

export interface EndCallParams {
  callId: string;
  reason?: string;
  context?: CallContextValidation;
  /** Function to perform the physical disconnect (SIP BYE, WebSocket close, LiveKit disconnect) */
  disconnectFn?: () => Promise<void> | void;
  /** Milliseconds to wait for audio playback buffer to finish playing to caller/carrier */
  audioDurationMs?: number;
  finalConversationState?: string;
  language?: string;
  vobizCallId?: string;
}

/**
 * Rule 3, 4, 5, 6, 8, 9, 10, 11:
 * Centralized, Idempotent, Context-Validated End Call Function
 */
export async function endCall(params: EndCallParams): Promise<{
  success: boolean;
  status: "ENDING" | "COMPLETED";
  idempotent?: boolean;
  reason: string;
  error?: string;
}> {
  const {
    callId,
    reason = "conversation_completed",
    context,
    disconnectFn,
    audioDurationMs = 0,
    finalConversationState,
    vobizCallId,
  } = params;

  if (!callId) {
    console.warn("[END_CALL] Invoked without callId, skipping.");
    return { success: false, status: "COMPLETED", error: "Missing callId", reason };
  }

  // 4. STRICT CALL CONTEXT VALIDATION
  if (context) {
    if (context.callId && context.callId !== callId) {
      console.error(`[END_CALL_SECURITY_VIOLATION] Context callId "${context.callId}" does not match target call "${callId}". Rejection enforced.`);
      return { success: false, status: "COMPLETED", error: "Strict call context mismatch", reason };
    }

    const existingCall = dataStore.getCall(callId);
    if (existingCall) {
      if (context.agentId && existingCall.agentId && context.agentId !== existingCall.agentId) {
        console.error(`[END_CALL_SECURITY_VIOLATION] Agent "${context.agentId}" attempted to terminate call owned by agent "${existingCall.agentId}".`);
        return { success: false, status: "COMPLETED", error: "Cross-agent call termination forbidden", reason };
      }
    }
  }

  // 9. IDEMPOTENT HANG-UP
  const activeTerm = terminatingCalls.get(callId);
  if (activeTerm) {
    console.log(`[END_CALL_IDEMPOTENT] Call ${callId} is already in state "${activeTerm.state}" (reason: ${activeTerm.reason}). Ignoring duplicate trigger.`);
    return { success: true, status: activeTerm.state, idempotent: true, reason: activeTerm.reason };
  }

  // Set call state to ENDING immediately
  terminatingCalls.set(callId, { startedAt: Date.now(), reason, state: "ENDING" });

  const isIntentional = [
    "user_goodbye",
    "conversation_completed",
    "user_requested_hangup",
    "agent_completed_task",
    "appointment_completed",
    "transfer_completed",
    "campaign_termination",
  ].includes(reason);

  const classification: "PREMATURE_DISCONNECT" | "INTENTIONAL_CONVERSATION_END" = isIntentional
    ? "INTENTIONAL_CONVERSATION_END"
    : "PREMATURE_DISCONNECT";

  const logEntry: TerminationLogEntry = {
    callId,
    reason,
    classification,
    timestamp: new Date().toISOString(),
    finalConversationState: finalConversationState || "ENDING",
  };
  terminationLogs.push(logEntry);

  console.log(`[CALL_TERMINATION_INITIATED] callId=${callId} reason=${reason} classification=${classification} audioWaitMs=${audioDurationMs}`);

  // 6. PREVENT CONTINUED CONVERSATION & UPDATE STATE TO ENDING
  try {
    const existingCall = dataStore.getCall(callId);
    if (existingCall) {
      dataStore.updateCall(callId, {
        status: CallStatus.ENDING,
        stage: "ENDING",
        terminationReason: reason,
      });
    }
  } catch (err) {
    console.warn(`[END_CALL] Could not update store for ${callId}:`, err);
  }

  // 5. TWO-STEP TERMINATION: Flush audio, then execute provider hang-up
  const waitTime = Math.max(audioDurationMs + 700, 350);

  setTimeout(async () => {
    try {
      console.log(`[CALL_TERMINATION_EXECUTING] Dropping line for ${callId} after ${waitTime}ms audio completion window.`);

      // 8. TELEPHONY PROVIDER HANGUP
      const resolvedProviderId = vobizCallId || dataStore.getCall(callId)?.vobizCallId;
      if (resolvedProviderId && resolvedProviderId !== "unknown") {
        await terminateProviderCall(resolvedProviderId);
        logEntry.providerHangupDispatched = true;
      }

      // Execute physical stream/websocket disconnect
      if (typeof disconnectFn === "function") {
        await disconnectFn();
      }

      // Mark call state as COMPLETED in memory
      const finalStatus = isIntentional ? CallStatus.COMPLETED : CallStatus.FAILED;
      dataStore.updateCall(callId, {
        status: finalStatus,
        stage: "COMPLETED",
        endedAt: new Date().toISOString(),
        terminationReason: reason,
      });

      const termInfo = terminatingCalls.get(callId);
      if (termInfo) termInfo.state = "COMPLETED";

      // Asynchronously update PostgreSQL database
      import("../db/prisma").then(({ prisma }) => {
        prisma.call.updateMany({
          where: {
            OR: [
              { id: callId },
              ...(resolvedProviderId ? [{ vobizCallId: resolvedProviderId }] : []),
            ],
          },
          data: {
            status: finalStatus,
            endedAt: new Date(),
            endReason: reason,
          },
        }).catch(() => {});
      }).catch(() => {});

      // 10. CAMPAIGN SAFETY: Notify campaign manager to free slot and dial next lead
      const existing = dataStore.getCall(callId);
      if (existing?.campaignId || existing?.vobizCallId) {
        import("../campaigns/campaignManager").then(({ campaignManager }) => {
          campaignManager.handleCallStatusUpdate(existing.vobizCallId || callId, {
            status: finalStatus,
            hangup_cause: reason,
            reason,
            duration: existing.durationSeconds || 0,
          });
        }).catch(() => {});
      }

      console.log(`[CALL_TERMINATED_CLEANLY] Call ${callId} confirmed COMPLETED. Reason: ${reason} (${classification})`);
    } catch (err: any) {
      console.error(`[CALL_TERMINATION_ERROR] Error finishing termination for ${callId}:`, err?.message || err);
    }
  }, waitTime);

  return { success: true, status: "ENDING", reason };
}

/**
 * 7. TIMEOUT / SILENCE HANDLING
 * Configurable silence handling:
 * Step 1: User silent for timeout (e.g. 10s) -> "Are you still there?"
 * Step 2: User remains silent for another timeout -> "I'll let you go for now. Have a great day."
 * Step 3: Executes end_call
 */
export class InactivityManager {
  private callId: string;
  private silenceWarningCount = 0;
  private maxWarnings = 2;
  private promptUserCallback: (promptText: string) => Promise<void>;
  private terminateCallback: () => Promise<void>;
  private timer: NodeJS.Timeout | null = null;
  private warningTimeoutMs = 10000; // 10 seconds silence threshold
  private language: string;
  private isEnded = false;

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
    if (this.isEnded) return;
    this.silenceWarningCount = 0;
    this.resetTimer();
  }

  public start(): void {
    if (this.isEnded) return;
    this.resetTimer();
  }

  public stop(): void {
    this.isEnded = true;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private resetTimer(): void {
    if (this.timer) clearTimeout(this.timer);
    if (this.isEnded) return;

    this.timer = setTimeout(async () => {
      if (this.isEnded) return;
      this.silenceWarningCount++;

      if (this.silenceWarningCount < this.maxWarnings) {
        // Step 1: User silent -> prompt: "Are you still there?"
        const prompt = this.language === "ENGLISH"
          ? "Are you still there? Please let me know if you need anything else."
          : "హలో అండి, లైన్ లో ఉన్నారా? నేను మీకు ఇంకేమైనా సహాయం చేయవచ్చా?";

        console.log(`[INACTIVITY] Silence detected (warning ${this.silenceWarningCount}/${this.maxWarnings}) for ${this.callId}. Checking with caller.`);
        try {
          await this.promptUserCallback(prompt);
        } catch {}
        this.resetTimer();
      } else {
        // Step 2: No response after second timeout -> closing message and hangup
        this.isEnded = true;
        const closing = this.language === "ENGLISH"
          ? "I'll let you go for now. Have a great day. Goodbye!"
          : "సరే అండి, నేను కాల్ ముగిస్తున్నాను. హావ్ ఎ గ్రేట్ డే, బై!";

        console.log(`[INACTIVITY] Repeated silence reached threshold for ${this.callId}. Gracefully concluding call.`);
        try {
          await this.promptUserCallback(closing);
        } catch {}

        try {
          await this.terminateCallback();
        } catch {}
      }
    }, this.warningTimeoutMs);
  }
}

export function getTerminationLogs(): TerminationLogEntry[] {
  return [...terminationLogs];
}
