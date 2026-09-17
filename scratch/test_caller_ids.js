const crypto = require("crypto");
const net = require("net");

async function testCallerId(fromNum) {
  return new Promise((resolve) => {
    const domain = "f15a55c4.sip.vobiz.ai";
    const host = "65.2.100.211";
    const port = 5060;
    const toNum = "+916305367443";
    const username = "test key";
    const password = "80080315@Es";

    const callId = `call-${Date.now()}@vaani.ai`;
    const myTag = `tag-${Date.now()}`;
    let cseq = 1;
    let lastBranch = "z9hG4bK-" + Date.now();

    const sdp = [
      "v=0",
      `o=- ${Date.now()} ${Date.now()} IN IP4 65.2.100.211`,
      "s=Vaani Call",
      "c=IN IP4 65.2.100.211",
      "t=0 0",
      "m=audio 16384 RTP/AVP 0 8 101",
      "a=rtpmap:0 PCMU/8000",
      "a=rtpmap:8 PCMA/8000",
      "a=rtpmap:101 telephone-event/8000",
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
        `From: <sip:${fromNum}@${domain}>;tag=${myTag}`,
        `Call-ID: ${callId}`,
        `CSeq: ${cseq} INVITE`,
        `Contact: <sip:${encodeURIComponent(username)}@65.2.100.211:5060;transport=tcp>`,
        "Content-Type: application/sdp",
      ];
      if (authHeader) lines.push(authHeader);
      lines.push("Content-Length: " + Buffer.byteLength(sdp));
      lines.push("");
      lines.push(sdp);
      return lines.join("\r\n");
    }

    const client = net.createConnection({ host, port }, () => {
      client.write(makeInvite());
    });

    client.on("data", (buf) => {
      const text = buf.toString();
      const firstLine = text.split("\r\n")[0];

      if (text.includes("407")) {
        const headerMatch = text.match(/Proxy-Authenticate:\s*Digest\s+([^\r\n]+)/i);
        const toHeader = (text.match(/To:\s*([^\r\n]+)/i) || [])[1] || `<sip:${toNum}@${domain}>`;

        const ack = [
          `ACK sip:${toNum}@${domain} SIP/2.0`,
          `Via: SIP/2.0/TCP 65.2.100.211:5060;branch=${lastBranch};rport`,
          "Max-Forwards: 70",
          `To: ${toHeader}`,
          `From: <sip:${fromNum}@${domain}>;tag=${myTag}`,
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

          const nc = "00000001";
          const cnonce = crypto.randomBytes(8).toString("hex");
          const response = crypto.createHash("md5").update(`${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}`).digest("hex");
          const authLine = `Proxy-Authorization: Digest username="${username}", realm="${realm}", nonce="${nonce}", uri="${uri}", response="${response}", algorithm=MD5, qop=${qop}, nc=${nc}, cnonce="${cnonce}"`;

          cseq++;
          client.write(makeInvite(authLine));
        }
      } else if (text.includes("180 Ringing") || text.includes("183 Session Progress") || text.includes("200 OK")) {
        console.log(`🎉 [SUCCESS with ${fromNum}] => ${firstLine}`);
        client.destroy();
        resolve(true);
      } else if (text.includes("403")) {
        console.log(`[403 Forbidden with ${fromNum}]`);
        client.destroy();
        resolve(false);
      }
    });

    client.on("error", () => resolve(false));
    setTimeout(() => { client.destroy(); resolve(false); }, 4000);
  });
}

async function test() {
  const numbers = ["+911171366938", "+918047359182", "+914068294410", "6305367443"];
  for (const n of numbers) {
    await testCallerId(n);
  }
}

test().then(() => process.exit(0));
