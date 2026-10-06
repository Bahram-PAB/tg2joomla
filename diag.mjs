// پروب: متن پیام 2278 کانال (کدام فیلتر خورده؟)
const CH = process.env.CHANNEL || 'koohnameh';
const MSG = process.env.MSG_ID || '2278';
const { execSync } = await import('node:child_process');
const html = execSync(`curl -sS --max-time 20 "https://t.me/s/${CH}/${MSG}"`, { maxBuffer: 16 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] }).toString();
const idx = html.indexOf(`data-post="${CH}/${MSG}"`);
if (idx < 0) { console.log('NOT FOUND'); process.exit(0); }
const next = html.indexOf('data-post="', idx + 10);
const seg = html.slice(idx, next > 0 ? next : idx + 20000);
const texts = [...seg.matchAll(/<div class="tgme_widget_message_text[^>]*>([\s\S]*?)<\/div>/g)]
  .map(m => m[1].replace(/<[^>]+>/g, '\n').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\n{2,}/g, '\n').trim());
console.log('MSG ' + MSG + ':\n' + (texts[0] || '(no text)'));
