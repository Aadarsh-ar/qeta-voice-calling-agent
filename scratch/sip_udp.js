const dgram = require("dgram");
const crypto = require("crypto");

function testSipUdp() {
  const socket = dgram.createSocket("udp4");
  const host = "65.2.100.211";
  const port = 5060;
  const domain = "f15a55c4.sip.vobiz.ai";
  const toNum = "+916305367443";
  const fromNum = "+911171366938";
  const username = "test key";
  const password = "80080315@Es";

  const callId = `udp-call-${Date.now()}@vaani.ai`;
  const fromTag = `tag-${Date.now()}`;
  let cseq = 1;
  let lastBranch = `z9hG4bK-${Date.now()}`;

  const sdp = [
    "v=0",
    `o=- ${Date.now()} ${Date.now()} IN IP4 157.50.74.174`,
    "s=Vaani Voice Call",
    "c=IN IP4 157.50.74.174",
    "t=0 0",
    "m=audio 16384 RTP/AVP 0 8 101",
    "a=rtpmap:0 PCMU/8000",
    "a=rtpmap:8 PCMA/8000",
    "a=rtpmap:101 telephone-event/8000",
    "a=sendrecv",
    "",
  ].join("\r\n");

  function makeInvite(authHeader = null) {
    lastBranch = `z9hG4bK-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const lines = [
      `INVITE sip:${toNum}@${domain} SIP/2.0`,
      `Via: SIP/2.0/UDP 157.50.74.174:5060;branch=${lastBranch};rport`,
      "Max-Forwards: 70",
      `To: <sip:${toNum}@${domain}>`,
      `From: <sip:${fromNum}@${domain}>;tag=${fromTag}`,
      `Call-ID: ${callId}`,
      `CSeq: ${cseq} INVITE`,
      `Contact: <sip:${encodeURIComponent(username)}@157.50.74.174:5060>`,
      "User-Agent: Vaani-AI/1.0",
      "Content-Type: application/sdp",
    ];
    if (authHeader) lines.push(authHeader);
    lines.push("Content-Length: " + Buffer.byteLength(sdp));
    lines.push("");
    lines.push(sdp);
    return lines.join("\r\n");
  }

  socket.on("message", (msg, rinfo) => {
    const text = msg.toString();
    const firstLine = text.split("\r\n")[0];
    console.log(`[UDP RECV from ${rinfo.address}:${rinfo.port}] => ${firstLine}`);

    if (text.includes("407")) {
      const headerMatch = text.match(/Proxy-Authenticate:\s*Digest\s+([^\r\n]+)/i);
      const toHeader = (text.match(/To:\s*([^\r\n]+)/i) || [])[1] || `<sip:${toNum}@${domain}>`;

      // ACK
      const ack = [
        `ACK sip:${toNum}@${domain} SIP/2.0`,
        `Via: SIP/2.0/UDP 157.50.74.174:5060;branch=${lastBranch};rport`,
        "Max-Forwards: 70",
        `To: ${toHeader}`,
        `From: <sip:${fromNum}@${domain}>;tag=${fromTag}`,
        `Call-ID: ${callId}`,
        `CSeq: ${cseq} ACK`,
        "Content-Length: 0",
        "",
        "",
      ].join("\r\n");
      socket.send(ack, port, host);

      if (headerMatch) {
        const challenge = headerMatch[1];
        const realmMatch = challenge.match(/realm="([^"]+)"/);
        const nonceMatch = challenge.match(/nonce="([^"]+)"/);
        const qopMatch = challenge.match(/qop="?([^",\s]+)"?/);

        const realm = realmMatch ? realmMatch[1] : domain;
        const nonce = nonceMatch ? nonceMatch[1] : "";
        const qop = qopMatch ? qopMatch[1] : null;

        const uri = `sip:${toNum}@${domain}`;
        const ha1 = crypto.createHash("md5").update(`${username}:${realm}:${password}`).digest("hex");
        const ha2 = crypto.createHash("md5").update(`INVITE:${uri}`).digest("hex");

        let authLine;
        if (qop) {
          const nc = "00000001";
          const cnonce = crypto.randomBytes(8).toString("hex");
          const response = crypto.createHash("md5").update(`${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}`).digest("hex");
          authLine = `Proxy-Authorization: Digest username="${username}", realm="${realm}", nonce="${nonce}", uri="${uri}", response="${response}", algorithm=MD5, qop=${qop}, nc=${nc}, cnonce="${cnonce}"`;
        } else {
          const response = crypto.createHash("md5").update(`${ha1}:${nonce}:${ha2}`).digest("hex");
          authLine = `Proxy-Authorization: Digest username="${username}", realm="${realm}", nonce="${nonce}", uri="${uri}", response="${response}", algorithm=MD5`;
        }

        cseq++;
        console.log("[UDP] Sending Authenticated INVITE...");
        const inv2 = makeInvite(authLine);
        socket.send(inv2, port, host);
      }
    } else {
      console.log("Full UDP Response:\n", text);
    }
  });

  socket.bind(() => {
    console.log("[UDP] Bound to local port. Sending initial INVITE to", host, port);
    const inv = makeInvite();
    socket.send(inv, port, host);
  });

  setTimeout(() => {
    socket.close();
    console.log("[UDP] Done.");
    process.exit(0);
  }, 6000);
}

testSipUdp();
