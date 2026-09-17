import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";

async function main() {
  const prisma = new PrismaClient();
  const oldAgentId = "agent_Pv4hHbMWRubDumrq4v4L15";
  const newAgentId = "agent_GaiYMgB9Bj9kaKW1tUgqSQ";

  console.log(`Migrating agent in DB from ${oldAgentId} to ${newAgentId}...`);

  const existingNew = await prisma.agent.findUnique({ where: { id: newAgentId } });
  const existingOld = await prisma.agent.findUnique({
    where: { id: oldAgentId },
    include: { tools: true, knowledge: true, business: true },
  });

  const org = await prisma.organization.findFirst();
  if (!org) throw new Error("No organization found");

  const phone = await prisma.phoneNumber.findFirst();

  if (existingOld) {
    if (!existingNew) {
      // Create new agent with the exact new ID
      const created = await prisma.agent.create({
        data: {
          id: newAgentId,
          organizationId: org.id,
          name: existingOld.name,
          description: existingOld.description,
          instructions: existingOld.instructions,
          systemPrompt: existingOld.systemPrompt,
          cartesiaAgentId: newAgentId,
          cartesiaVoiceId: existingOld.cartesiaVoiceId,
          cartesiaModel: existingOld.cartesiaModel || "sonic-3.6",
          llmModel: "gemini-2.5-flash",
          sarvamModel: "saaras:v3-realtime",
          sarvamLanguage: "te-IN",
          language: existingOld.language,
          status: "ACTIVE",
          phoneNumberId: phone?.id,
          businessId: existingOld.businessId,
          businessContext: existingOld.businessContext,
          tools: {
            create: existingOld.tools.map((t) => ({
              name: t.name,
              description: t.description,
              isEnabled: t.isEnabled,
              enabled: t.enabled,
            })),
          },
          knowledge: {
            create: existingOld.knowledge.map((k) => ({
              title: k.title,
              content: k.content,
              category: k.category,
            })),
          },
        },
      });
      console.log("Created new Agent record in PostgreSQL:", created.id);

      // Re-link phone number
      if (phone) {
        await prisma.phoneNumber.update({
          where: { id: phone.id },
          data: { assignedAgentId: newAgentId },
        });
        console.log(`Re-linked phone number ${phone.e164Number} to ${newAgentId}`);
      }

      // Update old agent cartesiaAgentId or remove
      await prisma.agent.update({
        where: { id: oldAgentId },
        data: { status: "INACTIVE" },
      });
      console.log(`Marked old agent ${oldAgentId} as INACTIVE`);
    } else {
      // Update existing
      await prisma.agent.update({
        where: { id: newAgentId },
        data: {
          cartesiaAgentId: newAgentId,
          status: "ACTIVE",
          phoneNumberId: phone?.id,
        },
      });
      console.log("Updated existing agent with new Cartesia Agent ID");
    }
  } else if (!existingNew) {
    // Create fresh
    const created = await prisma.agent.create({
      data: {
        id: newAgentId,
        organizationId: org.id,
        name: "ABC Support (Active)",
        description: "Customer Support Agent for ABC Electronics",
        instructions: "Assist customers warmly in Telugu and Tenglish.",
        systemPrompt: "Assist customers warmly in Telugu and Tenglish.",
        cartesiaAgentId: newAgentId,
        cartesiaVoiceId: "f9945b75-0f3b-448d-ba9e-3d22c229a68e",
        cartesiaModel: "sonic-3.6",
        llmModel: "gemini-2.5-flash",
        sarvamModel: "saaras:v3-realtime",
        sarvamLanguage: "te-IN",
        language: "TELUGU_ENGLISH",
        status: "ACTIVE",
        phoneNumberId: phone?.id,
      },
    });
    console.log("Created fresh Agent record:", created.id);
  }

  // Update mock store default if present
  console.log("DB migration completed successfully.");
  await prisma.$disconnect();
}

main().catch(console.error);
