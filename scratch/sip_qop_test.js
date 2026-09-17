const crypto = require("crypto");
const net = require("net");

function testCallWithQop(toPhoneNumber, username = "test key") {
  return new Promise((resolve) => {
    const domain = "f15a55c4.sip.vobiz.ai";
    const host = "65.2.100.211";
    const port = 5060;
    const fromNum = "+911171366938";
    const toNum = toPhoneNumber.startsWith("+") ? toPhoneNumber : "+91" + toPhoneNumber.replace(/^(\+?91|0)/, "");
    const password = "80080315@Es";

    const callId = `call-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}@vaani.ai`;
    const fromTag = `tag-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    let cseq = 1;
    let lastBranch = "z9hG4bK-" + Date.now();

    const sdp = [
      "v=0",
      `o=- ${Date.now()} ${Date.now()} IN IP4 65.2.100.211`,
      "s=Vaani AI Voice Call",
      "c=IN IP4 65.2.100.211",
      "t=0 0",
      "m=audio 16384 RTP/AVP 0 8 101",
      "a=rtpmap:0 PCMU/8000",
      "a=rtpmap:8 PCMA/8000",
      "a=rtpmap:101 telephone-event/8000",
      "a=fmtp:101 0-16",
      "a=sendrecv",
      "",
    ].join("\r\n");

    function makeInvite(authHeader = null) {
      lastBranch = "z9hG4bK-" + Date.now() + "-" + Math.floor(Math.random() * 1000);
      const lines = [
        `INVITE sip:${toNum}@${domain} SIP/2.0`,
        `Via: SIP/2.0/TCP 65.2.100.211:5060;branch=${lastBranch};rport`,
        "Max-Forwards: 70",
        `To: <sip:${toNum}@${domain}>`,
        `From: <sip:${fromNum}@${domain}>;tag=${fromTag}`,
        `Call-ID: ${callId}`,
        `CSeq: ${cseq} INVITE`,
        `Contact: <sip:${encodeURIComponent(username)}@65.2.100.211:5060;transport=tcp>`,
        "User-Agent: Vaani-AI-Carrier-Gateway/1.0",
        "Content-Type: application/sdp",
      ];
      if (authHeader) lines.push(authHeader);
      lines.push("Content-Length: " + Buffer.byteLength(sdp));
      lines.push("");
      lines.push(sdp);
      return lines.join("\r\n");
    }

    console.log(`[SIP] Connecting to Vobiz Gateway ${host}:${port} for ${toNum} (User: "${username}")...`);
    const client = net.createConnection({ host, port }, () => {
      console.log(`[SIP] Connected. Sending Initial INVITE...`);
      client.write(makeInvite());
    });

    client.on("data", (buf) => {
      const text = buf.toString();
      const firstLine = text.split("\r\n")[0];
      console.log(`\n[VOBIZ RESPONSE] ${firstLine}`);

      if (text.includes("407 Proxy Authentication Required") || text.includes("401 Unauthorized")) {
        const isProxy = text.includes("407");
        const headerMatch = text.match(/(?:Proxy-Authenticate|WWW-Authenticate):\s*Digest\s+([^\r\n]+)/i);
        const toHeader = (text.match(/To:\s*([^\r\n]+)/i) || [])[1] || `<sip:${toNum}@${domain}>`;

        // Send ACK
        const ack = [
          `ACK sip:${toNum}@${domain} SIP/2.0`,
          `Via: SIP/2.0/TCP 65.2.100.211:5060;branch=${lastBranch};rport`,
          "Max-Forwards: 70",
          `To: ${toHeader}`,
          `From: <sip:${fromNum}@${domain}>;tag=${fromTag}`,
          `Call-ID: ${callId}`,
          `CSeq: ${cseq} ACK`,
          "Content-Length: 0",
          "",
          "",
        ].join("\r\n");
        client.write(ack);

        if (headerMatch) {
          const challenge = headerMatch[1];
          const realmMatch = challenge.match(/realm="([^"]+)"/);
          const nonceMatch = challenge.match(/nonce="([^"]+)"/);
          const qopMatch = challenge.match(/qop="?([^",\s]+)"?/);

          const realm = realmMatch ? realmMatch[1] : domain;
          const nonce = nonceMatch ? nonceMatch[1] : "";
          const qop = qopMatch ? qopMatch[1] : null;

          console.log(`[SIP] Challenge parsed: realm=${realm}, nonce=${nonce.slice(0, 12)}..., qop=${qop}`);

          const uri = `sip:${toNum}@${domain}`;
          const ha1 = crypto.createHash("md5").update(`${username}:${realm}:${password}`).digest("hex");
          const ha2 = crypto.createHash("md5").update(`INVITE:${uri}`).digest("hex");

          let response;
          let authLine;

          if (qop) {
            const nc = "00000001";
            const cnonce = crypto.randomBytes(8).toString("hex");
            response = crypto.createHash("md5").update(`${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}`).digest("hex");
            authLine = `${isProxy ? "Proxy-Authorization" : "Authorization"}: Digest username="${username}", realm="${realm}", nonce="${nonce}", uri="${uri}", response="${response}", algorithm=MD5, qop=${qop}, nc=${nc}, cnonce="${cnonce}"`;
          } else {
            response = crypto.createHash("md5").update(`${ha1}:${nonce}:${ha2}`).digest("hex");
            authLine = `${isProxy ? "Proxy-Authorization" : "Authorization"}: Digest username="${username}", realm="${realm}", nonce="${nonce}", uri="${uri}", response="${response}", algorithm=MD5`;
          }

          cseq++;
          console.log(`[SIP] Sending Authenticated INVITE (with RFC 2617 qop digest)...`);
          client.write(makeInvite(authLine));
        }
      } else if (text.includes("180 Ringing") || text.includes("183 Session Progress")) {
        console.log(`🎉🎉🎉 TARGET PHONE IS RINGING! (${firstLine})`);
        resolve({ success: true, status: firstLine });
      } else if (text.includes("200 OK")) {
        console.log(`🎉🎉🎉 CALL ANSWERED! (${firstLine})`);
        resolve({ success: true, status: firstLine });
      } else if (text.includes("403 Forbidden")) {
        console.log("❌ 403 Forbidden received. Full header:\n", text);
        resolve({ success: false, status: "403 Forbidden", text });
      } else {
        console.log("Message:\n", text);
      }
    });

    client.on("error", (err) => {
      console.error("Socket error:", err.message);
      resolve({ success: false, error: err.message });
    });

    setTimeout(() => {
      client.destroy();
      resolve({ success: false, timeout: true });
    }, 15000);
  });
}

async function run() {
  console.log("=== ATTEMPT 1: username = 'test key' ===");
  const r1 = await testCallWithQop("6305367443", "test key");
  if (!r1.success) {
    console.log("\n=== ATTEMPT 2: username = 'f15a55c4-c30f-4d6c-ad17-ef9cfbf468bc' (Trunk ID) ===");
    await testCallWithQop("6305367443", "f15a55c4-c30f-4d6c-ad17-ef9cfbf468bc");
  }
}

run().then(() => process.exit(0));
