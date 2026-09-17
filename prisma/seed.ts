import { PrismaClient, AgentLanguage, AgentStatus, IntegrationProvider, IntegrationStatus } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding Neon PostgreSQL database...");

  // 1. Create or find Organization
  const org = await prisma.organization.upsert({
    where: { slug: "vaani-org" },
    update: {},
    create: {
      name: "Vaani Technologies",
      slug: "vaani-org",
      businessProfile: {
        create: {
          businessName: "Vaani AI",
          description: "Ultra-low Latency Telugu & Tenglish Conversational Voice Agents",
          productsServices: "AI Voice Agents, Lead Qualification, Inbound Support Bots",
          workingHours: "9:00 AM - 7:00 PM IST",
          location: "Hyderabad, Telangana",
          contactInfo: "+91 11 7136 6938, contact@vaani.ai",
        },
      },
    },
  });
  console.log("✓ Organization seeded:", org.id);

  // 2. Seed Integrations in DB
  const integrationsData = [
    {
      provider: IntegrationProvider.CARTESIA,
      status: IntegrationStatus.CONNECTED,
      apiKeyMasked: "sk_car_••••••••••••e2ujU",
      config: {
        voiceId: "ff480e6e-3e79-4307-9889-d1d9feb8e20e",
        voiceName: "AD",
        language: "te",
        model: "sonic-3.6",
      },
    },
    {
      provider: IntegrationProvider.SARVAM,
      status: IntegrationStatus.CONNECTED,
      apiKeyMasked: "sk_sc••••••••••••ZRRF",
      config: {
        languageCode: "te-IN",
        model: "saaras:v3-realtime",
      },
    },
    {
      provider: IntegrationProvider.OPENAI,
      status: IntegrationStatus.CONNECTED,
      apiKeyMasked: "gsk_••••••••••••OLgk",
      config: {
        provider: "Groq",
        model: "openai/gpt-oss-120b",
      },
    },
    {
      provider: IntegrationProvider.VOBIZ,
      status: IntegrationStatus.CONNECTED,
      apiKeyMasked: "test key",
      config: {
        sipDomain: "f15a55c4.sip.vobiz.ai",
        trunkId: "f15a55c4-c30f-4d6c-ad17-ef9cfbf468bc",
        outboundNumber: "+911171366938",
      },
    },
    {
      provider: IntegrationProvider.POSTGRESQL,
      status: IntegrationStatus.CONNECTED,
      config: {
        host: "ep-lingering-fog-a5dgsn4s-pooler.us-east-2.aws.neon.tech",
        database: "neondb",
      },
    },
  ];

  for (const item of integrationsData) {
    await prisma.integration.upsert({
      where: {
        organizationId_provider: {
          organizationId: org.id,
          provider: item.provider,
        },
      },
      update: {
        status: item.status,
        apiKeyMasked: item.apiKeyMasked,
        config: item.config,
      },
      create: {
        organizationId: org.id,
        provider: item.provider,
        status: item.status,
        apiKeyMasked: item.apiKeyMasked,
        config: item.config,
      },
    });
  }
  console.log("✓ Integrations recorded in DB");

  // 3. Seed Phone Number
  const phone = await prisma.phoneNumber.upsert({
    where: { e164Number: "+911171366938" },
    update: {},
    create: {
      organizationId: org.id,
      e164Number: "+911171366938",
      provider: "Vobiz",
      status: "Active",
    },
  });
  console.log("✓ Phone number seeded in DB:", phone.e164Number);

  // 4. Seed Telugu Sales Agent
  const existingAgent = await prisma.agent.findFirst({
    where: { organizationId: org.id, name: "Telugu Sales Agent" },
  });

  if (!existingAgent) {
    const agent = await prisma.agent.create({
      data: {
        organizationId: org.id,
        name: "Telugu Sales Agent",
        description: "Speaks fluent conversational Telugu for inbound business inquiries and sales lead qualification.",
        language: AgentLanguage.TELUGU_ENGLISH,
        status: AgentStatus.ACTIVE,
        systemPrompt: `మీరు Vaani AI యొక్క సేల్స్ అసిస్టెంట్. 1-2 వాక్యాలలో సహజమైన తెలుగు మరియు టెంగ్లీష్ లో సమాధానం ఇవ్వండి.`,
        cartesiaVoiceId: "ff480e6e-3e79-4307-9889-d1d9feb8e20e",
        cartesiaModel: "sonic-3.6",
        llmModel: "openai/gpt-oss-120b",
        sarvamModel: "saaras:v3-realtime",
        sarvamLanguage: "te-IN",
        phoneNumberId: phone.id,
        tools: {
          create: [
            { name: "end_call", description: "End call politely", isEnabled: true },
            { name: "transfer_call", description: "Transfer call to human manager", isEnabled: true },
            { name: "capture_customer_details", description: "Save customer requirement and callback time", isEnabled: true },
          ],
        },
      },
    });
    console.log("✓ Agent created in DB:", agent.name);
  }

  console.log("🎉 Neon PostgreSQL seeding completed successfully!");
}

main()
  .catch((e) => {
    console.error("Seeding error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
