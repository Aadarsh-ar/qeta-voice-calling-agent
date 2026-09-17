async function probeVobizApi() {
  const urls = [
    "https://api.vobiz.ai/api/v1/Account/",
    "https://api.vobiz.ai/api/v1/auth/me",
    "https://api.vobiz.ai/api/v1/Account/f15a55c4-c30f-4d6c-ad17-ef9cfbf468bc/",
    "https://api.vobiz.ai/api/v1/Account/f15a55c4-c30f-4d6c-ad17-ef9cfbf468bc/Call/",
  ];

  const authCombinations = [
    { id: "test key", token: "80080315@Es" },
    { id: "f15a55c4-c30f-4d6c-ad17-ef9cfbf468bc", token: "80080315@Es" },
    { id: "f15a55c4", token: "80080315@Es" },
  ];

  for (const cred of authCombinations) {
    for (const url of urls) {
      try {
        const res = await fetch(url, {
          method: "GET",
          headers: {
            "X-Auth-ID": cred.id,
            "X-Auth-Token": cred.token,
            "Content-Type": "application/json",
          },
        });
        const body = await res.text();
        console.log(`[API PROBE] (${cred.id}) -> ${url} => ${res.status}: ${body.slice(0, 150)}`);
      } catch (e) {
        console.log(`[API PROBE ERR] ${url}: ${e.message}`);
      }
    }
  }
}

probeVobizApi();
