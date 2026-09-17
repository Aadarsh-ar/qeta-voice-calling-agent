import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";

async function testUrl(url, label) {
  console.log(`\n--- Testing ${label} ---`);
  const prisma = new PrismaClient({
    datasources: { db: { url } },
  });
  try {
    const start = Date.now();
    const count = await prisma.organization.count();
    console.log(`SUCCESS [${label}]: Org count = ${count} in ${Date.now() - start}ms`);
    return prisma;
  } catch (err) {
    console.error(`FAILED [${label}]: ${err.message}`);
    return null;
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  const base = process.env.DATABASE_URL;
  await testUrl(base, "Default from env");
  const noCb = base.replace("&channel_binding=require", "");
  await testUrl(noCb, "Without channel_binding");
  const direct = base.replace("-pooler", "").replace("&channel_binding=require", "");
  await testUrl(direct, "Direct non-pooler");
}

main().catch(console.error);
