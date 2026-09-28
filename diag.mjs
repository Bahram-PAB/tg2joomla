// پروب تشخیصی دانلود تلگرام روی رانر GH — مقایسه curl و node fetch
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const BOT_TOKEN = process.env.BOT_TOKEN;
const TG = `https://api.telegram.org/bot${BOT_TOKEN}`;
const state = JSON.parse(readFileSync('state/processed.json', 'utf8'));
const [key, fid] = Object.entries(state.files)[0];
console.log('probing key:', key);

const f = await (await fetch(`${TG}/getFile`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ file_id: fid }),
})).json();
console.log('getFile:', JSON.stringify(f));
if (f.ok) {
  const url = `${TG}/file/bot${BOT_TOKEN}/${f.result.file_path}`;
  console.log('file_path:', f.result.file_path);
  try {
    const out = execSync(`curl -sS -f -w '\\nHTTP:%{http_code} size:%{size_download}\\n' --max-time 60 "${url}"`, { stdio: ['ignore', 'pipe', 'pipe'] });
    console.log('curl OK:', out.length, 'bytes; head:', out.slice(0, 12).toString('hex'));
  } catch (e) {
    console.log('curl FAIL:', String(e.stderr || e.message).slice(0, 200));
  }
  const r = await fetch(url);
  const ab = await r.arrayBuffer();
  console.log('node fetch:', r.status, ab.byteLength, 'bytes; head:', Buffer.from(ab.slice(0, 8)).toString('hex'));
}
