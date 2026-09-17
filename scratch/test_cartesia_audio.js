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

async function testCartesia(encoding) {
  const apiKey = process.env.CARTESIA_API_KEY;
  const voiceId = process.env.CARTESIA_VOICE_ID || "ff480e6e-3e79-4307-9889-d1d9feb8e20e";
  console.log(`\nTesting Cartesia with encoding: ${encoding}...`);

  const t0 = Date.now();
  const res = await fetch("https://api.cartesia.ai/tts/bytes", {
    method: "POST",
    headers: {
      "X-API-Key": apiKey,
      "Cartesia-Version": "2024-06-10",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model_id: "sonic-3.6",
      transcript: "నమస్కారం అండి! మీకు ఎలా సహాయపడగలను?",
      voice: { mode: "id", id: voiceId },
      output_format: {
        container: "raw",
        encoding: encoding,
        sample_rate: 8000,
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`FAILED (${res.status}): ${text}`);
    return null;
  }

  const buf = Buffer.from(await res.arrayBuffer());
  console.log(`✓ SUCCESS! Duration: ${Date.now() - t0}ms, Audio buffer: ${buf.length} bytes, Base64 len: ${buf.toString('base64').length}`);
  return buf;
}

async function run() {
  await testCartesia("pcm_mulaw");
  await testCartesia("pcm_s16le");
}

run();
