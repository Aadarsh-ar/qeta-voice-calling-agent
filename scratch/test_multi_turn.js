async function testMultiTurn() {
  console.log("=== MULTI-TURN CALL CONVERSATION TEST ===\n");
  const agentId = "cmu40722800014r20hvl070n3";

  // Step 1: Initial greeting already happened
  const history = [
    { role: "assistant", content: "హలో అండి! నేను మీ ఫ్లిప్‌కార్ట్ సపోర్ట్ ఏజెంట్‌ని. మీ ఆర్డర్ గురించి ఎలా సహాయపడగలను?" }
  ];

  // Turn 1: Customer asks about delayed order
  const user1 = "నా ఆర్డర్ ఇంకా రాలేదు, ఎప్పుడు వస్తుంది?";
  console.log(`Caller: "${user1}"`);
  let res = await fetch("http://127.0.0.1:3000/api/agent/turn", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      agentId,
      userUtterance: user1,
      conversationHistory: history,
      customerPhone: "+916305367443"
    })
  });
  let data = await res.json();
  let reply1 = data.normalizedReply || data.rawReply;
  console.log(`Agent: "${reply1}"\n`);
  history.push({ role: "user", content: user1 });
  history.push({ role: "assistant", content: reply1 });

  // Turn 2: Customer doesn't have order number
  const user2 = "నా దగ్గర నంబర్ లేదు, మీరే చెప్పండి";
  console.log(`Caller: "${user2}"`);
  res = await fetch("http://127.0.0.1:3000/api/agent/turn", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      agentId,
      userUtterance: user2,
      conversationHistory: history,
      customerPhone: "+916305367443"
    })
  });
  data = await res.json();
  let reply2 = data.normalizedReply || data.rawReply;
  console.log(`Agent: "${reply2}"\n`);
  history.push({ role: "user", content: user2 });
  history.push({ role: "assistant", content: reply2 });

  // Turn 3: Customer provides name
  const user3 = "నా పేరు రమేష్, మొబైల్ నంబర్ 9876543210";
  console.log(`Caller: "${user3}"`);
  res = await fetch("http://127.0.0.1:3000/api/agent/turn", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      agentId,
      userUtterance: user3,
      conversationHistory: history,
      customerPhone: "+916305367443"
    })
  });
  data = await res.json();
  let reply3 = data.normalizedReply || data.rawReply;
  console.log(`Agent: "${reply3}"\n`);
}

testMultiTurn();
