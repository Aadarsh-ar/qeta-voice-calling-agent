import { NextResponse } from "next/server";
import { dataStore, AgentItem } from "@/lib/db/store";
import { prisma } from "@/lib/db/prisma";
import { syncAgentWithCartesia } from "@/lib/cartesia/sync";
import { agentRuntimeCache } from "@/lib/agent/agentRuntimeCache";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let agent = dataStore.getAgent(id);

  if (!agent) {
    try {
      const dbAgent = await prisma.agent.findUnique({
        where: { id },
        select: {
          id: true,
          organizationId: true,
          name: true,
          description: true,
          instructions: true,
          systemPrompt: true,
          businessContext: true,
          cartesiaVoiceId: true,
          cartesiaAgentId: true,
          cartesiaModel: true,
          llmModel: true,
          language: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          phoneNumber: { select: { e164Number: true } },
          business: {
            select: {
              name: true,
              description: true,
              information: true,
              operatingHours: true,
              address: true,
              contactInformation: true,
              website: true,
            },
          },
          tools: {
            select: { name: true, description: true, isEnabled: true, enabled: true },
          },
        },
      });

      if (dbAgent) {
        let parsedBizProfile: any = undefined;
        if (dbAgent.businessContext && dbAgent.businessContext.trim().startsWith("{")) {
          try {
            parsedBizProfile = JSON.parse(dbAgent.businessContext);
          } catch {}
        }

        if (!parsedBizProfile && dbAgent.business) {
          parsedBizProfile = {
            businessName: dbAgent.business.name,
            description: dbAgent.business.description || "",
            productsServices: dbAgent.business.information || "",
            workingHours: dbAgent.business.operatingHours || "",
            location: dbAgent.business.address || "",
            contactInfo: dbAgent.business.contactInformation || "",
            website: dbAgent.business.website || "",
          };
        }

        agent = {
          id: dbAgent.id,
          name: dbAgent.name,
          description: dbAgent.description || "",
          language: dbAgent.language as any,
          status: dbAgent.status as any,
          systemPrompt: dbAgent.instructions || dbAgent.systemPrompt,
          businessContext: dbAgent.businessContext || "",
          businessProfile: parsedBizProfile,
          cartesiaVoiceId: dbAgent.cartesiaVoiceId || process.env.CARTESIA_VOICE_ID || "f9945b75-0f3b-448d-ba9e-3d22c229a68e",
          cartesiaVoiceName: "AD (Cloned Telugu Voice)",
          cartesiaModel: dbAgent.cartesiaModel,
          llmModel: dbAgent.llmModel,
          sarvamModel: "saaras:v3-realtime",
          sarvamLanguage: "te-IN",
          phoneNumber: dbAgent.phoneNumber?.e164Number || "+91 80 7158 2667",
          callsCount: 0,
          totalMinutes: 0,
          estimatedCost: 0,
          lastActive: "Active",
          createdAt: dbAgent.createdAt.toISOString(),
          tools: dbAgent.tools.map((t) => ({
            name: t.name,
            description: t.description,
            isEnabled: t.enabled && t.isEnabled,
          })),
          cartesiaAgentId: dbAgent.cartesiaAgentId || (dbAgent.id.startsWith("agent_") ? dbAgent.id : undefined),
        };

        dataStore.createAgentWithId(agent);
      }
    } catch (err) {
      console.warn("DB agent retrieval exception:", err);
    }
  }

  if (!agent) {
    return NextResponse.json({ success: false, error: "Agent not found" }, { status: 404 });
  }
  return NextResponse.json({ success: true, agent });
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

    const currentAgent = dataStore.getAgent(id);

    // Exact Cartesia Agent ID resolution — no random or fake fallbacks
    let cartesiaAgentId =
      body.cartesiaAgentId && body.cartesiaAgentId.trim().startsWith("agent_")
        ? body.cartesiaAgentId.trim()
        : currentAgent?.cartesiaAgentId && currentAgent.cartesiaAgentId.startsWith("agent_")
        ? currentAgent.cartesiaAgentId
        : id.startsWith("agent_")
        ? id
        : undefined;

    if (!cartesiaAgentId) {
      try {
        const dbCheck = await prisma.agent.findUnique({
          where: { id },
          select: { cartesiaAgentId: true },
        });
        if (dbCheck?.cartesiaAgentId && dbCheck.cartesiaAgentId.startsWith("agent_")) {
          cartesiaAgentId = dbCheck.cartesiaAgentId;
        }
      } catch {}
    }

    const bizProfile = body.businessProfile || currentAgent?.businessProfile || {};
    const agentName = body.name || currentAgent?.name || "AD2 — Aadarsh";
    const agentInstructions = body.systemPrompt || body.instructions || currentAgent?.systemPrompt || "";
    const voiceId = body.cartesiaVoiceId || currentAgent?.cartesiaVoiceId || process.env.CARTESIA_VOICE_ID || "f9945b75-0f3b-448d-ba9e-3d22c229a68e";
    const language = body.language || currentAgent?.language || "TELUGU_ENGLISH";
    const tools = body.tools || currentAgent?.tools || [];

    // ── STEP 1: Synchronize with Cartesia Official Agent API ──────────────────
    let syncResult;
    try {
      syncResult = await syncAgentWithCartesia({
        cartesiaAgentId,
        agentName,
        instructions: agentInstructions,
        businessName: bizProfile.businessName,
        businessDescription: bizProfile.description,
        businessInformation: bizProfile.productsServices,
        operatingHours: bizProfile.workingHours,
        address: bizProfile.location,
        contactInformation: bizProfile.contactInfo,
        website: bizProfile.website,
        faqs: bizProfile.faqs,
        policies: bizProfile.policies,
        tools,
        cartesiaVoiceId: voiceId,
        language,
      });
    } catch (cartesiaErr: unknown) {
      console.error("[CARTESIA_SYNC_ERROR] Update rejected by Cartesia:", cartesiaErr);
      // STRICT REQUIREMENT: Do NOT save or show success if Cartesia synchronization failed
      return NextResponse.json(
        {
          success: false,
          error: `Cartesia synchronization failed: ${cartesiaErr instanceof Error ? cartesiaErr.message : "Unknown error"}`,
        },
        { status: 502 }
      );
    }

    const verifiedCartesiaAgentId = syncResult.cartesiaAgentId;

    // ── STEP 2: Persist to PostgreSQL Neon DB (Multi-Tenant Org Scoped) ───────
    try {
      const org = await prisma.organization.findFirst();
      if (org) {
        // Upsert Business if provided
        let businessRecord = null;
        if (bizProfile.businessName) {
          const existingBiz = await prisma.business.findFirst({
            where: { organizationId: org.id },
          });
          if (existingBiz) {
            businessRecord = await prisma.business.update({
              where: { id: existingBiz.id },
              data: {
                name: bizProfile.businessName,
                description: bizProfile.description || "",
                information: bizProfile.productsServices || "",
                operatingHours: bizProfile.workingHours || "",
                address: bizProfile.location || "",
                contactInformation: bizProfile.contactInfo || "",
                website: bizProfile.website || "",
              },
            });
          } else {
            businessRecord = await prisma.business.create({
              data: {
                organizationId: org.id,
                name: bizProfile.businessName,
                description: bizProfile.description || "",
                information: bizProfile.productsServices || "",
                operatingHours: bizProfile.workingHours || "",
                address: bizProfile.location || "",
                contactInformation: bizProfile.contactInfo || "",
                website: bizProfile.website || "",
              },
            });
          }
        }

        // Update Agent record
        await prisma.agent.upsert({
          where: { id },
          create: {
            id,
            organizationId: org.id,
            name: agentName,
            description: body.description || currentAgent?.description || "",
            instructions: agentInstructions,
            systemPrompt: syncResult.instructions,
            cartesiaAgentId: verifiedCartesiaAgentId,
            cartesiaVoiceId: voiceId,
            language: language as any,
            status: body.status || currentAgent?.status || "ACTIVE",
            businessId: businessRecord?.id,
            businessContext: JSON.stringify(bizProfile),
          },
          update: {
            name: agentName,
            description: body.description !== undefined ? body.description : undefined,
            instructions: agentInstructions,
            systemPrompt: syncResult.instructions,
            cartesiaAgentId: verifiedCartesiaAgentId,
            cartesiaVoiceId: voiceId,
            status: body.status !== undefined ? body.status : undefined,
            businessId: businessRecord?.id,
            businessContext: JSON.stringify(bizProfile),
          },
        });

        // Update Tools
        if (body.tools && Array.isArray(body.tools)) {
          await prisma.agentTool.deleteMany({ where: { agentId: id } });
          await prisma.agentTool.createMany({
            data: body.tools.map((t: { name: string; description: string; isEnabled?: boolean; enabled?: boolean }) => ({
              agentId: id,
              name: t.name,
              description: t.description,
              enabled: t.isEnabled !== false && t.enabled !== false,
              isEnabled: t.isEnabled !== false && t.enabled !== false,
            })),
            skipDuplicates: true,
          });
        }

        // Update Knowledge chunks (FAQs)
        if (bizProfile.faqs && Array.isArray(bizProfile.faqs)) {
          await prisma.agentKnowledge.deleteMany({ where: { agentId: id } });
          const knowledgeRows = bizProfile.faqs
            .filter((f: { question: string; answer: string }) => f.question && f.answer)
            .map((f: { question: string; answer: string }) => ({
              agentId: id,
              title: f.question,
              content: f.answer,
              metadata: { type: "faq" },
            }));

          if (knowledgeRows.length > 0) {
            await prisma.agentKnowledge.createMany({ data: knowledgeRows });
          }
        }
      }
    } catch (dbErr) {
      console.warn("[DB_WARNING] PostgreSQL persistence warning:", dbErr);
    }

    // ── STEP 3: Update local memory store & warm runtime cache ─────────────────
    const updated = dataStore.updateAgent(id, {
      ...body,
      name: agentName,
      systemPrompt: syncResult.instructions,
      cartesiaAgentId: verifiedCartesiaAgentId,
      cartesiaVoiceId: voiceId,
      businessProfile: bizProfile,
      lastActive: "Active & Synchronized",
    });

    agentRuntimeCache.invalidate(id, {
      id,
      organizationId: (currentAgent as any)?.organizationId || "org_default",
      name: agentName,
      instructions: agentInstructions,
      businessName: bizProfile.businessName || "QETADOTIN",
      cartesiaAgentId: verifiedCartesiaAgentId,
      cartesiaVoiceId: voiceId,
      language,
      enabledTools: (tools || []).filter((t: any) => t.isEnabled !== false && t.enabled !== false),
      phoneNumber: body.phoneNumber || currentAgent?.phoneNumber,
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      agent: updated,
      synced: true,
      cartesiaAgentId: verifiedCartesiaAgentId,
      cartesiaVersionId: syncResult.cartesiaVersionId,
      updatedAt: syncResult.updatedAt,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Error updating agent" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    dataStore.deleteAgent(id);
    agentRuntimeCache.invalidate(id);

    try {
      await prisma.agentKnowledge.deleteMany({ where: { agentId: id } });
      await prisma.agentTool.deleteMany({ where: { agentId: id } });
      await prisma.agent.delete({ where: { id } });
    } catch {
      // ignore if not present in DB
    }

    return NextResponse.json({ success: true, deleted: true });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Error deleting agent" },
      { status: 500 }
    );
  }
}
