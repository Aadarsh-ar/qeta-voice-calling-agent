/**
 * Organization Context Resolver
 *
 * Resolves the calling user's organization from the request.
 * This provides the foundation for multi-tenant isolation (ISO-1 fix).
 *
 * Current behavior: Single-org mode — resolves to the first/only organization.
 * TODO: Upgrade to full session-based auth when auth provider is integrated.
 *
 * Usage in API routes:
 *   const { organizationId, error } = await resolveOrgContext(request);
 *   if (error) return NextResponse.json({ success: false, error }, { status: 401 });
 */

import { prisma } from "@/lib/db/prisma";

export interface OrgContext {
  organizationId: string;
  organizationName: string;
  error?: never;
}

export interface OrgContextError {
  organizationId?: never;
  organizationName?: never;
  error: string;
}

/**
 * Resolves the organization context for the current request.
 *
 * Resolution order:
 * 1. x-organization-id header (for API clients)
 * 2. x-org-slug header (for slug-based routing)
 * 3. Single-org fallback (backward compat — only when exactly one org exists)
 */
export async function resolveOrgContext(
  req: Request
): Promise<OrgContext | OrgContextError> {
  try {
    // 1. Check explicit organization ID header (API clients)
    const explicitOrgId = req.headers.get("x-organization-id") ?? "";
    if (explicitOrgId && explicitOrgId.trim().length > 0) {
      const org = await prisma.organization.findUnique({
        where: { id: explicitOrgId.trim() },
        select: { id: true, name: true },
      });
      if (!org) {
        return {
          error: `Organization "${explicitOrgId}" not found or access denied.`,
        };
      }
      return { organizationId: org.id, organizationName: org.name };
    }

    // 2. Check slug header
    const orgSlug = req.headers.get("x-org-slug") ?? "";
    if (orgSlug && orgSlug.trim().length > 0) {
      const org = await prisma.organization.findUnique({
        where: { slug: orgSlug.trim() },
        select: { id: true, name: true },
      });
      if (!org) {
        return {
          error: `Organization slug "${orgSlug}" not found or access denied.`,
        };
      }
      return { organizationId: org.id, organizationName: org.name };
    }

    // 3. Single-org fallback — safe only when there is exactly one organization
    const orgs = await prisma.organization.findMany({
      select: { id: true, name: true },
      take: 2, // Only fetch 2 to detect multi-org case without a full scan
    });

    if (orgs.length === 0) {
      return {
        error:
          "No organization found. Please set up your organization before making API calls.",
      };
    }

    if (orgs.length > 1) {
      // Multi-org deployment detected — require explicit org ID
      return {
        error:
          "Multiple organizations exist. Please provide the 'x-organization-id' header to identify your workspace.",
      };
    }

    // Exactly one org — safe single-org mode (backward compat)
    return { organizationId: orgs[0].id, organizationName: orgs[0].name };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown DB error";
    console.error("[ORG_CONTEXT_ERROR]", message);
    return {
      error: `Failed to resolve organization context: ${message}`,
    };
  }
}

/**
 * Validates that a given agent belongs to the specified organization.
 * Use this before any agent read/write operation.
 */
export async function validateAgentOwnership(
  agentId: string,
  organizationId: string
): Promise<{ valid: boolean; error?: string }> {
  if (!agentId || !organizationId) {
    return { valid: false, error: "agentId and organizationId are required" };
  }
  try {
    const agent = await prisma.agent.findFirst({
      where: { id: agentId, organizationId },
      select: { id: true },
    });
    if (!agent) {
      return {
        valid: false,
        error: `Agent "${agentId}" does not belong to this organization or does not exist.`,
      };
    }
    return { valid: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "DB error";
    return { valid: false, error: `Ownership check failed: ${message}` };
  }
}

/**
 * Validates that a given campaign belongs to the specified organization.
 */
export async function validateCampaignOwnership(
  campaignId: string,
  organizationId: string
): Promise<{ valid: boolean; error?: string }> {
  if (!campaignId || !organizationId) {
    return { valid: false, error: "campaignId and organizationId are required" };
  }
  try {
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, organizationId },
      select: { id: true },
    });
    if (!campaign) {
      return {
        valid: false,
        error: `Campaign "${campaignId}" does not belong to this organization or does not exist.`,
      };
    }
    return { valid: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "DB error";
    return { valid: false, error: `Ownership check failed: ${message}` };
  }
}
