import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import pg from "pg";

async function test(url, label) {
  console.log("Testing:", label);
  const pool = new pg.Pool({ connectionString: url, connectionTimeoutMillis: 5000 });
  try {
    const res = await pool.query("SELECT 1 as val");
    console.log("SUCCESS:", label, res.rows);
  } catch (err) {
    console.error("FAIL:", label, err.message);
  } finally {
    await pool.end();
  }
}

async function main() {
  const base = process.env.DATABASE_URL;
  await test(base, "original");
  const noCb = base.replace("&channel_binding=require", "");
  await test(noCb, "no channel_binding");
  const direct = base.replace("-pooler", "").replace("&channel_binding=require", "");
  await test(direct, "direct without pooler and no channel_binding");
}
main();
