import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Starting DB migration to single agent: agent_vDCfnuFdJokXJDVxgmHeZx...");

  // 1. Get or create primary organization
  let org = await prisma.organization.findFirst();
  if (!org) {
    org = await prisma.organization.create({
      data: {
        name: "QETADOTIN Voice AI",
        slug: "qetadotin-voice",
      },
    });
  }
  console.log("Organization:", org.id, org.name);

  // 2. Find phone number +91 80 7158 2667
  let phone = await prisma.phoneNumber.findFirst({
    where: {
      OR: [
        { e164Number: "+91 80 7158 2667" },
        { e164Number: "+918071582667" },
      ],
    },
  });

  if (!phone) {
    phone = await prisma.phoneNumber.create({
      data: {
        organizationId: org.id,
        e164Number: "+91 80 7158 2667",
        provider: "Vobiz",
        status: "Active",
      },
    });
  }
  console.log("Primary Phone Number:", phone.id, phone.e164Number);

  // 3. Unassign phone number from any previous agents before deleting
  await prisma.agent.updateMany({
    where: { phoneNumberId: phone.id },
    data: { phoneNumberId: null },
  });

  // 4. Delete old agents
  const oldAgentIds = ["agent_minb6qwKNfwWXLV8gyRfRq", "agent_GaiYMgB9Bj9kaKW1tUgqSQ"];
  for (const oldId of oldAgentIds) {
    try {
      await prisma.agentTool.deleteMany({ where: { agentId: oldId } });
      await prisma.agentKnowledge.deleteMany({ where: { agentId: oldId } });
      await prisma.call.deleteMany({ where: { agentId: oldId } });
      await prisma.agent.delete({ where: { id: oldId } });
      console.log(`Deleted old agent: ${oldId}`);
    } catch (e) {
      console.log(`Note for ${oldId}:`, e.message);
    }
  }

  // 5. Upsert single agent agent_vDCfnuFdJokXJDVxgmHeZx
  const systemPrompt = `# పాత్ర (Role)

నువ్వు College లో పనిచేసే ఒక కాలేజ్ లెక్చరర్ / ఫ్యాకల్టీ మెంబర్‌గా విద్యార్థి తల్లిదండ్రులకు ఫోన్ చేసే AI Voice Agent.

నీ ప్రధాన ఉద్దేశ్యం విద్యార్థి attendance తక్కువగా ఉందని తల్లిదండ్రులకు మర్యాదగా తెలియజేయడం.

Greeting: “నమస్తే అండి, నేను హారిక మేడమ్ మాట్లాడుతున్నాను. మీ అబ్బాయి అటెండెన్స్ గురించి కాల్ చేశాను.”`;

  const agent = await prisma.agent.upsert({
    where: { id: "agent_vDCfnuFdJokXJDVxgmHeZx" },
    update: {
      organizationId: org.id,
      name: "College Attendance Notification (COMPLAINT)",
      description: "College Faculty attendance notification voice agent communicating with parents in polite natural Telugu.",
      language: "TELUGU",
      status: "ACTIVE",
      systemPrompt,
      instructions: systemPrompt,
      initialMessage: "నమస్తే అండి, నేను హారిక మేడమ్ మాట్లాడుతున్నాను. మీ అబ్బాయి అటెండెన్స్ గురించి కాల్ చేశాను.",
      cartesiaVoiceId: "41508a7d-4839-445f-ba7f-687f620ed0e7",
      cartesiaAgentId: "agent_vDCfnuFdJokXJDVxgmHeZx",
      cartesiaModel: "sonic-3.6",
      llmModel: "gemini-2.5-flash",
      sarvamModel: "saaras:v3-realtime",
      sarvamLanguage: "te-IN",
      businessContext: "College of Engineering — Department of Computer Science & Engineering.",
      phoneNumberId: phone.id,
      lastSyncStatus: "SYNCED",
      lastSyncedAt: new Date(),
    },
    create: {
      id: "agent_vDCfnuFdJokXJDVxgmHeZx",
      organizationId: org.id,
      name: "College Attendance Notification (COMPLAINT)",
      description: "College Faculty attendance notification voice agent communicating with parents in polite natural Telugu.",
      language: "TELUGU",
      status: "ACTIVE",
      systemPrompt,
      instructions: systemPrompt,
      initialMessage: "నమస్తే అండి, నేను హారిక మేడమ్ మాట్లాడుతున్నాను. మీ అబ్బాయి అటెండెన్స్ గురించి కాల్ చేశాను.",
      cartesiaVoiceId: "41508a7d-4839-445f-ba7f-687f620ed0e7",
      cartesiaAgentId: "agent_vDCfnuFdJokXJDVxgmHeZx",
      cartesiaModel: "sonic-3.6",
      llmModel: "gemini-2.5-flash",
      sarvamModel: "saaras:v3-realtime",
      sarvamLanguage: "te-IN",
      businessContext: "College of Engineering — Department of Computer Science & Engineering.",
      phoneNumberId: phone.id,
      lastSyncStatus: "SYNCED",
      lastSyncedAt: new Date(),
    },
  });
  console.log("Upserted agent:", agent.id, agent.name);

  // 6. Tools
  const tools = [
    { name: "end_call", description: "End call politely when conversation concludes" },
    { name: "transfer_call", description: "Transfer to department head (+916305367443)" },
  ];
  for (const t of tools) {
    await prisma.agentTool.upsert({
      where: {
        agentId_name: {
          agentId: agent.id,
          name: t.name,
        },
      },
      update: { description: t.description, enabled: true, isEnabled: true },
      create: {
        agentId: agent.id,
        name: t.name,
        description: t.description,
        enabled: true,
        isEnabled: true,
      },
    });
  }
  console.log("Tools created/updated.");

  // Verify total agents
  const allAgents = await prisma.agent.findMany();
  console.log("Total agents now in DB:", allAgents.length);
  for (const a of allAgents) {
    console.log(" - Agent:", a.id, a.name);
  }

  await prisma.$disconnect();
  console.log("DB migration completed successfully!");
}

main().catch((e) => {
  console.error("Migration error:", e);
  process.exit(1);
});
