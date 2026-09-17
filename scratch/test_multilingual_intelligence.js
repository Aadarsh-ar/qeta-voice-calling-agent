async function testMultilingual() {
  console.log("=== MULTILINGUAL & INTENT TEST (TELUGU / TENGLISH / ENGLISH) ===\n");

  const agentId = "cmu40722800014r20hvl070n3";

  const queries = [
    {
      lang: "Tenglish",
      text: "Na order inka raledu bro, order number 4567 status cheppava?",
    },
    {
      lang: "English",
      text: "Where is my package? Can you please check order 4567?",
    },
    {
      lang: "Pure Telugu",
      text: "నా ఆర్డర్ 4567 ఎక్కడి వరకు వచ్చిందో దయచేసి చూడగలరా?",
    }
  ];

  for (const q of queries) {
    console.log(`[${q.lang}] Query: "${q.text}"`);
    const start = Date.now();
    const res = await fetch("http://localhost:3000/api/agent/turn", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agentId,
        userUtterance: q.text,
        conversationHistory: [],
        customerPhone: "+916305367443",
      }),
    }).then(r => r.json());

    console.log(`Agent reply: "${res.normalizedReply || res.rawReply}"`);
    console.log(`Latency: ${Date.now() - start}ms | Tool Called: ${res.toolCalls?.map(t => t.name).join(', ') || 'None'}\n`);
  }
}

testMultilingual().catch(console.error);
