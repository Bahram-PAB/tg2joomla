// پروب دوم: چرا دانلود 404 می‌دهد؟ — تست hostname/آی‌پی جایگزین + هدرها
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const BOT_TOKEN = process.env.BOT_TOKEN;
const TG = `https://api.telegram.org/bot${BOT_TOKEN}`;
const state = JSON.parse(readFileSync('state/processed.json', 'utf8'));
const [key, fid] = Object.entries(state.files)[0];

const f = await (await fetch(`${TG}/getFile`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ file_id: fid }),
})).json();
console.log('file_path:', f.result.file_path, 'size:', f.result.file_size);

const variants = [
  `https://api.telegram.org/file/bot${BOT_TOKEN}/${f.result.file_path}`,
  `https://api-1.telegram.org/file/bot${BOT_TOKEN}/${f.result.file_path}`,
  `https://cdn-1.telegram.org/file/bot${BOT_TOKEN}/${f.result.file_path}`,
  `https://api.telegram.org/file/bot${BOT_TOKEN}/photos/file_8.jpg`,
];
for (const url of variants) {
  const host = new URL(url).host;
  try {
    const out = execSync(`curl -sS -f -w '%{http_code} %{size_download} %{remote_ip}' --max-time 30 "${url}"`, { stdio: ['ignore', 'pipe', 'pipe'] });
    console.log(`OK  ${host}: ${out.slice(-40).toString()}`);
  } catch (e) {
    console.log(`ERR ${host}: ${String(e.stderr || e.message).slice(-90).replace(/\n/g, ' ')}`);
  }
}
// هدرهای پاسخ 404 را ببینیم
console.log(execSync(`curl -sS -D - -o /dev/null --max-time 30 "https://api.telegram.org/file/bot${BOT_TOKEN}/${f.result.file_path}"`, { stdio: ['ignore', 'pipe', 'pipe'] }).toString().split('\n').filter(l => /HTTP|server|date|content-/i.test(l)).join('\n'));
