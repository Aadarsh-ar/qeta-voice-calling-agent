import http from 'http';

const routes = [
  '/',
  '/agents',
  '/agents/cmu3vwach00034r98dvgsyjy6',
  '/agents/new',
  '/calls',
  '/phone-numbers',
  '/analytics',
  '/integrations',
  '/settings',
  '/api/agents',
  '/api/calls',
  '/api/phone-numbers',
  '/api/integrations',
];

async function checkRoute(path) {
  return new Promise((resolve) => {
    const req = http.get('http://localhost:3000' + path, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        resolve({
          path,
          status: res.statusCode,
          ok: res.statusCode >= 200 && res.statusCode < 400,
          len: data.length,
        });
      });
    });
    req.on('error', (err) => {
      resolve({ path, status: 0, ok: false, error: err.message });
    });
    req.setTimeout(5000, () => {
      req.destroy();
      resolve({ path, status: 0, ok: false, error: 'Timeout' });
    });
  });
}

async function run() {
  console.log('Testing all routes on http://localhost:3000 ...\n');
  let allOk = true;
  for (const r of routes) {
    const res = await checkRoute(r);
    if (res.ok) {
      console.log(`✓ ${r.padEnd(36)} -> HTTP ${res.status} (${res.len} bytes)`);
    } else {
      console.log(`✗ ${r.padEnd(36)} -> FAILED (${res.status || res.error})`);
      allOk = false;
    }
  }

  console.log('\nResult: ' + (allOk ? 'ALL ROUTES 100% HEALTHY' : 'SOME ROUTES FAILED'));
}

run();
