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
  console.log(`[${testName}] Status: ${res.status}, Error/Msg:`, data.error || data.message || data);
}

async function run() {
  await checkUrl('trycloudflare domain root', 'https://played-appendix-legislative-happening.trycloudflare.com');
  await checkUrl('trycloudflare path', 'https://played-appendix-legislative-happening.trycloudflare.com/api/vobiz/incoming-call');
  await checkUrl('custom domain test', 'https://webhook.site/test');
}

run();
