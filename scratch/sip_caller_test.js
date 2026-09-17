const crypto = require("crypto");
const net = require("net");

// Test with the correct Vobiz caller ID (+918071582667) and from number
async function placeCall(toNumber, fromNumber) {
  return new Promise((resolve) => {
    const domain = "f15a55c4.sip.vobiz.ai";
    const host = "65.2.100.211";
    const port = 5060;
    const username = "test key";
    const password = "80080315@Es";

    const toNum = toNumber.startsWith("+") ? toNumber : "+91" + toNumber.replace(/^(\+?91|0)/, "");
    const fromNum = fromNumber;

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

    console.log(`[SIP] Calling ${toNum} from ${fromNum}...`);
    const client = net.createConnection({ host, port }, () => {
      client.write(makeInvite());
    });

    let answered = false;

    client.on("data", (buf) => {
      const text = buf.toString();
      const firstLine = text.split("\r\n")[0];
      console.log(`[RECV] ${firstLine}`);

      if (text.includes("407") || text.includes("401")) {
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
      } else if (text.includes("180 Ringing") || text.includes("183")) {
        console.log(`\n🎉 PHONE IS RINGING! Call from ${fromNum} to ${toNum} — SUCCESS!`);
        answered = true;
        resolve({ success: true, status: "RINGING", from: fromNum, to: toNum });
      } else if (text.includes("200 OK")) {
        console.log(`\n🎉 CALL ANSWERED! from ${fromNum}`);
        answered = true;
        resolve({ success: true, status: "CONNECTED" });
      } else if (text.includes("403")) {
        console.log(`\n❌ 403 FORBIDDEN from ${fromNum}. Full:\n${text}`);
        answered = true;
        client.destroy();
        resolve({ success: false, status: "403", from: fromNum });
      }
    });

    client.on("error", (e) => resolve({ success: false, error: e.message }));
    setTimeout(() => {
      client.destroy();
      if (!answered) resolve({ success: false, status: "TIMEOUT" });
    }, 8000);
  });
}

async function main() {
  const target = "6305367443";

  // Test with the Vobiz DID number as caller ID
  console.log("\n=== TEST 1: Using +918071582667 as caller ID (Purchased Vobiz DID) ===");
  const r1 = await placeCall(target, "+918071582667");
  console.log("Result:", r1);

  if (!r1.success) {
    console.log("\n=== TEST 2: Using +911171366938 as caller ID (Previous) ===");
    const r2 = await placeCall(target, "+911171366938");
    console.log("Result:", r2);
  }
}

main().then(() => process.exit(0));
