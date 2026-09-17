import http from 'http';

http.get('http://localhost:3000/agents', (res) => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => {
    console.log('HTML Length:', data.length);
    const regex = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
    let match;
    let count = 0;
    while ((match = regex.exec(data)) !== null) {
      count++;
      const tag = match[0].slice(0, 150);
      console.log(`Script ${count}:`, tag.replace(/\n/g, ' '));
    }
  });
});
