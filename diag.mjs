// پروب: دانلود عکس از صفحهٔ عمومی t.me/s/
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const state = JSON.parse(readFileSync('state/processed.json', 'utf8'));
// فقط چند پیام نمونه از عکس‌دارها تست کن
const samples = Object.entries(state.files).slice(0, 3);
for (const [key, fid] of samples) {
  const msgId = key.split(':')[1];
  console.log(`\n--- msg ${msgId} ---`);
  try {
    // دانلود صفحهٔ عمومی
    const html = execSync(`curl -sS --max-time 20 "https://t.me/s/koohnameh/${msgId}"`, { stdio: ['ignore', 'pipe', 'pipe'] }).toString();
    // پیدا کردن img src تصویر اصلی پست (نه آواتار، نه تامبنیل)
    const match = html.match(/background-image:\s*url\(([^)]+)\)/)
      || html.match(/<img[^>]*class="[^"]*tgme_widget_message_photo[^"]*"[^>]*src="([^"]+)"/i)
      || html.match(/<img[^>]*src="(https?:\/\/[^"]*\/photos\/[^"]+)"/i);
    if (match) {
      console.log('found img:', match[1].slice(0, 100));
      // دانلود تصویر
      const out = execSync(`curl -sS -f -w '%{http_code} %{size_download}' --max-time 20 -o tme_${msgId}.jpg "${match[1]}"`, { stdio: ['ignore', 'pipe', 'pipe'] }).toString();
      console.log('download:', out);
      // بررسی magic byte
      const head = readFileSync(`tme_${msgId}.jpg`).slice(0, 8).toString('hex');
      console.log('head hex:', head);
    } else {
      // fallback: هر img که تامبنیل نباشد
      const imgs = [...html.matchAll(/<img[^>]*src="([^"]+)"/gi)].map(m => m[1]).filter(u => !u.includes('avatar') && !u.includes('logo'));
      console.log('no specific match; found imgs:', imgs.length);
      imgs.slice(0, 3).forEach(u => console.log('  ', u.slice(0, 100)));
    }
  } catch (e) { console.log('error:', e.message.slice(0, 200)); }
}
