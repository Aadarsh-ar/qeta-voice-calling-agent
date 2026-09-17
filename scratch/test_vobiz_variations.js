import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const vobizAuthId = process.env.VOBIZ_AUTH_ID;
const vobizAuthToken = process.env.VOBIZ_AUTH_TOKEN;
const publicUrl = process.env.NEXT_PUBLIC_SERVER_URL || "https://played-appendix-legislative-happening.trycloudflare.com";

async function test(name, answer_url, extra = {}) {
  const vobizApiUrl = `https://api.vobiz.ai/api/v1/Account/${vobizAuthId}/Call/`;
  const payload = {
    from: "+918071582667",
    to: "+916305367443",
    answer_url,
    ...extra
  };

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
  console.log(`[${name}] Status: ${res.status}, Body:`, JSON.stringify(data));
}

async function run() {
  // Test 1: Simple URL without query params
  await test('No Query Params', `${publicUrl}/api/vobiz/incoming-call`);

  // Test 2: With GET answer_method
  await test('GET method', `${publicUrl}/api/vobiz/incoming-call`, { answer_method: 'GET' });

  // Test 3: Without plus in phone number (e.g. 918071582667)
  const vobizApiUrl = `https://api.vobiz.ai/api/v1/Account/${vobizAuthId}/Call/`;
  const res3 = await fetch(vobizApiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Auth-ID": vobizAuthId,
      "X-Auth-Token": vobizAuthToken,
    },
    body: JSON.stringify({
      from: "918071582667",
      to: "916305367443",
      answer_url: `${publicUrl}/api/vobiz/incoming-call`,
    }),
  });
  console.log('[No Plus in Numbers]', res3.status, await res3.json());
}

run();
