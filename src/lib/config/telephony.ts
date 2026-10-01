/**
 * Telephony & Voice Pipeline Central Configuration
 * Provides reliable, 24/7 accessible configuration with active production fallbacks
 * so that missing environment variables in production never block call dispatch or testing.
 */

import fs from "fs";
import path from "path";

// Active, verified production credentials (Vobiz Telecom + Cartesia + Sarvam + Groq)
export const DEFAULT_TELEPHONY_CONFIG = {
  vobizAuthId: process.env.VOBIZ_AUTH_ID || "",
  vobizAuthToken: process.env.VOBIZ_AUTH_TOKEN || "",
  vobizPhoneNumber: process.env.VOBIZ_PHONE_NUMBER || "+918071582667",
  vobizTrunkId: process.env.VOBIZ_TRUNK_ID || "",
  vobizSipDomain: process.env.VOBIZ_SIP_DOMAIN || "f15a55c4.sip.vobiz.ai",
  vobizSipUsername: process.env.VOBIZ_SIP_USERNAME || "",
  vobizSipPassword: process.env.VOBIZ_SIP_PASSWORD || "",
  cartesiaApiKey: process.env.CARTESIA_API_KEY || "",
  cartesiaAgentId: process.env.CARTESIA_AGENT_ID || "",
  cartesiaVoiceId: process.env.CARTESIA_VOICE_ID || "41508a7d-4839-445f-ba7f-687f620ed0e7",
  cartesiaVoiceHarikaId: process.env.CARTESIA_VOICE_HARIKA_ID || "41508a7d-4839-445f-ba7f-687f620ed0e7",
  sarvamApiKey: process.env.SARVAM_API_KEY || "",
  sarvamLanguageCode: process.env.SARVAM_LANGUAGE_CODE || "te-IN",
  sarvamModel: process.env.SARVAM_MODEL || "saaras:v3-realtime",
  groqApiKey: process.env.GROQ_API_KEY || "",
  groqModel: process.env.GROQ_MODEL || "qwen/qwen3.8-27b",
  defaultPublicBaseUrl: process.env.PUBLIC_BASE_URL || "https://qeta.in",
};

/**
 * Reads an env key from process.env, .env.local, .env, or hardcoded fallback
 */
export function getEnvVar(key: string, fallback = ""): string {
  // 1. Process environment (Docker, Vercel, Node runtime)
  if (process.env[key] && process.env[key]!.trim().length > 0) {
    const raw = process.env[key]!.replace(/^["']|["']$/g, "").trim();
    if (raw.length > 0) return raw;
  }

  // 2. Disk scan for .env.local or .env (if accessible in server runtime)
  try {
    const cwd = process.cwd();
    for (const file of [".env.local", ".env"]) {
      const p = path.join(/*turbopackIgnore: true*/ cwd, file);
      if (fs.existsSync(p)) {
        const content = fs.readFileSync(p, "utf-8");
        const regex = new RegExp(`^${key}=([^\\r\\n]+)`, "m");
        const match = content.match(regex);
        if (match && match[1]) {
          const val = match[1].replace(/["']/g, "").trim();
          if (val) {
            process.env[key] = val;
            return val;
          }
        }
      }
    }
  } catch {
    // Ignore filesystem restrictions in serverless edge environments
  }

  return fallback;
}

/**
 * Returns fully resolved telephony credentials with guaranteed 24/7 fallbacks
 */
export function getTelephonyConfig() {
  const vobizAuthId = getEnvVar("VOBIZ_AUTH_ID", DEFAULT_TELEPHONY_CONFIG.vobizAuthId);
  const vobizAuthToken = getEnvVar("VOBIZ_AUTH_TOKEN", DEFAULT_TELEPHONY_CONFIG.vobizAuthToken);
  const vobizPhoneNumber = getEnvVar("VOBIZ_PHONE_NUMBER", DEFAULT_TELEPHONY_CONFIG.vobizPhoneNumber);
  const vobizTrunkId = getEnvVar("VOBIZ_TRUNK_ID", DEFAULT_TELEPHONY_CONFIG.vobizTrunkId);
  const vobizSipDomain = getEnvVar("VOBIZ_SIP_DOMAIN", DEFAULT_TELEPHONY_CONFIG.vobizSipDomain);
  const vobizSipUsername = getEnvVar("VOBIZ_SIP_USERNAME", DEFAULT_TELEPHONY_CONFIG.vobizSipUsername);
  const vobizSipPassword = getEnvVar("VOBIZ_SIP_PASSWORD", DEFAULT_TELEPHONY_CONFIG.vobizSipPassword);

  let cartesiaApiKey = getEnvVar("CARTESIA_API_KEY", DEFAULT_TELEPHONY_CONFIG.cartesiaApiKey);
  if (cartesiaApiKey.startsWith("sk_car_kjQ") || cartesiaApiKey.length < 20) {
    cartesiaApiKey = DEFAULT_TELEPHONY_CONFIG.cartesiaApiKey;
  }

  let cartesiaAgentId = getEnvVar("CARTESIA_AGENT_ID", DEFAULT_TELEPHONY_CONFIG.cartesiaAgentId);
  if (cartesiaAgentId === "agent_GaiYMgB9Bj9kaKW1tUgqSQ" || !cartesiaAgentId.startsWith("agent_")) {
    cartesiaAgentId = DEFAULT_TELEPHONY_CONFIG.cartesiaAgentId;
  }

  const cartesiaVoiceId = getEnvVar("CARTESIA_VOICE_ID", DEFAULT_TELEPHONY_CONFIG.cartesiaVoiceId);

  const sarvamApiKey = getEnvVar("SARVAM_API_KEY", DEFAULT_TELEPHONY_CONFIG.sarvamApiKey);
  const groqApiKey = getEnvVar("GROQ_API_KEY", DEFAULT_TELEPHONY_CONFIG.groqApiKey);

  return {
    vobizAuthId,
    vobizAuthToken,
    vobizPhoneNumber,
    vobizTrunkId,
    vobizSipDomain,
    vobizSipUsername,
    vobizSipPassword,
    cartesiaApiKey,
    cartesiaAgentId,
    cartesiaVoiceId,
    sarvamApiKey,
    groqApiKey,
  };
}

/**
 * Resolves the public webhook base URL for carrier webhooks
 * Dynamically resolves from incoming request headers, environment variables, or standard domain
 */
export function resolveWebhookBaseUrl(req?: Request): string {
  // 1. Check explicit environment overrides
  const envUrl =
    getEnvVar("PUBLIC_BASE_URL") ||
    getEnvVar("VOBIZ_WEBHOOK_URL") ||
    getEnvVar("NEXT_PUBLIC_SERVER_URL");

  if (envUrl && envUrl.startsWith("http") && !envUrl.includes("localhost")) {
    return envUrl.replace(/\/+$/, "");
  }

  // 2. Resolve from incoming request host (works in cloud/serverless/custom domains)
  if (req) {
    const host =
      req.headers.get("x-forwarded-host") ||
      req.headers.get("host") ||
      "";
    const proto =
      req.headers.get("x-forwarded-proto") ||
      (host.includes("localhost") ? "http" : "https");

    if (host) {
      return `${proto}://${host}`.replace(/\/+$/, "");
    }
  }

  // 3. Check Vercel URL
  const vercelUrl = process.env.VERCEL_URL;
  if (vercelUrl) {
    return `https://${vercelUrl}`.replace(/\/+$/, "");
  }

  // 4. Default fallback if localhost is acceptable or default production domain
  if (envUrl && envUrl.startsWith("http")) {
    return envUrl.replace(/\/+$/, "");
  }

  return DEFAULT_TELEPHONY_CONFIG.defaultPublicBaseUrl;
}
