import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const vobizAuthId = process.env.VOBIZ_AUTH_ID;
const vobizAuthToken = process.env.VOBIZ_AUTH_TOKEN;

async function checkUrl(testName, url) {
  const vobizApiUrl = `https://api.vobiz.ai/api/v1/Account/${vobizAuthId}/Call/`;
  const res = await fetch(vobizApiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Auth-ID": vobizAuthId,
      "X-Auth-Token": vobizAuthToken,
    },
    body: JSON.stringify({
      from: "+918071582667",
      to: "+916305367443",
      answer_url: url,
    }),
  });
  const data = await res.json();
  console.log(`[${testName}] Status: ${res.status}, Msg:`, data.error || data.message);
}

async function run() {
  await checkUrl('ngrok-free.app', 'https://test-subdomain.ngrok-free.app/answer');
  await checkUrl('ngrok.io', 'https://test-subdomain.ngrok.io/answer');
  await checkUrl('loca.lt', 'https://test-subdomain.loca.lt/answer');
  await checkUrl('pinggy.link', 'https://test-subdomain.a.pinggy.link/answer');
  await checkUrl('serveo.net', 'https://test-subdomain.serveo.net/answer');
}

run();
