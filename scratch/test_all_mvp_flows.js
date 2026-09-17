import http from "http";

function request(url, options = {}, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(url, options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, body: data ? JSON.parse(data) : null, raw: data });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, raw: data });
        }
      });
    });
    req.on("error", reject);
    if (body) {
      req.write(typeof body === "string" ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log("==================================================");
  console.log("RUNNING COMPREHENSIVE VAANI AI ENTERPRISE SUITE");
  console.log("==================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition, msg) {
    if (condition) {
      console.log(`✅ PASS: ${msg}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${msg}`);
      failed++;
    }
  }

  // 1. Verify Typography & Google Fonts streaming
  console.log("--- 1. Testing AI Premium Typography & Google Fonts ---");
  try {
    const res = await request("http://localhost:3000/");
    assert(res.status === 200, "Dashboard loaded with HTTP 200");
    assert(res.raw.includes("Plus+Jakarta+Sans"), "Plus Jakarta Sans font embedded in head");
    assert(res.raw.includes("Outfit"), "Outfit font embedded in head for AI headings");
    assert(res.raw.includes("JetBrains+Mono"), "JetBrains Mono font embedded for telemetry & phone numbers");
    assert(res.raw.includes("Enterprise Voice Dashboard"), "Hero title uses high-end AI platform vocabulary");
  } catch (e) {
    assert(false, `Typography check failed: ${e.message}`);
  }

  // 2. Verify Zero Credentials in UI & Client Responses
  console.log("\n--- 2. Verifying Strict Zero-Credential Protection ---");
  try {
    const res = await request("http://localhost:3000/");
    assert(!res.raw.includes("sk_car_"), "No Cartesia API keys in HTML bundle");
    assert(!res.raw.includes("gsk_"), "No Groq API keys in HTML bundle");
    assert(!res.raw.includes("sk_scyog"), "No Sarvam API keys in HTML bundle");
    assert(!res.raw.includes("80080315@Es"), "No SIP passwords in HTML bundle");

    // Check outbound call response has no trunkId or sipDomain
    const callRes = await request("http://localhost:3000/api/calls/outbound", {
      method: "POST",
      headers: { "Content-Type": "application/json" }
    }, { phoneNumber: "+919849012345", agentId: "agent_telugu_sales" });
    assert(callRes.body?.success === true, "Outbound call succeeded");
    assert(callRes.body?.telephony?.trunkId === undefined, "Telephony trunkId hidden from client response");
    assert(callRes.body?.telephony?.sipDomain === undefined, "Telephony sipDomain hidden from client response");
  } catch (e) {
    assert(false, `Credential protection check failed: ${e.message}`);
  }

  // 3. Test Tools Execution Pipeline
  console.log("\n--- 3. Testing Enterprise Tools Execution Pipeline ---");
  const { executeToolCall } = require("../src/lib/agent/tools.ts");

  try {
    // Tool 1: book_appointment
    const aptRes = await executeToolCall("book_appointment", {
      appointmentDate: "రేపు",
      appointmentTime: "ఉదయం 11:30 AM",
      serviceType: "AI Voice Demo"
    });
    assert(aptRes.success === true, "Tool 'book_appointment' executed successfully");
    assert(aptRes.result?.status === "confirmed", "Appointment status confirmed");
    assert(aptRes.conversationalSummaryTelugu.includes("కన్ఫర్మ్"), `Appointment Telugu speech: "${aptRes.conversationalSummaryTelugu}"`);

    // Tool 2: check_pricing_plans
    const priceRes = await executeToolCall("check_pricing_plans", { planName: "starter" });
    assert(priceRes.success === true, "Tool 'check_pricing_plans' executed successfully");
    assert(priceRes.result?.starter?.monthly === 15000, "Pricing plan data retrieved accurately");
    assert(priceRes.conversationalSummaryTelugu.includes("15,000"), `Pricing Telugu speech: "${priceRes.conversationalSummaryTelugu}"`);

    // Tool 3: query_knowledge_base
    const kbRes = await executeToolCall("query_knowledge_base", { query: "office location" });
    assert(kbRes.success === true, "Tool 'query_knowledge_base' executed successfully");
    assert(kbRes.conversationalSummaryTelugu.includes("హైదరాబాద్") || kbRes.conversationalSummaryTelugu.includes("Hyderabad"), `Knowledge base speech: "${kbRes.conversationalSummaryTelugu}"`);

    // Tool 4: capture_customer_details
    const crmRes = await executeToolCall("capture_customer_details", {
      customerName: "Ramesh Kumar",
      phoneNumber: "+919876543210",
      requirement: "Telugu Customer Support AI"
    });
    assert(crmRes.success === true, "Tool 'capture_customer_details' executed successfully");
    assert(crmRes.result?.status === "saved_to_crm", "Lead recorded into CRM data store");

    // Tool 5: transfer_call
    const xferRes = await executeToolCall("transfer_call", { department: "sales", reason: "enterprise deal" });
    assert(xferRes.success === true, "Tool 'transfer_call' executed successfully");
    assert(xferRes.result?.status === "transferring", "Live transfer initiated");

    // Tool 6: end_call
    const endRes = await executeToolCall("end_call", { closingMessage: "ధన్యవాదాలు అండి!" });
    assert(endRes.success === true, "Tool 'end_call' executed successfully");
    assert(endRes.result?.status === "concluded", "Call termination handled gracefully");
  } catch (e) {
    assert(false, `Tools execution failed: ${e.message}`);
  }

  // 4. Test Conversational Turn Pipeline with Tool Trigger
  console.log("\n--- 4. Testing End-to-End Telugu Conversational Pipeline ---");
  try {
    const res = await request("http://localhost:3000/api/agent/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" }
    }, {
      agentId: "agent_telugu_sales",
      userMessage: "మాకు రేపు ఉదయం 10:30 కి డెమో కావాలి. షెడ్యూల్ చేయగలరా?"
    });

    assert(res.status === 200, "Agent test endpoint returned HTTP 200");
    assert(res.body && res.body.success === true, "Conversational turn processed successfully");
    assert(res.body?.rawReply && res.body.rawReply.length > 5, `Natural Telugu response: "${res.body?.rawReply.slice(0, 80)}..."`);
    assert(!!res.body?.audioBase64, `Synthesized Cartesia audio stream returned (${Math.round((res.body?.audioBase64?.length || 0)/1024)} KB PCM)`);
    assert(res.body?.latencies?.totalMs > 0, `Telemetry latencies recorded (Total: ${res.body?.latencies?.totalMs}ms)`);
  } catch (e) {
    assert(false, `Conversational pipeline test failed: ${e.message}`);
  }

  console.log("\n==================================================");
  console.log(`TOTAL SUITE RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log("==================================================");

  if (failed > 0) process.exit(1);
}

runTests();
