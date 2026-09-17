import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const vobizAuthId = process.env.VOBIZ_AUTH_ID;
const vobizAuthToken = process.env.VOBIZ_AUTH_TOKEN;

async function testParam(name, bodyObj, isForm = false) {
  const vobizApiUrl = `https://api.vobiz.ai/api/v1/Account/${vobizAuthId}/Call/`;
  let headers = {
    "X-Auth-ID": vobizAuthId,
    "X-Auth-Token": vobizAuthToken,
  };
  let body;
  if (isForm) {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    body = new URLSearchParams(bodyObj).toString();
  } else {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(bodyObj);
  }

  const res = await fetch(vobizApiUrl, {
    method: "POST",
    headers,
    body,
  });

  const data = await res.json();
  console.log(`[${name}] Status: ${res.status}, Body:`, JSON.stringify(data));
}

async function run() {
  // Test A: Form urlencoded
  await testParam('Form urlencoded', {
    from: "+918071582667",
    to: "+916305367443",
    answer_url: "https://example.com/answer",
  }, true);

  // Test B: JSON with example.com
  await testParam('JSON example.com', {
    from: "+918071582667",
    to: "+916305367443",
    answer_url: "https://example.com/answer",
  }, false);

  // Test C: Basic Auth header instead of X-Auth-ID/Token
  const basicAuth = Buffer.from(`${vobizAuthId}:${vobizAuthToken}`).toString('base64');
  const resC = await fetch(`https://api.vobiz.ai/api/v1/Account/${vobizAuthId}/Call/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Basic ${basicAuth}`,
    },
    body: JSON.stringify({
      from: "+918071582667",
      to: "+916305367443",
      answer_url: "https://example.com/answer",
    }),
  });
  console.log('[Basic Auth Header]', resC.status, await resC.json());
}

run();
