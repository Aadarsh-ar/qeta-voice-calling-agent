import http from 'http';

http.get('http://localhost:3000/agents', (res) => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', async () => {
    const regex = /<script\b[^>]*src=[\"']([^\"']+)[\"'][^>]*>/gi;
    let match;
    const urls = [];
    while ((match = regex.exec(data)) !== null) {
      urls.push(match[1]);
    }

    console.log(`Checking ${urls.length} script URLs...`);
    for (const u of urls) {
      const fullUrl = `http://localhost:3000${u}`;
      await new Promise(resolve => {
        http.get(fullUrl, (r) => {
          console.log(`Status ${r.statusCode} for ${u}`);
          resolve();
        }).on('error', e => {
          console.error(`ERROR for ${u}:`, e.message);
          resolve();
        });
      });
    }
  });
});
