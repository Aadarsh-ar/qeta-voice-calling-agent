/**
 * Feature Flag Service
 *
 * Controls rollout of the new pipeline behind a feature flag.
 * Supports per-tenant flags and global flags (organizationId = null).
 *
 * Usage:
 *   const useNew = await isFeatureEnabled("use_new_pipeline", orgId);
 */

import { prisma } from "@/lib/db/prisma";

// In-memory cache for feature flags (avoids DB hit on every call)
const flagCache = new Map<string, { enabled: boolean; cachedAt: number }>();
const FLAG_CACHE_TTL_MS = 60_000; // 1 minute
const GLOBAL_ORG_ID = "__GLOBAL__";

/**
 * Check if a feature flag is enabled.
 * Priority: per-tenant flag > global flag > env var > default false.
 */
export async function isFeatureEnabled(
  flagName: string,
  organizationId?: string | null
): Promise<boolean> {
  // 1. Check environment variable override first (highest priority, instant)
  const envKey = `FEATURE_${flagName.toUpperCase()}`;
  const envVal = process.env[envKey];
  if (envVal !== undefined) {
    return envVal === "true" || envVal === "1";
  }

  // 2. Check cache
  const cacheKey = `${organizationId || GLOBAL_ORG_ID}:${flagName}`;
  const cached = flagCache.get(cacheKey);
  if (cached && Date.now() - cached.cachedAt < FLAG_CACHE_TTL_MS) {
    return cached.enabled;
  }

  // 3. Query DB: per-tenant first, then global
  try {
    let flag = null;

    if (organizationId) {
      flag = await prisma.featureFlag.findUnique({
        where: {
          organizationId_name: {
            organizationId,
            name: flagName,
          },
        },
        select: { enabled: true },
      });
    }

    // Fall back to global flag (organizationId = "__GLOBAL__")
    if (!flag) {
      flag = await prisma.featureFlag.findUnique({
        where: {
          organizationId_name: {
            organizationId: GLOBAL_ORG_ID,
            name: flagName,
          },
        },
        select: { enabled: true },
      });
    }

    const enabled = flag?.enabled ?? false;
    flagCache.set(cacheKey, { enabled, cachedAt: Date.now() });
    return enabled;
  } catch (err) {
    console.warn(`[FEATURE_FLAG] Error checking flag "${flagName}":`, err);
    // On error, default to false (safe fallback = old pipeline)
    return false;
  }
}

/**
 * Set a feature flag. If organizationId is null, sets a global flag.
 */
export async function setFeatureFlag(
  flagName: string,
  enabled: boolean,
  organizationId?: string | null
): Promise<void> {
  try {
    await prisma.featureFlag.upsert({
      where: {
        organizationId_name: {
          organizationId: organizationId || GLOBAL_ORG_ID,
          name: flagName,
        },
      },
      create: {
        organizationId: organizationId || GLOBAL_ORG_ID,
        name: flagName,
        enabled,
      },
      update: {
        enabled,
      },
    });

    // Invalidate cache
    const cacheKey = `${organizationId || GLOBAL_ORG_ID}:${flagName}`;
    flagCache.delete(cacheKey);

    console.log(`[FEATURE_FLAG] Set "${flagName}" = ${enabled} for ${organizationId || "GLOBAL"}`);
  } catch (err) {
    console.error(`[FEATURE_FLAG] Error setting flag "${flagName}":`, err);
    throw err;
  }
}

/**
 * Invalidate all cached feature flags (e.g. on deploy).
 */
export function invalidateFeatureFlagCache(): void {
  flagCache.clear();
}

// Well-known flag names
export const FLAGS = {
  /** Use new LiveKit-only pipeline instead of Cartesia Agent Runtime */
  USE_NEW_PIPELINE: "use_new_pipeline",
  /** Enable provider fallbacks (TTS, LLM) */
  ENABLE_FALLBACKS: "enable_fallbacks",
  /** Enable agent versioning on save */
  ENABLE_VERSIONING: "enable_versioning",
  /** Enable call event tracking */
  ENABLE_CALL_EVENTS: "enable_call_events",
} as const;
