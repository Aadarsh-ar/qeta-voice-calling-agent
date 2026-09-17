async function testModalRoute() {
  console.log('=== TESTING BROWSER MODAL ENDPOINT (/api/agent/test) ===\n');

  const listRes = await fetch('http://localhost:3000/api/agents').then(r => r.json());
  const agent = listRes.agents && listRes.agents[0];
  
  const payload = {
    agentId: agent.id,
    userMessage: "మీరు ఏ ఏ భాషల్లో సేవలు అందిస్తారు?",
    conversationHistory: [
      { role: "user", content: "హలో అండి" },
      { role: "assistant", content: "నమస్కారం! నేను QETADOTIN నుండి మాట్లాడుతున్నాను. మీకు ఎలా సహాయపడగలను?" }
    ]
  };

  const start = Date.now();
  const res = await fetch('http://localhost:3000/api/agent/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }).then(r => r.json());

  const elapsed = Date.now() - start;
  console.log(`Success: ${res.success}`);
  console.log(`Agent reply: "${res.rawReply}"`);
  console.log(`Normalized:  "${res.normalizedReply}"`);
  console.log(`Total Latency: ${elapsed}ms (LLM: ${res.latencies?.llmMs}ms, TTS: ${res.latencies?.ttsMs}ms)`);
  console.log(`Audio Base64 length: ${res.audioBase64?.length || 0} bytes`);
}

testModalRoute().catch(console.error);
