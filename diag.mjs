// پروب: دانلود عکس از صفحهٔ عمومی t.me/s/ — URL بدون نقل‌قول
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const state = JSON.parse(readFileSync('state/processed.json', 'utf8'));
const samples = Object.entries(state.files).slice(0, 3);
for (const [key] of samples) {
  const msgId = key.split(':')[1];
  console.log(`\n--- msg ${msgId} ---`);
  try {
    const html = execSync(`curl -sS --max-time 20 "https://t.me/s/koohnameh/${msgId}"`, { stdio: ['ignore', 'pipe', 'pipe'] }).toString();
    const m = html.match(/background-image:\s*url\(([^)]+)\)/);
    if (!m) { console.log('no image found'); continue; }
    const url = m[1].trim().replace(/^['"]|['"]$/g, ''); // حذف نقل‌قول
    console.log('url:', url.slice(0, 90));
    const out = execSync(`curl -sS -f -w '%{http_code} %{size_download}' --max-time 30 -o tme_${msgId}.jpg '${url}'`, { stdio: ['ignore', 'pipe', 'pipe'] }).toString();
    console.log('download:', out);
    const b = readFileSync(`tme_${msgId}.jpg`);
    const head = b.slice(0, 4).toString('hex');
    const isJpeg = head.startsWith('ffd8');
    console.log(`head=${head} jpeg=${isJpeg} size=${b.length}`);
    execSync(`rm -f tme_${msgId}.jpg`);
  } catch (e) { console.log('error:', String(e.stderr || e.message).slice(0, 200)); }
}
