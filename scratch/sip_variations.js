const crypto = require("crypto");
const net = require("net");

async function testCombination({ name, toUri, fromUri, pai, fromTag = null }) {
  return new Promise((resolve) => {
    const domain = "f15a55c4.sip.vobiz.ai";
    const host = "65.2.100.211";
    const port = 5060;
    const username = "test key";
    const password = "80080315@Es";

    const callId = `call-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}@vaani.ai`;
    const myTag = fromTag || `tag-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
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
        `INVITE sip:${toUri}@${domain} SIP/2.0`,
        `Via: SIP/2.0/TCP 65.2.100.211:5060;branch=${lastBranch};rport`,
        "Max-Forwards: 70",
        `To: <sip:${toUri}@${domain}>`,
        `From: <sip:${fromUri}@${domain}>;tag=${myTag}`,
        `Call-ID: ${callId}`,
        `CSeq: ${cseq} INVITE`,
        `Contact: <sip:${encodeURIComponent(username)}@65.2.100.211:5060;transport=tcp>`,
      ];
      if (pai) {
        lines.push(`P-Asserted-Identity: <sip:${pai}@${domain}>`);
        lines.push(`Remote-Party-ID: <sip:${pai}@${domain}>;party=calling;screen=yes;privacy=off`);
      }
      lines.push("User-Agent: Vaani-AI-Carrier-Gateway/1.0");
      lines.push("Content-Type: application/sdp");
      if (authHeader) lines.push(authHeader);
      lines.push("Content-Length: " + Buffer.byteLength(sdp));
      lines.push("");
      lines.push(sdp);
      return lines.join("\r\n");
    }

    const client = net.createConnection({ host, port }, () => {
      client.write(makeInvite());
    });

    let answered = false;

    client.on("data", (buf) => {
      const text = buf.toString();
      const firstLine = text.split("\r\n")[0];

      if (text.includes("407 Proxy Authentication Required") || text.includes("401 Unauthorized")) {
        const isProxy = text.includes("407");
        const headerMatch = text.match(/(?:Proxy-Authenticate|WWW-Authenticate):\s*Digest\s+([^\r\n]+)/i);
        const toHeader = (text.match(/To:\s*([^\r\n]+)/i) || [])[1] || `<sip:${toUri}@${domain}>`;

        const ack = [
          `ACK sip:${toUri}@${domain} SIP/2.0`,
          `Via: SIP/2.0/TCP 65.2.100.211:5060;branch=${lastBranch};rport`,
          "Max-Forwards: 70",
          `To: ${toHeader}`,
          `From: <sip:${fromUri}@${domain}>;tag=${myTag}`,
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

          const uri = `sip:${toUri}@${domain}`;
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
      } else if (text.includes("180 Ringing") || text.includes("183 Session Progress") || text.includes("200 OK")) {
        console.log(`[SUCCESS] [${name}] => ${firstLine}`);
        answered = true;
        client.destroy();
        resolve({ success: true, status: firstLine });
      } else if (text.includes("403 Forbidden")) {
        const reasonHeader = (text.match(/Reason:\s*([^\r\n]+)/i) || [])[1];
        console.log(`[FAILED 403] [${name}] => ${reasonHeader ? "Reason: " + reasonHeader : "No reason header"}`);
        answered = true;
        client.destroy();
        resolve({ success: false, status: "403 Forbidden", reason: reasonHeader });
      } else if (!text.includes("100 Trying")) {
        console.log(`[MSG] [${name}] => ${firstLine}`);
      }
    });

    client.on("error", (err) => {
      if (!answered) resolve({ success: false, error: err.message });
    });

    setTimeout(() => {
      client.destroy();
      if (!answered) resolve({ success: false, status: "TIMEOUT" });
    }, 5000);
  });
}

async function main() {
  const variations = [
    { name: "To: +916305367443, From: +911171366938", toUri: "+916305367443", fromUri: "+911171366938" },
    { name: "To: 916305367443, From: 911171366938", toUri: "916305367443", fromUri: "911171366938" },
    { name: "To: 06305367443, From: 01171366938", toUri: "06305367443", fromUri: "01171366938" },
    { name: "To: 6305367443, From: 1171366938", toUri: "6305367443", fromUri: "1171366938" },
    { name: "From: test key, PAI: +911171366938", toUri: "+916305367443", fromUri: "test key", pai: "+911171366938" },
    { name: "From: test key, PAI: 911171366938", toUri: "916305367443", fromUri: "test key", pai: "911171366938" },
    { name: "From: trunkId, To: +916305367443", toUri: "+916305367443", fromUri: "f15a55c4-c30f-4d6c-ad17-ef9cfbf468bc", pai: "+911171366938" },
  ];

  for (const v of variations) {
    console.log(`\nTesting: ${v.name}`);
    const res = await testCombination(v);
    console.log("Result:", res);
    if (res.success) {
      console.log("FOUND WORKING CONFIGURATION!");
      break;
    }
  }
}

main().then(() => process.exit(0));
