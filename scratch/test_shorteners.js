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
  console.log(`[${testName}] Status: ${res.status}, Msg:`, data.error || data.message || data);
}

async function run() {
  await checkUrl('short trycloudflare', 'https://a.trycloudflare.com/call');
  await checkUrl('cloudflare.com', 'https://cloudflare.com/call');
  await checkUrl('tinyurl or shortener', 'https://tinyurl.com/vaani-call');
  await checkUrl('is.gd shortener', 'https://is.gd/vaani1');
  await checkUrl('bit.ly shortener', 'https://bit.ly/vaani1');
}

run();
