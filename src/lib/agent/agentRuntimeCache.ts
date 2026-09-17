/**
 * Ultra Low-Latency Agent Runtime Cache
 *
 * Implements Section 4 & Section 5:
 * - Runtime Agent Selection: Every call must use the EXACT selected agent.
 * - Low-Latency Data Loading: Loads ONLY essential identity & runtime configuration at call start.
 * - Does NOT load the entire knowledge base.
 * - Does NOT load unnecessary customer data.
 * - Cached in-memory with sub-millisecond lookup (<1ms).
 * - Avoids SELECT * by querying only required columns.
 */

import { prisma } from "@/lib/db/prisma";

export interface EssentialAgentRuntimeConfig {
  id: string;
  organizationId: string;
  name: string;
  instructions: string;
  businessName: string;
  cartesiaAgentId: string;
  cartesiaVoiceId: string;
  language: string;
  enabledTools: Array<{ name: string; description: string }>;
  phoneNumber?: string;
  updatedAt: string;
}

class AgentRuntimeCache {
  private cache = new Map<string, { config: EssentialAgentRuntimeConfig; cachedAt: number }>();
  private phoneToAgentMap = new Map<string, string>();
  private readonly TTL_MS = 10 * 60 * 1000; // 10 minutes cache validity

  /**
   * Look up exact agent by ID with sub-millisecond cache
   */
  async getExactAgent(agentId: string): Promise<EssentialAgentRuntimeConfig | null> {
    if (!agentId || agentId.trim().length === 0) {
      return null;
    }

    const cleanId = agentId.trim();
    const hit = this.cache.get(cleanId);
    if (hit && Date.now() - hit.cachedAt < this.TTL_MS) {
      return hit.config;
    }

    // Cache miss: load ONLY essential columns from PostgreSQL
    try {
      const dbAgent = await prisma.agent.findUnique({
        where: { id: cleanId },
        select: {
          id: true,
          organizationId: true,
          name: true,
          instructions: true,
          systemPrompt: true,
          cartesiaAgentId: true,
          cartesiaVoiceId: true,
          language: true,
          status: true,
          updatedAt: true,
          phoneNumber: {
            select: { e164Number: true },
          },
          business: {
            select: { name: true },
          },
          tools: {
            where: { isEnabled: true, enabled: true },
            select: { name: true, description: true },
          },
        },
      });

      if (!dbAgent) {
        return null;
      }

      // Format essential runtime configuration
      const config: EssentialAgentRuntimeConfig = {
        id: dbAgent.id,
        organizationId: dbAgent.organizationId,
        name: dbAgent.name,
        instructions: dbAgent.instructions || dbAgent.systemPrompt || "",
        businessName: dbAgent.business?.name || "QETADOTIN",
        cartesiaAgentId: dbAgent.cartesiaAgentId || (dbAgent.id.startsWith("agent_") ? dbAgent.id : ""),
        cartesiaVoiceId: dbAgent.cartesiaVoiceId || "ff480e6e-3e79-4307-9889-d1d9feb8e20e",
        language: dbAgent.language || "TELUGU_ENGLISH",
        enabledTools: dbAgent.tools.map((t) => ({ name: t.name, description: t.description })),
        phoneNumber: dbAgent.phoneNumber?.e164Number,
        updatedAt: dbAgent.updatedAt.toISOString(),
      };

      this.cache.set(cleanId, { config, cachedAt: Date.now() });
      if (config.phoneNumber) {
        this.phoneToAgentMap.set(config.phoneNumber.replace(/[\s\-\(\)]/g, ""), cleanId);
      }

      return config;
    } catch (err) {
      console.error(`[RUNTIME_CACHE_ERROR] Failed to load agent ${cleanId}:`, err);
      return null;
    }
  }

  /**
   * Look up exact agent assigned to an incoming phone number
   */
  async getAgentByPhoneNumber(e164Number: string): Promise<EssentialAgentRuntimeConfig | null> {
    if (!e164Number) return null;
    const cleanPhone = e164Number.replace(/[\s\-\(\)]/g, "");

    const mappedAgentId = this.phoneToAgentMap.get(cleanPhone);
    if (mappedAgentId) {
      const cached = await this.getExactAgent(mappedAgentId);
      if (cached) return cached;
    }

    try {
      const phoneRecord = await prisma.phoneNumber.findFirst({
        where: { e164Number: cleanPhone },
        select: {
          assignedAgent: {
            select: { id: true },
          },
        },
      });

      if (phoneRecord?.assignedAgent?.id) {
        this.phoneToAgentMap.set(cleanPhone, phoneRecord.assignedAgent.id);
        return this.getExactAgent(phoneRecord.assignedAgent.id);
      }
      return null;
    } catch (err) {
      console.error(`[RUNTIME_CACHE_ERROR] Phone lookup failed for ${cleanPhone}:`, err);
      return null;
    }
  }

  /**
   * Invalidate and optionally rewarm an agent in the runtime cache
   */
  invalidate(agentId: string, warmConfig?: EssentialAgentRuntimeConfig): void {
    if (!agentId) return;
    this.cache.delete(agentId);
    if (warmConfig) {
      this.cache.set(agentId, { config: warmConfig, cachedAt: Date.now() });
      if (warmConfig.phoneNumber) {
        this.phoneToAgentMap.set(warmConfig.phoneNumber.replace(/[\s\-\(\)]/g, ""), agentId);
      }
    }
  }

  /**
   * Clear entire cache
   */
  clear(): void {
    this.cache.clear();
    this.phoneToAgentMap.clear();
  }
}

export const agentRuntimeCache = new AgentRuntimeCache();
