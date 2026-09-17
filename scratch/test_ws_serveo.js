import { WebSocket } from 'ws';

const wsUrl = 'wss://1124e77fe56611a4-103-134-97-249.serveousercontent.com/api/vobiz/stream?agentId=cmu3vwach00034r98dvgsyjy6&callerNumber=%2B916305367443';

console.log('Testing WebSocket handshake to serveo:', wsUrl);

const ws = new WebSocket(wsUrl);

ws.on('open', () => {
  console.log('✓ WebSocket connected successfully to serveo!');
  ws.send(JSON.stringify({ event: 'start', start: { streamId: 'test_123', callUuid: 'test_call' } }));
});

ws.on('message', (data) => {
  console.log('Received from server:', data.toString().slice(0, 100));
  ws.close();
});

ws.on('error', (err) => {
  console.error('WebSocket error on serveo:', err.message);
});

ws.on('close', (code, reason) => {
  console.log('WebSocket closed:', code, reason.toString());
});
