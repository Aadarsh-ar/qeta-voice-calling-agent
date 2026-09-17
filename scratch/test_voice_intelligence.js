async function run() {
  console.log('=== MULTI-TURN INTELLIGENCE & RELEVANCE TEST ===\n');

  const listRes = await fetch('http://localhost:3000/api/agents').then(r => r.json());
  const agent = listRes.agents && listRes.agents[0];
  if (!agent) {
    console.error('No agent found');
    process.exit(1);
  }
  console.log(`Testing Agent: ${agent.name} (${agent.id}), Language: ${agent.language}\n`);

  const conversationTurns = [
    {
      user: "హలో అండి, మీ సర్వీస్ గురించి చెప్పండి, మీరు ఏం చేస్తారు?",
      desc: "Turn 1: Service overview in Telugu"
    },
    {
      user: "మంచిదండి, మీ ప్రైసింగ్ ప్లాన్స్ ఎలా ఉన్నాయి? స్టార్టర్ ప్లాన్ ఎంత అవుతుంది?",
      desc: "Turn 2: Pricing inquiry in Telugu"
    },
    {
      user: "సరే, రేపు మార్నింగ్ 10:30 కి ఒక డెమో కాల్ షెడ్యూల్ చేయగలరా?",
      desc: "Turn 3: Demo scheduling inquiry"
    },
    {
      user: "నేను అడిగిన డెమో కన్ఫర్మ్ అయిందా అండి?",
      desc: "Turn 4: Context memory follow-up"
    }
  ];

  let history = [];

  for (let i = 0; i < conversationTurns.length; i++) {
    const { user, desc } = conversationTurns[i];
    console.log(`--- [${desc}] ---`);
    console.log(`Caller: "${user}"`);
    const start = Date.now();

    const res = await fetch('http://localhost:3000/api/agent/turn', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agentId: agent.id,
        userUtterance: user,
        conversationHistory: history,
        callSid: "test-call-session-123"
      })
    }).then(r => r.json());

    const elapsed = Date.now() - start;
    const reply = res.normalizedReply || res.rawReply || res.spokenText;
    if (res && reply) {
      console.log(`Agent:  "${reply}"`);
      console.log(`Latency: ${elapsed}ms | LLM: ${res.llmLatencyMs}ms`);
      console.log(`Snippets: ${res.retrievedSnippets ? res.retrievedSnippets.map(s => s.title).join(', ') : 'None'}`);
      
      // Accumulate history
      history.push({ role: 'user', content: user });
      history.push({ role: 'assistant', content: reply });
    } else {
      console.error(`Error in turn ${i + 1}:`, res);
    }
    console.log('');
  }

  console.log('=== TEST COMPLETED SUCCESSFULLY ===');
}

run().catch(console.error);
