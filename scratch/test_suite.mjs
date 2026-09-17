// Comprehensive End-to-End Test Suite for Vaani Voice AI Platform
import http from 'http';
import https from 'https';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, '..', '.env.local');
if (existsSync(envPath)) {
  const content = readFileSync(envPath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx > 0) {
        const key = trimmed.slice(0, eqIdx).trim();
        let value = trimmed.slice(eqIdx + 1).trim();
        if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
        if (!process.env[key]) process.env[key] = value;
      }
    }
  }
}

function fetchUrl(url, options = {}, body = null) {
  return new Promise((resolve, reject) => {
    const isHttps = url.startsWith('https:');
    const client = isHttps ? https : http;
    const req = client.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch (_) {}
        resolve({ status: res.statusCode, headers: res.headers, raw: data, json });
      });
    });
    req.on('error', reject);
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function runSuite() {
  console.log('================================================================');
  console.log('🧪 VAANI VOICE AI — COMPREHENSIVE END-TO-END TEST SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName, detail = '') {
    if (condition) {
      console.log(`✅ PASS: ${testName} ${detail ? `(${detail})` : ''}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName} ${detail ? `(${detail})` : ''}`);
      failed++;
    }
  }

  // --- 1. UI Page Routes ---
  console.log('\n--- 1. Testing UI Pages (HTTP 200) ---');
  const pages = [
    { path: '/', name: 'Dashboard' },
    { path: '/agents', name: 'Voice Agents' },
    { path: '/calls', name: 'Call History / Telephony' },
    { path: '/phone-numbers', name: 'Phone Numbers' },
    { path: '/analytics', name: 'Analytics' },
    { path: '/integrations', name: 'Integrations' },
    { path: '/settings', name: 'Settings' },
  ];

  for (const page of pages) {
    try {
      const res = await fetchUrl(`http://localhost:3000${page.path}`);
      assert(res.status === 200, `Page: ${page.name} (${page.path})`, `status: ${res.status}`);
    } catch (err) {
      assert(false, `Page: ${page.name} (${page.path})`, err.message);
    }
  }

  // --- 2. REST API Endpoints ---
  console.log('\n--- 2. Testing Core REST APIs ---');
  let discoveredAgentId = 'agent_GaiYMgB9Bj9kaKW1tUgqSQ';
  try {
    const agentsRes = await fetchUrl('http://localhost:3000/api/agents');
    assert(agentsRes.status === 200, 'GET /api/agents', `returned status 200`);
    const agentList = agentsRes.json?.agents || agentsRes.json;
    assert(Array.isArray(agentList), 'GET /api/agents returns list', `count: ${agentList?.length || 0}`);
    if (agentList && agentList.length > 0 && agentList[0].id) {
      discoveredAgentId = agentList[0].id;
    }
  } catch (e) {
    assert(false, 'GET /api/agents', e.message);
  }

  try {
    const phoneRes = await fetchUrl('http://localhost:3000/api/phone-numbers');
    assert(phoneRes.status === 200, 'GET /api/phone-numbers', `returned status 200`);
  } catch (e) {
    assert(false, 'GET /api/phone-numbers', e.message);
  }

  try {
    const callDetailRes = await fetchUrl('http://localhost:3000/api/calls/call_10284');
    assert(callDetailRes.status === 200, 'GET /api/calls/call_10284', `returned call details`);
    assert(callDetailRes.json?.call?.id === 'call_10284', 'Call ID matches call_10284');
  } catch (e) {
    assert(false, 'GET /api/calls/call_10284', e.message);
  }

  // --- 2b. Live Provider Integration Verification Endpoints ---
  console.log('\n--- 2b. Testing Live External Integration Verifications ---');
  const providersToTest = ['CARTESIA', 'GROQ', 'SARVAM', 'VOBIZ', 'POSTGRESQL'];
  for (const prov of providersToTest) {
    try {
      const testRes = await fetchUrl('http://localhost:3000/api/integrations/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, { provider: prov });

      assert(testRes.status === 200, `POST /api/integrations/test (${prov})`, `status: ${testRes.status}`);
      assert(testRes.json?.success === true, `Live check for ${prov} succeeded`, `${testRes.json?.latencyMs}ms`);
    } catch (e) {
      assert(false, `Integration test: ${prov}`, e.message);
    }
  }

  // --- 3. Conversational AI Agent Engine (Groq LLM + Cartesia TTS) ---
  console.log('\n--- 3. Testing Conversational AI Engine & Voice Synthesis ---');
  try {
    const testMsg = "నమస్కారం, మీ కంపెనీ వివరాలు చెప్పండి?";
    const agentTestRes = await fetchUrl('http://localhost:3000/api/agent/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      agentId: discoveredAgentId,
      userMessage: testMsg
    });

    assert(agentTestRes.status === 200, 'POST /api/agent/test status 200');
    assert(agentTestRes.json?.success === true, 'Agent pipeline returns success: true');
    assert(typeof agentTestRes.json?.rawReply === 'string' && agentTestRes.json.rawReply.length > 5, 'Agent returns natural Telugu LLM response', `"${agentTestRes.json?.rawReply?.slice(0, 50)}..."`);
    assert(!!agentTestRes.json?.audioBase64 && (agentTestRes.json?.audioBytes || agentTestRes.json?.audioBase64?.length) > 0, 'Cartesia TTS synthesizes voice audio payload (audioBytes > 0)', `Payload size: ${agentTestRes.json?.audioBytes || Math.round((agentTestRes.json?.audioBase64?.length || 0) / 1024)} bytes/KB`);
    if (agentTestRes.json?.latencies) {
      console.log(`   ℹ️ Latency breakdown: LLM: ${agentTestRes.json.latencies.llmMs}ms | TTS: ${agentTestRes.json.latencies.ttsMs}ms | Total: ${agentTestRes.json.latencies.totalMs}ms`);
    }
  } catch (e) {
    assert(false, 'POST /api/agent/test pipeline', e.message);
  }

  // --- 4. Vobiz Webhook Call Flow ---
  console.log('\n--- 4. Testing Vobiz Call Flow & XML Generation ---');
  try {
    const webhookRes = await fetchUrl('http://localhost:3000/api/vobiz/incoming-call', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    }, 'CallUUID=test-uuid-1234&From=+918071582667&To=+916305315808');

    assert(webhookRes.status === 200, 'POST /api/vobiz/incoming-call returns 200');
    assert(webhookRes.raw.includes('<Response>'), 'Returns valid Vobiz XML <Response>');
    assert(webhookRes.raw.includes('<Speak') || webhookRes.raw.includes('<Stream'), 'Returns audio execution command (<Speak> or <Stream>)');
  } catch (e) {
    assert(false, 'POST /api/vobiz/incoming-call', e.message);
  }

  try {
    const speechRes = await fetchUrl('http://localhost:3000/api/vobiz/handle-speech', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    }, 'Speech=నమస్కారం&CallUUID=test-uuid-1234');

    assert(speechRes.status === 200, 'POST /api/vobiz/handle-speech returns 200');
    assert(speechRes.raw.includes('<Response>'), 'Handle-speech returns valid Vobiz XML');
  } catch (e) {
    assert(false, 'POST /api/vobiz/handle-speech', e.message);
  }

  try {
    const statusRes = await fetchUrl('http://localhost:3000/api/vobiz/call-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    }, 'CallUUID=test-uuid-1234&Status=completed');

    assert(statusRes.status === 200, 'POST /api/vobiz/call-status returns 200');
  } catch (e) {
    assert(false, 'POST /api/vobiz/call-status', e.message);
  }

  // --- 5. Public Backend / Webhook URL Connectivity ---
  console.log('\n--- 5. Testing Public Backend / Webhook URL Connectivity ---');
  const publicBaseUrl = process.env.PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000';
  try {
    const statusRes = await fetchUrl(`${publicBaseUrl.replace(/\/+$/, '')}/api/vobiz/call-status`);
    assert(statusRes.status === 200, `Public Backend URL reachable (${publicBaseUrl})`, `HTTP ${statusRes.status}`);
  } catch (e) {
    assert(false, `Public Backend URL reachable (${publicBaseUrl})`, e.message);
  }

  console.log('\n================================================================');
  console.log(`📊 FINAL RESULT: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runSuite().catch(err => {
  console.error('Fatal suite error:', err);
  process.exit(1);
});
