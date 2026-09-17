const crypto = require("crypto");
const net = require("net");

// 503 Service Unavailable - this usually means:
// 1. No route to destination (DID not assigned/active to outbound trunk)
// 2. Need to link the purchased DID to the trunk in Vobiz console
// 3. Or the trunk needs to be enabled for PSTN outbound via +918071582667

// Let's check if 503 means the SIP trunk itself is not set up for outbound PSTN
// and test if the 403 was the IP ACL issue by now trying post-IP-whitelist

async function testSip503(fromNum) {
  return new Promise((resolve) => {
    const domain = "f15a55c4.sip.vobiz.ai";
    const host = "65.2.100.211";
    const port = 5060;
    const toNum = "+916305367443";
    const username = "test key";
    const password = "80080315@Es";

    const callId = `call-${Date.now()}@vaani.ai`;
    const fromTag = `tag-${Date.now()}`;
    let cseq = 1;
    let lastBranch = "z9hG4bK-" + Date.now();

    const sdp = [
      "v=0",
      `o=- ${Date.now()} ${Date.now()} IN IP4 65.2.100.211`,
      "s=Vaani AI", "c=IN IP4 65.2.100.211", "t=0 0",
      "m=audio 16384 RTP/AVP 0 8 101",
      "a=rtpmap:0 PCMU/8000", "a=rtpmap:8 PCMA/8000",
      "a=rtpmap:101 telephone-event/8000",
      "a=sendrecv", "",
    ].join("\r\n");

    function makeInvite(auth = null) {
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
        "User-Agent: Vaani-AI/1.0",
        "Content-Type: application/sdp",
      ];
      if (auth) lines.push(auth);
      lines.push("Content-Length: " + Buffer.byteLength(sdp));
      lines.push(""); lines.push(sdp);
      return lines.join("\r\n");
    }

    const client = net.createConnection({ host, port }, () => {
      client.write(makeInvite());
    });

    const received = [];
    client.on("data", (buf) => {
      const text = buf.toString();
      const fl = text.split("\r\n")[0];
      received.push(fl);
      console.log(`[FROM ${fromNum}] ${fl}`);

      if (text.includes("407") || text.includes("401")) {
        const isProxy = text.includes("407");
        const hm = text.match(/(?:Proxy-Authenticate|WWW-Authenticate):\s*Digest\s+([^\r\n]+)/i);
        const toH = (text.match(/To:\s*([^\r\n]+)/i) || [])[1] || `<sip:${toNum}@${domain}>`;
        const ack = [
          `ACK sip:${toNum}@${domain} SIP/2.0`,
          `Via: SIP/2.0/TCP 65.2.100.211:5060;branch=${lastBranch};rport`,
          "Max-Forwards: 70", `To: ${toH}`,
          `From: <sip:${fromNum}@${domain}>;tag=${fromTag}`,
          `Call-ID: ${callId}`, `CSeq: ${cseq} ACK`,
          "Content-Length: 0", "", "",
        ].join("\r\n");
        client.write(ack);
        if (hm) {
          const ch = hm[1];
          const realm = (ch.match(/realm="([^"]+)"/) || [])[1] || domain;
          const nonce = (ch.match(/nonce="([^"]+)"/) || [])[1] || "";
          const qop = (ch.match(/qop="?([^",\s]+)"?/) || [])[1] || null;
          const uri = `sip:${toNum}@${domain}`;
          const ha1 = crypto.createHash("md5").update(`${username}:${realm}:${password}`).digest("hex");
          const ha2 = crypto.createHash("md5").update(`INVITE:${uri}`).digest("hex");
          const nc = "00000001";
          const cn = crypto.randomBytes(8).toString("hex");
          const resp = qop
            ? crypto.createHash("md5").update(`${ha1}:${nonce}:${nc}:${cn}:${qop}:${ha2}`).digest("hex")
            : crypto.createHash("md5").update(`${ha1}:${nonce}:${ha2}`).digest("hex");
          const authLine = qop
            ? `${isProxy ? "Proxy-Authorization" : "Authorization"}: Digest username="${username}", realm="${realm}", nonce="${nonce}", uri="${uri}", response="${resp}", algorithm=MD5, qop=${qop}, nc=${nc}, cnonce="${cn}"`
            : `${isProxy ? "Proxy-Authorization" : "Authorization"}: Digest username="${username}", realm="${realm}", nonce="${nonce}", uri="${uri}", response="${resp}", algorithm=MD5`;
          cseq++;
          client.write(makeInvite(authLine));
        }
      } else if (text.includes("180 Ringing") || text.includes("183")) {
        console.log(`\n🎉🎉 RINGING! Phone ringing at ${toNum}!`);
        client.destroy();
        resolve({ success: true, status: "RINGING", received });
      } else if (text.includes("200 OK")) {
        console.log(`\n🎉🎉 ANSWERED!`);
        client.destroy();
        resolve({ success: true, status: "CONNECTED", received });
      } else if (text.includes("503")) {
        const retryAfter = text.match(/Retry-After:\s*(\d+)/i);
        console.log(`[503] Service Unavailable${retryAfter ? ` (retry after ${retryAfter[1]}s)` : ""}`);
        console.log("Full 503:\n", text);
        client.destroy();
        resolve({ success: false, status: "503", received });
      }
    });

    client.on("error", (e) => resolve({ success: false, error: e.message }));
    setTimeout(() => { client.destroy(); resolve({ success: false, status: "TIMEOUT", received }); }, 6000);
  });
}

async function main() {
  console.log("=== Testing post IP-ACL whitelist ===\n");
  const r = await testSip503("+918071582667");
  console.log("Received messages:", r.received);
  console.log("\nConclusion:", r.status === "503"
    ? "503 = Trunk not configured for outbound PSTN, or DID not assigned to trunk route. \nFix: In Vobiz console → SIP Trunking → Outbound Trunks → assign the DID +918071582667 as the CallerID for the trunk."
    : r.status);
}
main().then(() => process.exit(0));
