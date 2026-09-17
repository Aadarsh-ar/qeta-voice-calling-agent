import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";

async function main() {
  const prisma = new PrismaClient();
  const orgCount = await prisma.organization.count();
  const agents = await prisma.agent.findMany({
    select: { id: true, name: true, cartesiaAgentId: true, organizationId: true },
  });
  console.log("Organizations count:", orgCount);
  console.log("Agents in DB:", agents);
  await prisma.$disconnect();
}
main().catch(console.error);
