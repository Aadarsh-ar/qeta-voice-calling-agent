import fs from "fs";

const env = fs.readFileSync(".env.local", "utf8");
const key = env.match(/GROQ_API_KEY=([^\r\n]+)/)[1].replace(/[\"']/g, "").trim();
const models = ["openai/gpt-oss-20b", "llama-3.3-70b-versatile", "llama-3.1-8b-instant"];

(async () => {
  for (const m of models) {
    const t0 = Date.now();
    try {
      const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: m,
          messages: [
            { role: "system", content: "You are Flipkart Support Agent. Greet the customer politely in Telugu in 1 short sentence." },
            { role: "user", content: "Hello" },
          ],
          max_tokens: 60,
        }),
      });
      const d = await r.json();
      console.log(m, "Time:", Date.now() - t0, "ms", "Content:", d.choices?.[0]?.message?.content);
    } catch (err) {
      console.error(m, err.message);
    }
  }
})();
