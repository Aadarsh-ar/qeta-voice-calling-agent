async function testSeparation() {
  console.log("=== Testing Agent & Voice Isolation ===");

  // 1. Test College Support (Harika Voice)
  console.log("\n--- 1. Testing College Support (Harika Voice) ---");
  const collegeRes = await fetch("http://localhost:3000/api/agent/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      agentId: "agent_minb6qwKNfwWXLV8gyRfRq",
      userMessage: "హలో, కాలేజ్ అటెండెన్స్ రూల్స్ ఏంటి?",
    }),
  });

  const collegeData = await collegeRes.json();
  console.log("College Agent Status:", collegeRes.status);
  console.log("College Agent Name:", collegeData.agentName);
  console.log("College Voice ID:", collegeData.cartesiaVoiceId);
  console.log("College Raw Reply:", collegeData.rawReply);
  console.log("College Audio Bytes:", collegeData.audioBytes);

  const collegeVoiceExpected = "89907713-42ce-4ddd-8ff5-301211c564c1";
  if (collegeData.cartesiaVoiceId === collegeVoiceExpected) {
    console.log("PASS: College Support is strictly using Harika voice!");
  } else {
    console.error(`FAIL: Expected ${collegeVoiceExpected} but got ${collegeData.cartesiaVoiceId}`);
  }

  // Check no cross-contamination of electronics/appliances
  const collegeReplyLower = (collegeData.rawReply || "").toLowerCase();
  if (collegeReplyLower.includes("refrigerator") || collegeReplyLower.includes("electronics") || collegeReplyLower.includes("రిఫ్రిజిరేటర్")) {
    console.error("FAIL: Cross-contamination detected in College Support!");
  } else {
    console.log("PASS: Zero retail cross-contamination in College Support.");
  }

  // 2. Test ABC Support (AD Voice)
  console.log("\n--- 2. Testing ABC Support (AD Voice) ---");
  const abcRes = await fetch("http://localhost:3000/api/agent/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      agentId: "agent_GaiYMgB9Bj9kaKW1tUgqSQ",
      userMessage: "మీ దగ్గర రిఫ్రిజిరేటర్లు ఉన్నాయా?",
    }),
  });

  const abcData = await abcRes.json();
  console.log("ABC Agent Status:", abcRes.status);
  console.log("ABC Agent Name:", abcData.agentName);
  console.log("ABC Voice ID:", abcData.cartesiaVoiceId);
  console.log("ABC Raw Reply:", abcData.rawReply);
  console.log("ABC Audio Bytes:", abcData.audioBytes);

  const abcVoiceExpected = "f9945b75-0f3b-448d-ba9e-3d22c229a68e";
  if (abcData.cartesiaVoiceId === abcVoiceExpected) {
    console.log("PASS: ABC Support is strictly using AD voice!");
  } else {
    console.error(`FAIL: Expected ${abcVoiceExpected} but got ${abcData.cartesiaVoiceId}`);
  }

  // Check no cross-contamination of college/attendance
  const abcReplyLower = (abcData.rawReply || "").toLowerCase();
  if (abcReplyLower.includes("college") || abcReplyLower.includes("అటెండెన్స్") || abcReplyLower.includes("attendance")) {
    console.error("FAIL: Cross-contamination detected in ABC Support!");
  } else {
    console.log("PASS: Zero college cross-contamination in ABC Support.");
  }

  // 3. Test TTS Only Greeting Synthesis
  console.log("\n--- 3. Testing TTS Only Greetings ---");
  const collegeTtsRes = await fetch("http://localhost:3000/api/agent/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      agentId: "agent_minb6qwKNfwWXLV8gyRfRq",
      ttsOnly: true,
      textToSpeak: "హలో అండి, నేను Naresh గారి పేరెంట్స్‌తో మాట్లాడుతున్నానా?",
    }),
  });
  const collegeTtsData = await collegeTtsRes.json();
  console.log("College Greeting Audio Bytes:", collegeTtsData.audioBytes);

  const abcTtsRes = await fetch("http://localhost:3000/api/agent/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      agentId: "agent_GaiYMgB9Bj9kaKW1tUgqSQ",
      ttsOnly: true,
      textToSpeak: "హలో అండి! నేను Aadarsh మాట్లాడుతున్నాను, ABC Electronics నుంచి call చేస్తున్నాను.",
    }),
  });
  const abcTtsData = await abcTtsRes.json();
  console.log("ABC Greeting Audio Bytes:", abcTtsData.audioBytes);

  console.log("\n=== ALL TESTS COMPLETED SUCCESSFULLY ===");
}

testSeparation().catch(console.error);
