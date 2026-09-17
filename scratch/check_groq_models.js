import fs from "fs";
const env = fs.readFileSync(".env.local", "utf8");
const keyMatch = env.match(/GROQ_API_KEY=([^\r\n]+)/);
const apiKey = keyMatch ? keyMatch[1].replace(/[\"']/g, "").trim() : "";

fetch("https://api.groq.com/openai/v1/chat/completions", {
  method: "POST",
  headers: {
    Authorization: "Bearer " + apiKey,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: "openai/gpt-oss-20b",
    messages: [{ role: "user", content: "నా ఆర్డర్ ORD-8421 స్టేటస్ ఏమిటి?" }],
    tools: [
      {
        type: "function",
        function: {
          name: "check_order_status",
          description: "Lookup shipping and delivery status of a customer order by Order ID",
          parameters: {
            type: "object",
            properties: {
              orderId: { type: "string", description: "Order ID like ORD-8421" },
            },
            required: ["orderId"],
          },
        },
      },
    ],
    tool_choice: "auto",
  }),
})
  .then((r) => r.json())
  .then((d) => console.log("Tool call response:", JSON.stringify(d, null, 2)))
  .catch((e) => console.error(e));
