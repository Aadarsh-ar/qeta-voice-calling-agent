/**
 * Test Vobiz outbound call using Cloudflare tunnel
 */

const VOBIZ_AUTH_ID = "MA_1YIFMW7C";
const VOBIZ_AUTH_TOKEN = "lTaYGZRO9Hpj6XRxvVdiirEcY1yBdiypslLbX5dv9ZQHnjvlqUbf8giYH8hbQvtF";
const FROM = "+918071582667";
const TO = "+916305367443";
const PUBLIC_URL = "https://played-appendix-legislative-happening.trycloudflare.com";

async function makeCall() {
  const url = `https://api.vobiz.ai/api/v1/Account/${VOBIZ_AUTH_ID}/Call/`;
  
  console.log("════════════════════════════════════════════════════");
  console.log("  Vobiz AI Agent Call — Cloudflare Tunnel");
  console.log("════════════════════════════════════════════════════");
  console.log(`  From:       ${FROM}`);
  console.log(`  To:         ${TO}`);
  console.log(`  Answer URL: ${PUBLIC_URL}/api/vobiz/incoming-call`);
  console.log(`  Stream URL: wss://...trycloudflare.com/api/vobiz/stream`);
  console.log("════════════════════════════════════════════════════\n");

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Auth-ID": VOBIZ_AUTH_ID,
      "X-Auth-Token": VOBIZ_AUTH_TOKEN,
    },
    body: JSON.stringify({
      from: FROM,
      to: TO,
      answer_url: `${PUBLIC_URL}/api/vobiz/incoming-call`,
      answer_method: "POST",
      hangup_url: `${PUBLIC_URL}/api/vobiz/call-status`,
      hangup_method: "POST",
    }),
  });

  const data = await res.json();
  console.log(`[API] ${res.status}:`, JSON.stringify(data, null, 2));
  
  if (res.ok) {
    console.log("\n🎉 Call queued! Listen for your phone to ring...");
    console.log("   When you answer, the AI agent should speak in Telugu!");
  }
}

makeCall();
