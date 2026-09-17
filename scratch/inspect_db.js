import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";

async function main() {
  const prisma = new PrismaClient();
  const org = await prisma.organization.findFirst({
    include: {
      agents: {
        include: {
          tools: true,
          knowledge: true,
          business: true,
        },
      },
      phoneNumbers: true,
    },
  });
  console.log("Org:", org ? { id: org.id, name: org.name, slug: org.slug } : null);
  const agents = await prisma.agent.findMany({
    include: {
      phoneNumber: true,
      tools: true,
      knowledge: true,
      business: true,
    },
  });
  console.log("Agents count:", agents.length);
  for (const a of agents) {
    console.log({
      id: a.id,
      name: a.name,
      status: a.status,
      cartesiaAgentId: a.cartesiaAgentId,
      phone: a.phoneNumber?.e164Number,
      toolsCount: a.tools.length,
      knowledgeCount: a.knowledge.length,
      business: a.business?.name,
    });
  }
  await prisma.$disconnect();
}
main().catch(console.error);
