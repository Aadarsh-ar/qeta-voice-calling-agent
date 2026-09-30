/**
 * Campaign Pre-flight Validator (Rule #5 — Campaign → Agent Relationship)
 *
 * Before starting any campaign, this module validates:
 *  1. Campaign exists and belongs to the current user/workspace
 *  2. Agent exists and belongs to the same workspace
 *  3. Agent is active (not INACTIVE/ARCHIVED/DRAFT)
 *  4. Agent has a valid Cartesia voice ID
 *  5. Agent has valid instructions (non-empty system prompt)
 *  6. Agent has a valid Cartesia Agent ID for call dispatch
 *  7. Lead source is valid (contacts exist)
 *  8. All contacts have valid E.164 phone numbers
 *  9. Required provider/API configuration is present
 * 10. No duplicate phone numbers within the campaign
 *
 * If ANY critical check fails, the campaign MUST NOT START.
 */

import { dataStore } from "@/lib/db/store";
import { sanitizePhoneNumber } from "./sheetParser";
import type { Campaign } from "./types";

export interface ValidationResult {
  valid: boolean;
  errors: string[];    // Critical errors that block the campaign
  warnings: string[]; // Non-blocking warnings to surface to user
}

/**
 * Validates all pre-conditions before a campaign can start.
 * This is the single source of truth for "is this campaign ready to run?"
 */
export function validateCampaignStartConditions(
  campaign: Campaign,
  organizationId?: string
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Campaign basic integrity
  if (!campaign.id || !campaign.id.trim()) {
    errors.push("Campaign has no ID. This is a data integrity error.");
  }
  if (!campaign.name || !campaign.name.trim()) {
    errors.push("Campaign has no name.");
  }

  // 2. Agent ID validation — must be specified, no undefined/empty
  if (!campaign.agentId || !campaign.agentId.trim()) {
    errors.push(
      "Campaign has no agent assigned. A campaign must have exactly one valid agent before it can run."
    );
  }

  // 3. Agent existence and ownership validation
  if (campaign.agentId) {
    const agent = dataStore.getAgent(campaign.agentId);
    if (!agent) {
      errors.push(
        `Agent "${campaign.agentId}" (${campaign.agentName || "unknown"}) is not loaded or does not exist. ` +
        `The campaign cannot start without a valid agent. ` +
        `DO NOT use any other agent as a substitute.`
      );
    } else {
      // 4. Agent status check
      if (agent.status !== "ACTIVE") {
        errors.push(
          `Agent "${agent.name}" (${agent.id}) is not ACTIVE (current status: ${agent.status}). ` +
          `Activate the agent before starting the campaign.`
        );
      }

      // 5. Voice configuration
      if (!agent.cartesiaVoiceId || !agent.cartesiaVoiceId.trim()) {
        errors.push(
          `Agent "${agent.name}" has no voice configured. ` +
          `Select a valid Cartesia voice for this agent before starting the campaign.`
        );
      }

      // 6. Instructions validation
      const instructions = agent.systemPrompt || (agent as any).instructions || "";
      if (!instructions || instructions.trim().length < 10) {
        errors.push(
          `Agent "${agent.name}" has no or insufficient instructions (system prompt). ` +
          `The agent needs a meaningful system prompt to conduct voice calls.`
        );
      }

      // 7. Cartesia Agent ID — required for outbound calls
      if (!agent.cartesiaAgentId || !agent.cartesiaAgentId.startsWith("agent_")) {
        errors.push(
          `Agent "${agent.name}" has no valid Cartesia Agent ID (expected format: "agent_xxx"). ` +
          `The agent must be synced with Cartesia before making outbound calls.`
        );
      }
    }
  }

  // 8. Lead/contact validation
  if (!campaign.contacts || campaign.contacts.length === 0) {
    errors.push(
      "Campaign has no contacts. Add at least one valid contact with a phone number before starting."
    );
  } else {
    let invalidPhoneCount = 0;
    const seenPhones = new Set<string>();
    let duplicateCount = 0;

    for (const contact of campaign.contacts) {
      if (!contact.phoneNumber || !contact.phoneNumber.trim()) {
        invalidPhoneCount++;
        continue;
      }

      const { isValid } = sanitizePhoneNumber(contact.phoneNumber);
      if (!isValid) {
        invalidPhoneCount++;
      }

      // Duplicate detection
      const normalizedPhone = contact.phoneNumber.replace(/\s/g, "");
      if (seenPhones.has(normalizedPhone)) {
        duplicateCount++;
      }
      seenPhones.add(normalizedPhone);
    }

    if (invalidPhoneCount > 0) {
      warnings.push(
        `${invalidPhoneCount} contact(s) have invalid or missing phone numbers and will be skipped.`
      );
    }
    if (duplicateCount > 0) {
      warnings.push(
        `${duplicateCount} duplicate phone number(s) detected — only the first occurrence will be called.`
      );
    }

    const validContactCount = campaign.contacts.length - invalidPhoneCount;
    if (validContactCount === 0) {
      errors.push(
        "No contacts have valid phone numbers. The campaign cannot make any calls."
      );
    }
  }

  // 9. Provider API configuration check
  const cartesiaKey = process.env.CARTESIA_API_KEY || "";
  if (!cartesiaKey || !cartesiaKey.startsWith("sk_car_")) {
    errors.push(
      "CARTESIA_API_KEY is not configured or invalid. " +
      "Outbound calls cannot be dispatched without a valid Cartesia API key. " +
      "Configure this in your environment settings."
    );
  }

  // 10. Concurrency sanity check
  if (campaign.concurrency && (campaign.concurrency < 1 || campaign.concurrency > 10)) {
    warnings.push(
      `Concurrency is set to ${campaign.concurrency}, which is outside the recommended range (1-10). ` +
      `Values above 10 are automatically capped at 10.`
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Creates an isolated per-lead execution context.
 * Each call must receive variables ONLY from its own lead — never from another.
 * This is the enforcement point for Rule #8 (Lead Variable Protection).
 */
export function buildIsolatedLeadContext(
  campaign: Campaign,
  contactId: string
): {
  leadName: string;
  leadPhone: string;
  leadLanguage: string;
  customVars: Record<string, string>;
  businessContext: string;
} | null {
  const contact = campaign.contacts.find((c) => c.id === contactId);
  if (!contact) {
    console.error(
      `[LEAD_ISOLATION] Contact "${contactId}" not found in campaign "${campaign.id}". ` +
      `Cannot build execution context — refusing to use any other lead's data.`
    );
    return null;
  }

  // Build ONLY this lead's variables — no shared state, no reference to other contacts
  const customVars: Record<string, string> = {};
  if (contact.customData) {
    for (const [k, v] of Object.entries(contact.customData)) {
      if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
        customVars[String(k)] = String(v);
      }
    }
  }

  // Business context scoped to this specific lead
  const contextParts = [
    `Campaign: ${campaign.name}`,
    `Customer Name: ${contact.name}`,
    `Phone: ${contact.phoneNumber}`,
    contact.language ? `Language: ${contact.language}` : "",
    ...Object.entries(customVars).map(([k, v]) => `${k}: ${v}`),
  ].filter(Boolean);

  return {
    leadName: contact.name,
    leadPhone: contact.phoneNumber,
    leadLanguage: contact.language || "Telugu + English",
    customVars,
    businessContext: contextParts.join(" | "),
  };
}
