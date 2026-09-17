const crypto = require("crypto");
const net = require("net");

function testFullCallFlow(toPhoneNumber) {
  const domain = "f15a55c4.sip.vobiz.ai";
  const host = "65.2.100.211";
  const port = 5060;
  const fromNum = "+911171366938";
  const toNum = toPhoneNumber.startsWith("+") ? toPhoneNumber : "+91" + toPhoneNumber.replace(/^(\+?91|0)/, "");
  const username = "test key";
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

  console.log(`[SIP] Connecting to Vobiz Gateway ${host}:${port}...`);
  const client = net.createConnection({ host, port }, () => {
    console.log(`[SIP] Connected. Sending Initial INVITE to ${toNum}...`);
    client.write(makeInvite());
  });

  client.on("data", (buf) => {
    const text = buf.toString();
    console.log("\n--- [VOBIZ INCOMING MESSAGE] ---\n" + text + "\n-------------------------------");

    if (text.includes("407 Proxy Authentication Required") || text.includes("401 Unauthorized")) {
      const isProxy = text.includes("407");
      const headerMatch = text.match(/(?:Proxy-Authenticate|WWW-Authenticate):\s*Digest\s+([^\r\n]+)/i);
      const toHeader = (text.match(/To:\s*([^\r\n]+)/i) || [])[1] || `<sip:${toNum}@${domain}>`;

      // ACK the 407 challenge
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
        const realm = realmMatch ? realmMatch[1] : domain;
        const nonce = nonceMatch ? nonceMatch[1] : "";

        const uri = `sip:${toNum}@${domain}`;
        const ha1 = crypto.createHash("md5").update(`${username}:${realm}:${password}`).digest("hex");
        const ha2 = crypto.createHash("md5").update(`INVITE:${uri}`).digest("hex");
        const response = crypto.createHash("md5").update(`${ha1}:${nonce}:${ha2}`).digest("hex");

        const authLine = `${isProxy ? "Proxy-Authorization" : "Authorization"}: Digest username="${username}", realm="${realm}", nonce="${nonce}", uri="${uri}", response="${response}", algorithm=MD5`;

        cseq++;
        console.log(`[SIP] Sending Authenticated INVITE (CSeq ${cseq})...`);
        client.write(makeInvite(authLine));
      }
    } else if (text.includes("200 OK")) {
      console.log("🎉 CALL ANSWERED / CONNECTED! Sending ACK to establish session...");
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
    }
  });

  client.on("error", (err) => {
    console.error("[SIP Error]:", err.message);
  });

  client.on("close", () => {
    console.log("[SIP] Socket closed by remote host or local");
  });

  // Keep alive for 12 seconds to trace
  setTimeout(() => {
    console.log("[SIP] 12s elapsed. Closing test socket.");
    client.destroy();
  }, 12000);
}

testFullCallFlow("6305367443");
