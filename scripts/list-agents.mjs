import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function check() {
  const agents = await prisma.agent.findMany({
    include: { tools: true },
  });
  console.log("=== Agents in Neon PostgreSQL ===");
  console.log(JSON.stringify(agents, null, 2));
}

check()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
