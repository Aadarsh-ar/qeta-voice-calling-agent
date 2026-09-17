require('dotenv').config({ path: '.env.local' });
const { WebSocket } = require('ws');

async function testOfficialProtocol() {
  const apiKey = process.env.CARTESIA_API_KEY;
  console.log('Connecting to wss://api.cartesia.ai/agents/stream/agent_Pv4hHbMWRubDumrq4v4L15 ...');
  const ws = new WebSocket('wss://api.cartesia.ai/agents/stream/agent_Pv4hHbMWRubDumrq4v4L15?cartesia_version=2026-08-14', {
    headers: {
      'X-API-Key': apiKey,
    }
  });

  ws.on('open', () => {
    console.log('CONNECTED! Sending event: start ...');
    ws.send(JSON.stringify({
      event: 'start',
      stream_id: 'test_stream_1',
      config: {
        input_format: 'mulaw_8000',
        output_audio_delivery: 'speaking_pace',
      }
    }));
  });

  ws.on('message', (msg) => {
    const data = JSON.parse(msg.toString());
    console.log('<- Received event:', data.event);
    if (data.event === 'ack') {
      console.log('✅ Stream acknowledged! Agent ready! stream_id:', data.stream_id);
    } else if (data.event === 'media_output') {
      const bytes = Buffer.from(data.media?.payload || '', 'base64').length;
      console.log('🎉 RECEIVED AGENT VOICE AUDIO! Bytes:', bytes);
      ws.close();
      console.log('TEST PASSED SUCCESSFULLY!');
      process.exit(0);
    }
  });

  ws.on('error', (err) => console.log('Err:', err.message));
  ws.on('close', (c, r) => console.log('Close:', c, r.toString()));
}

testOfficialProtocol();
