const testUtterances = [
  "నా ఆర్డర్ ఇంకా రాలేదు, ఎప్పుడు వస్తుంది?",
  "నా దగ్గర నంబర్ లేదు, మీరే చెప్పండి",
  "మీ వద్ద రీఫండ్ పాలసీ ఏమిటి?",
  "మాకు డెమో కావాలి, ఎలా బుక్ చేయాలి?",
  "ధర ఎంత ఉంటుంది?"
];

async function runTests() {
  console.log("=== TESTING HUMANIZED VOICE AGENT INTELLIGENCE & CSAT ===\n");
  const agentId = "cmu40722800014r20hvl070n3"; // Flipkart Support Agent

  for (const utterance of testUtterances) {
    console.log(`\n🗣️ CUSTOMER SAYS: "${utterance}"`);
    const t0 = Date.now();
    try {
      const res = await fetch("http://127.0.0.1:3000/api/agent/turn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId,
          userUtterance: utterance,
          conversationHistory: [],
          customerPhone: "+916305367443"
        })
      });
      const data = await res.json();
      const elapsed = Date.now() - t0;
      console.log(`🤖 AGENT REPLAY: "${data.normalizedReply || data.rawReply}" (${elapsed}ms)`);
      if (data.qualityValidation?.wasModified) {
        console.log(`   [CSAT Quality Optimized]: ${data.qualityValidation.modificationReason}`);
      }
    } catch (err) {
      console.error(`❌ Error: ${err.message}`);
    }
  }
}

runTests();
