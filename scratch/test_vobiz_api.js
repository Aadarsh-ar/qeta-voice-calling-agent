import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const vobizAuthId = process.env.VOBIZ_AUTH_ID;
const vobizAuthToken = process.env.VOBIZ_AUTH_TOKEN;
const publicUrl = process.env.NEXT_PUBLIC_SERVER_URL || "https://played-appendix-legislative-happening.trycloudflare.com";

console.log('Testing Vobiz API without ring_url...');
console.log('Vobiz Auth ID:', vobizAuthId);

async function testCall() {
  const vobizApiUrl = `https://api.vobiz.ai/api/v1/Account/${vobizAuthId}/Call/`;
  const answerUrl = `${publicUrl}/api/vobiz/incoming-call?agentId=cmu3vwach00034r98dvgsyjy6&callerNumber=%2B916305367443`;

  const payload = {
    from: "+918071582667",
    to: "+916305367443",
    answer_url: answerUrl,
    answer_method: "POST",
    hangup_url: `${publicUrl}/api/vobiz/call-status`,
    hangup_method: "POST",
  };

  console.log('Payload:', JSON.stringify(payload, null, 2));

  try {
    const res = await fetch(vobizApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Auth-ID": vobizAuthId,
        "X-Auth-Token": vobizAuthToken,
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    console.log(`Status: ${res.status}`);
    console.log('Response:', JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Fetch error:', err);
  }
}

testCall();
