const crypto = require("crypto");
const net = require("net");

async function placeVobizCall(toNumber) {
  return new Promise((resolve) => {
    const domain = "f15a55c4.sip.vobiz.ai";
    const host = "65.2.100.211";
    const port = 5060;
    // Updated credentials from Vobiz console
    const username = "qeta_voice_user";
    const password = "QetaVoice2026!";
    const fromNum = "+918071582667"; // Purchased Vobiz DID

    const toNum = toNumber.startsWith("+") ? toNumber : "+91" + toNumber.replace(/^(\+?91|0)/, "");
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
        "User-Agent: Vaani-AI-Voice-Engine/1.0",
        "Content-Type: application/sdp",
      ];
      if (authHeader) lines.push(authHeader);
      lines.push("Content-Length: " + Buffer.byteLength(sdp));
      lines.push("");
      lines.push(sdp);
      return lines.join("\r\n");
    }

    console.log(`[VOBIZ] Placing call from ${fromNum} (qeta_voice_user) to ${toNum}...`);
    const client = net.createConnection({ host, port }, () => {
      client.write(makeInvite());
    });

    let isResolved = false;

    client.on("data", (buf) => {
      const text = buf.toString();
      const firstLine = text.split("\r\n")[0];
      console.log(`[RECV] ${firstLine}`);

      if (text.includes("407 Proxy Authentication Required") || text.includes("401 Unauthorized")) {
        const isProxy = text.includes("407");
        const headerMatch = text.match(/(?:Proxy-Authenticate|WWW-Authenticate):\s*Digest\s+([^\r\n]+)/i);
        const toHeader = (text.match(/To:\s*([^\r\n]+)/i) || [])[1] || `<sip:${toNum}@${domain}>`;

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
          const realm = (challenge.match(/realm="([^"]+)"/) || [])[1] || domain;
          const nonce = (challenge.match(/nonce="([^"]+)"/) || [])[1] || "";
          const qop = (challenge.match(/qop="?([^",\s]+)"?/) || [])[1] || null;

          const uri = `sip:${toNum}@${domain}`;
          const ha1 = crypto.createHash("md5").update(`${username}:${realm}:${password}`).digest("hex");
          const ha2 = crypto.createHash("md5").update(`INVITE:${uri}`).digest("hex");

          let authLine;
          if (qop) {
            const nc = "00000001";
            const cnonce = crypto.randomBytes(8).toString("hex");
            const response = crypto.createHash("md5").update(`${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}`).digest("hex");
            authLine = `${isProxy ? "Proxy-Authorization" : "Authorization"}: Digest username="${username}", realm="${realm}", nonce="${nonce}", uri="${uri}", response="${response}", algorithm=MD5, qop=${qop}, nc=${nc}, cnonce="${cnonce}"`;
          } else {
            const response = crypto.createHash("md5").update(`${ha1}:${nonce}:${ha2}`).digest("hex");
            authLine = `${isProxy ? "Proxy-Authorization" : "Authorization"}: Digest username="${username}", realm="${realm}", nonce="${nonce}", uri="${uri}", response="${response}", algorithm=MD5`;
          }

          cseq++;
          client.write(makeInvite(authLine));
        }
      } else if (text.includes("180 Ringing") || text.includes("183 Session Progress")) {
        console.log(`\n🎉🎉🎉 YOUR PHONE IS RINGING! Call to ${toNum} CONNECTED via Vobiz!`);
        if (!isResolved) {
          isResolved = true;
          resolve({ success: true, status: "RINGING", to: toNum, from: fromNum });
        }
      } else if (text.includes("200 OK")) {
        console.log(`\n🎉🎉🎉 CALL ANSWERED!`);
        if (!isResolved) {
          isResolved = true;
          resolve({ success: true, status: "CONNECTED" });
        }
      } else if (text.includes("403 Forbidden")) {
        console.log("\n❌ 403 - IP still blocked. IP ACL may not have saved.\nFull:\n", text);
        if (!isResolved) {
          isResolved = true;
          resolve({ success: false, status: "403 Forbidden - IP ACL issue" });
        }
      } else if (text.includes("503 Service Unavailable")) {
        console.log("\n❌ 503 - No route / DID not assigned to trunk PSTN route.\nFull:\n", text);
        if (!isResolved) {
          isResolved = true;
          resolve({ success: false, status: "503 Service Unavailable - No PSTN route" });
        }
      }
    });

    client.on("error", (e) => {
      if (!isResolved) {
        isResolved = true;
        resolve({ success: false, error: e.message });
      }
    });

    setTimeout(() => {
      client.destroy();
      if (!isResolved) {
        isResolved = true;
        resolve({ success: false, status: "TIMEOUT" });
      }
    }, 9000);
  });
}

const target = process.argv[2] || "6305367443";
console.log(`\n==============================`);
console.log(`Vobiz Live Call Test`);
console.log(`Credential: qeta_voice_user`);
console.log(`Target: ${target}`);
console.log(`==============================\n`);

placeVobizCall(target).then((result) => {
  console.log("\nFinal Result:", result);
  process.exit(0);
});
