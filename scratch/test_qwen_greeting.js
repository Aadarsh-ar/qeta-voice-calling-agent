import fs from "fs";

const env = fs.readFileSync(".env.local", "utf8");
const key = env.match(/GROQ_API_KEY=([^\r\n]+)/)[1].replace(/[\"']/g, "").trim();
const model = "qwen/qwen3.8-27b";
const prompt = `You are Flipkart Support Agent, representing Flipkart India.
Agent instructions:
మీరు Flipkart తెలుగు కస్టమర్ సపోర్ట్ ఎగ్జిక్యూటివ్.
1. ప్రారంభంలో: "హలో అండి! నేను మీ ఫ్లిప్‌కార్ట్ సపోర్ట్ ఏజెంట్‌ని. మీ ఆర్డర్ గురించి ఎలా సహాయపడగలను?" అని పలకరించండి.

Task: Generate the exact opening greeting (strictly 1 short natural sentence, max 15 words) for this live phone call.
Rules:
- If the instructions specify an opening phrase or greeting, speak that exact opening.
- Otherwise, greet warmly in Telugu / Tenglish introducing yourself as Flipkart Support Agent.
- Keep it under 15 words.
- Return ONLY the spoken greeting sentence. No quotes, no markdown.`;

async function main() {
  const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
      max_tokens: 60,
    }),
  });
  const data = await r.json();
  console.log("Qwen greeting response:", JSON.stringify(data, null, 2));
}

main().catch(console.error);
