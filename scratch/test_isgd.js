const target = 'https://played-appendix-legislative-happening.trycloudflare.com/api/vobiz/incoming-call';
const isGdUrl = `https://is.gd/create.php?format=json&url=${encodeURIComponent(target)}`;

async function testIsGd() {
  const res = await fetch(isGdUrl);
  const data = await res.json();
  console.log('is.gd result:', data);
}

testIsGd();
