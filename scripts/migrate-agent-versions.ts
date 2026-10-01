/**
 * Migration Script: Seed AgentVersion records for existing agents
 *
 * Run after `prisma db push` or `prisma migrate dev` to:
 * 1. Create v1 AgentVersion for every existing Agent
 * 2. Set the global "use_new_pipeline" feature flag to false (rollback-safe)
 * 3. Populate voiceId from cartesiaVoiceId for agents that don't have it
 *
 * Usage: npx tsx scripts/migrate-agent-versions.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({ log: ["warn", "error"] });

async function main() {
  console.log("[MIGRATION] Starting agent version migration...\n");

  // 1. Get all existing agents
  const agents = await prisma.agent.findMany({
    include: {
      tools: { select: { name: true, description: true, isEnabled: true, enabled: true } },
      knowledge: { select: { title: true, content: true } },
    },
  });

  console.log(`[MIGRATION] Found ${agents.length} existing agent(s) to migrate.\n`);

  let created = 0;
  let skipped = 0;

  for (const agent of agents) {
    // Check if a version already exists
    const existingVersion = await prisma.agentVersion.findFirst({
      where: { agentId: agent.id },
      select: { id: true, versionNumber: true },
    });

    if (existingVersion) {
      console.log(`  [SKIP] Agent "${agent.name}" (${agent.id}) already has version v${existingVersion.versionNumber}`);
      skipped++;
      continue;
    }

    // Populate voiceId from cartesiaVoiceId if not set
    const voiceId = agent.voiceId || agent.cartesiaVoiceId || "41508a7d-4839-445f-ba7f-687f620ed0e7";

    // Create v1 snapshot
    const toolsSnapshot = agent.tools.map((t) => ({
      name: t.name,
      description: t.description,
      isEnabled: t.isEnabled && t.enabled,
    }));

    const knowledgeSnapshot = agent.knowledge.map((k) => ({
      title: k.title,
      content: k.content,
    }));

    const version = await prisma.agentVersion.create({
      data: {
        organizationId: agent.organizationId,
        agentId: agent.id,
        versionNumber: 1,
        name: agent.name,
        description: agent.description,
        systemPrompt: agent.systemPrompt,
        instructions: agent.instructions,
        initialMessage: agent.initialMessage,
        voiceId,
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
        configSnapshot: {
          migratedFrom: "existing_agent",
          migrationDate: new Date().toISOString(),
          originalCartesiaAgentId: agent.cartesiaAgentId,
        },
        status: "LIVE",
      },
    });

    // Update agent's currentVersionNum and voiceId
    await prisma.agent.update({
      where: { id: agent.id },
      data: {
        currentVersionNum: 1,
        voiceId,
      },
    });

    console.log(`  [OK] Agent "${agent.name}" (${agent.id}) → version v1 created (${version.id})`);
    created++;
  }

  // 2. Set global feature flag: new pipeline OFF by default (safe rollback)
  try {
    await prisma.featureFlag.upsert({
      where: {
        organizationId_name: {
          organizationId: "__GLOBAL__",
          name: "use_new_pipeline",
        },
      },
      create: {
        organizationId: "__GLOBAL__",
        name: "use_new_pipeline",
        enabled: false,
        metadata: {
          description: "When true, agent CRUD is DB-only and calls use LiveKit pipeline. When false, legacy Cartesia sync is used.",
          setBy: "migration_script",
          setAt: new Date().toISOString(),
        },
      },
      update: {}, // Don't overwrite if already set
    });
    console.log(`\n[MIGRATION] Feature flag "use_new_pipeline" set to FALSE (safe default).`);
  } catch (flagErr) {
    console.warn(`[MIGRATION] Could not set feature flag (non-fatal):`, flagErr);
  }

  // 3. Set versioning flag ON
  try {
    await prisma.featureFlag.upsert({
      where: {
        organizationId_name: {
          organizationId: "__GLOBAL__",
          name: "enable_versioning",
        },
      },
      create: {
        organizationId: "__GLOBAL__",
        name: "enable_versioning",
        enabled: true,
        metadata: {
          description: "Enable agent version snapshots on every save.",
          setBy: "migration_script",
          setAt: new Date().toISOString(),
        },
      },
      update: {},
    });
    console.log(`[MIGRATION] Feature flag "enable_versioning" set to TRUE.\n`);
  } catch (flagErr) {
    console.warn(`[MIGRATION] Could not set versioning flag (non-fatal):`, flagErr);
  }

  console.log(`\n[MIGRATION] Complete! Created: ${created}, Skipped: ${skipped}\n`);
}

main()
  .catch((err) => {
    console.error("[MIGRATION] Fatal error:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
