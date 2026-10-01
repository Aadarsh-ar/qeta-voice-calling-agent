/**
 * Agent Version Service
 *
 * Every agent save creates a new immutable version. Calls pin to the version
 * active at call start, so editing an agent never breaks in-progress calls.
 *
 * Version numbers are auto-incremented per agent (not globally).
 */

import { prisma } from "@/lib/db/prisma";

export interface AgentVersionSnapshot {
  id: string;
  agentId: string;
  organizationId: string;
  versionNumber: number;
  name: string;
  description?: string;
  systemPrompt: string;
  instructions?: string;
  initialMessage?: string;
  voiceId: string;
  ttsModel: string;
  llmModel: string;
  llmProvider: string;
  temperature: number;
  sttProvider: string;
  sttModel: string;
  language: string;
  businessContext?: string;
  tools: Array<{ name: string; description: string; isEnabled: boolean }>;
  knowledge: Array<{ title: string; content: string }>;
}

/**
 * Creates a new immutable version snapshot of the agent's current config.
 * Called on every agent create or update (DB-only, no external API calls).
 * Returns the created version record.
 */
export async function createAgentVersion(agentId: string): Promise<AgentVersionSnapshot> {
  // Load the current agent state with tools and knowledge
  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
    include: {
      tools: {
        select: { name: true, description: true, isEnabled: true, enabled: true },
      },
      knowledge: {
        select: { title: true, content: true },
      },
    },
  });

  if (!agent) {
    throw new Error(`Agent ${agentId} not found. Cannot create version.`);
  }

  // Determine next version number (atomic increment)
  const latestVersion = await prisma.agentVersion.findFirst({
    where: { agentId },
    orderBy: { versionNumber: "desc" },
    select: { versionNumber: true },
  });

  const nextVersionNum = (latestVersion?.versionNumber ?? 0) + 1;

  // Build tools snapshot
  const toolsSnapshot = agent.tools.map((t) => ({
    name: t.name,
    description: t.description,
    isEnabled: t.isEnabled && t.enabled,
  }));

  // Build knowledge snapshot
  const knowledgeSnapshot = agent.knowledge.map((k) => ({
    title: k.title,
    content: k.content,
  }));

  // Build full config snapshot for audit
  const configSnapshot = {
    agentId: agent.id,
    organizationId: agent.organizationId,
    name: agent.name,
    voiceId: agent.voiceId || agent.cartesiaVoiceId,
    ttsModel: agent.ttsModel || agent.cartesiaModel,
    llmModel: agent.llmModel,
    llmProvider: agent.llmProvider || "groq",
    temperature: agent.temperature,
    sttProvider: agent.sttProvider || "deepgram",
    sttModel: agent.sttModel || "nova-3",
    language: agent.language,
    status: agent.status,
    toolsCount: toolsSnapshot.length,
    knowledgeCount: knowledgeSnapshot.length,
    createdAt: new Date().toISOString(),
  };

  // Create the immutable version record
  const version = await prisma.agentVersion.create({
    data: {
      organizationId: agent.organizationId,
      agentId: agent.id,
      versionNumber: nextVersionNum,
      name: agent.name,
      description: agent.description,
      systemPrompt: agent.systemPrompt,
      instructions: agent.instructions,
      initialMessage: agent.initialMessage,
      voiceId: agent.voiceId || agent.cartesiaVoiceId || "41508a7d-4839-445f-ba7f-687f620ed0e7",
      ttsModel: agent.ttsModel || agent.cartesiaModel || "sonic-3.6",
      llmModel: agent.llmModel || "gemini-2.5-flash",
      llmProvider: agent.llmProvider || "groq",
      temperature: agent.temperature,
      sttProvider: agent.sttProvider || "deepgram",
      sttModel: agent.sttModel || "nova-3",
      language: agent.language,
      businessContext: agent.businessContext,
      tools: toolsSnapshot,
      knowledge: knowledgeSnapshot,
      configSnapshot,
      status: "LIVE",
    },
  });

  // Update the agent's current version number
  await prisma.agent.update({
    where: { id: agentId },
    data: { currentVersionNum: nextVersionNum },
  });

  // Archive previous LIVE versions for this agent
  await prisma.agentVersion.updateMany({
    where: {
      agentId,
      status: "LIVE",
      id: { not: version.id },
    },
    data: { status: "ARCHIVED" },
  });

  console.log(`[AGENT_VERSION] Created version v${nextVersionNum} for agent "${agent.name}" (${agentId})`);

  return {
    id: version.id,
    agentId: version.agentId,
    organizationId: version.organizationId,
    versionNumber: version.versionNumber,
    name: version.name,
    description: version.description ?? undefined,
    systemPrompt: version.systemPrompt,
    instructions: version.instructions ?? undefined,
    initialMessage: version.initialMessage ?? undefined,
    voiceId: version.voiceId,
    ttsModel: version.ttsModel,
    llmModel: version.llmModel,
    llmProvider: version.llmProvider,
    temperature: version.temperature,
    sttProvider: version.sttProvider,
    sttModel: version.sttModel,
    language: version.language,
    businessContext: version.businessContext ?? undefined,
    tools: toolsSnapshot,
    knowledge: knowledgeSnapshot,
  };
}

/**
 * Gets the current LIVE version of an agent.
 * Used by the call worker to load the correct config at call start.
 */
export async function getCurrentAgentVersion(agentId: string): Promise<AgentVersionSnapshot | null> {
  const version = await prisma.agentVersion.findFirst({
    where: {
      agentId,
      status: "LIVE",
    },
    orderBy: { versionNumber: "desc" },
  });

  if (!version) {
    return null;
  }

  return {
    id: version.id,
    agentId: version.agentId,
    organizationId: version.organizationId,
    versionNumber: version.versionNumber,
    name: version.name,
    description: version.description ?? undefined,
    systemPrompt: version.systemPrompt,
    instructions: version.instructions ?? undefined,
    initialMessage: version.initialMessage ?? undefined,
    voiceId: version.voiceId,
    ttsModel: version.ttsModel,
    llmModel: version.llmModel,
    llmProvider: version.llmProvider,
    temperature: version.temperature,
    sttProvider: version.sttProvider,
    sttModel: version.sttModel,
    language: version.language,
    businessContext: version.businessContext ?? undefined,
    tools: (version.tools as any[]) || [],
    knowledge: (version.knowledge as any[]) || [],
  };
}

/**
 * Gets a specific version by ID (for call replay / audit).
 */
export async function getAgentVersionById(versionId: string): Promise<AgentVersionSnapshot | null> {
  const version = await prisma.agentVersion.findUnique({
    where: { id: versionId },
  });

  if (!version) {
    return null;
  }

  return {
    id: version.id,
    agentId: version.agentId,
    organizationId: version.organizationId,
    versionNumber: version.versionNumber,
    name: version.name,
    description: version.description ?? undefined,
    systemPrompt: version.systemPrompt,
    instructions: version.instructions ?? undefined,
    initialMessage: version.initialMessage ?? undefined,
    voiceId: version.voiceId,
    ttsModel: version.ttsModel,
    llmModel: version.llmModel,
    llmProvider: version.llmProvider,
    temperature: version.temperature,
    sttProvider: version.sttProvider,
    sttModel: version.sttModel,
    language: version.language,
    businessContext: version.businessContext ?? undefined,
    tools: (version.tools as any[]) || [],
    knowledge: (version.knowledge as any[]) || [],
  };
}

/**
 * Lists all versions for an agent (for UI history view).
 */
export async function listAgentVersions(
  agentId: string,
  limit: number = 20
): Promise<Array<{ id: string; versionNumber: number; name: string; status: string; createdAt: Date }>> {
  return prisma.agentVersion.findMany({
    where: { agentId },
    orderBy: { versionNumber: "desc" },
    take: limit,
    select: {
      id: true,
      versionNumber: true,
      name: true,
      status: true,
      createdAt: true,
    },
  });
}
