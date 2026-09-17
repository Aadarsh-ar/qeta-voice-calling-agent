import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";

async function main() {
  const prisma = new PrismaClient();
  const phone = await prisma.phoneNumber.findFirst({ where: { e164Number: "+91 80 7158 2667" } });

  await prisma.agent.update({
    where: { id: "agent_Pv4hHbMWRubDumrq4v4L15" },
    data: { status: "INACTIVE", phoneNumberId: null },
  });

  await prisma.agent.update({
    where: { id: "agent_GaiYMgB9Bj9kaKW1tUgqSQ" },
    data: {
      status: "ACTIVE",
      phoneNumberId: phone ? phone.id : undefined,
      cartesiaVoiceId: "f9945b75-0f3b-448d-ba9e-3d22c229a68e",
    },
  });

  console.log("✅ Updated agent_GaiYMgB9Bj9kaKW1tUgqSQ as primary ACTIVE agent on +91 80 7158 2667");
  await prisma.$disconnect();
}

main().catch(console.error);
