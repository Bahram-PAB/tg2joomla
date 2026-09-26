// tg2joomla — پیام‌های کانال تلگرام → مطلب جوملا ۶ (انتشار مستقیم، بدون بازنویسی)
// ساختار پیام: سطر اول = عنوان مطلب، سطرهای بعدی = متن مطلب
import fs from 'node:fs';

const BOT_TOKEN = process.env.BOT_TOKEN;
const JOOMLA_BASE = (process.env.JOOMLA_BASE || '').replace(/\/+$/, '');
const JOOMLA_TOKEN = process.env.JOOMLA_TOKEN;
const CAT_TEXT = process.env.NEWS_CATEGORY_ID;
const CAT_AUDIO = process.env.AUDIO_CATEGORY_ID;
const MEDIA_DIR = process.env.MEDIA_DIR || 'images/tg';
const AUDIO_DIR = process.env.AUDIO_DIR || 'images/tg-audio';
const LANGUAGE = process.env.JOOMLA_LANGUAGE || '*';
const STATE_FILE = process.env.STATE_FILE || 'state/processed.json';
const TG = `https://api.telegram.org/bot${BOT_TOKEN}`;
const JC = `${JOOMLA_BASE}/api/index.php/v1`;

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function toHtml(text) {
  return text.split(/\n{2,}/).map(p => '<p>' + esc(p).replace(/\n/g, '<br>') + '</p>').join('\n');
}

// سطر اول عنوان، بقیه بدنه؛ در غیر این صورت پیام «طبق ساختار» نیست
function parseStructured(text) {
  const lines = text.split('\n');
  const i = lines.findIndex(l => l.trim());
  if (i < 0) return null;
  const title = lines[i].trim();
  const body = lines.slice(i + 1).join('\n').trim();
  if (title.length < 5 || title.length > 150 || !body) return null;
  return { title, body };
}

const extOf = (name, mime) => (
  (name.match(/\.([a-z0-9]+)$/i) || [])[1]
  || { 'audio/ogg': 'ogg', 'audio/mp4': 'm4a', 'audio/mpeg': 'mp3' }[mime]
  || 'bin'
).toLowerCase();

async function tg(method, params = {}) {
  const res = await fetch(`${TG}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!data.ok) { const e = new Error(`Telegram ${method}: ${data.error_code} ${data.description}`); e.status = data.error_code; throw e; }
  return data.result;
}

async function joomla(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', Accept: 'application/vnd.api+json', 'X-Joomla-Token': JOOMLA_TOKEN },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (res.status >= 400) { const e = new Error(`Joomla ${res.status}: ${text.slice(0, 300)}`); e.status = res.status; throw e; }
  return text ? JSON.parse(text) : null;
}

const createArticle = a => joomla('POST', `${JC}/content/articles`, { ...a, state: 1, language: LANGUAGE });
const uploadMedia = (dir, name, buf) =>
  joomla('POST', `${JC}/media?path=${encodeURIComponent(dir)}`, { path: name, content: buf.toString('base64') });

async function downloadFile(fileId) {
  const f = await tg('getFile', { file_id: fileId });
  const res = await fetch(`${TG}/file/bot${BOT_TOKEN}/${f.file_path}`);
  if (!res.ok) { const e = new Error(`TG download ${res.status}`); e.status = res.status; throw e; }
  return { buf: Buffer.from(await res.arrayBuffer()), name: f.file_path.split('/').pop() };
}

async function handlePost(post) {
  const audio = post.audio || (post.document && String(post.document.mime_type || '').startsWith('audio/') && post.document);
  if (audio) {
    const cap = (post.caption || '').trim();
    const p = cap ? parseStructured(cap) : null;
    const title = p ? p.title : (audio.file_name || 'فایل صوتی').replace(/\.[a-z0-9]+$/i, '');
    const { buf, name } = await downloadFile(audio.file_id);
    const fname = `tg-${post.message_id}.${extOf(name, audio.mime_type)}`;
    await uploadMedia(AUDIO_DIR, fname, buf);
    const art = `<audio controls src="/${AUDIO_DIR}/${fname}"></audio>` + (p ? '\n' + toHtml(p.body) : '');
    await createArticle({ title, articletext: art, catid: CAT_AUDIO });
    return 'audio';
  }
  if (post.photo) {
    // ponytail: در آلبوم فقط عکسِ دارای کپشن منتشر می‌شود؛ پردازش کامل آلبوم را وقتی اضافه کن که لازم شد
    if (!post.caption) return 'photo-no-caption-skipped';
    const p = parseStructured(post.caption);
    if (!p) return 'structure-skipped';
    const { buf, name } = await downloadFile(post.photo[post.photo.length - 1].file_id);
    const fname = `tg-${post.message_id}.${extOf(name, 'image/jpeg')}`;
    await uploadMedia(MEDIA_DIR, fname, buf);
    const art = `<figure><img src="/${MEDIA_DIR}/${fname}" alt="${esc(p.title)}"></figure>\n` + toHtml(p.body);
    await createArticle({ title: p.title, articletext: art, catid: CAT_TEXT });
    return 'photo';
  }
  if (post.text) {
    const p = parseStructured(post.text);
    if (!p) return 'structure-skipped';
    await createArticle({ title: p.title, articletext: toHtml(p.body), catid: CAT_TEXT });
    return 'text';
  }
  return 'type-skipped';
}

const loadState = () => {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); }
  catch { return { lastUpdateId: 0, done: [] }; }
};
const saveState = s => { fs.mkdirSync(STATE_FILE.replace(/\/[^/]+$/, ''), { recursive: true }); fs.writeFileSync(STATE_FILE, JSON.stringify(s)); };

async function main() {
  const missing = ['BOT_TOKEN', 'JOOMLA_BASE', 'JOOMLA_TOKEN', 'NEWS_CATEGORY_ID', 'AUDIO_CATEGORY_ID'].filter(k => !process.env[k]);
  if (missing.length) throw new Error('Missing secrets: ' + missing.join(', '));

  const state = loadState();
  const updates = (await tg('getUpdates', { offset: state.lastUpdateId + 1, allowed_updates: ['channel_post'], timeout: 0 })) || [];

  // اجرای اول: تاریخچه انبوه (بیش از ۲ پیام معلق) منتشر نمی‌شود؛ پیام‌های تازه بلافاصله می‌روند
  if (state.lastUpdateId === 0 && updates.length > 2) {
    state.lastUpdateId = updates.at(-1).update_id;
    saveState(state);
    console.log(`baseline: skipped ${updates.length} old updates`);
    process.exit(0);
  }

  const errors = [];
  for (const u of updates) {
    const post = u.channel_post;
    if (!post) { state.lastUpdateId = u.update_id; continue; }
    const key = `${post.chat.id}:${post.message_id}`;
    try {
      if (!state.done.includes(key)) {
        console.log(`${key}: ${await handlePost(post)}`);
        state.done.push(key);
      }
      state.lastUpdateId = u.update_id;
    } catch (e) {
      const retry = !e.status || e.status >= 500 || e.status === 429;
      if (retry) {
        state.lastUpdateId = u.update_id - 1; // اجرای بعدی از همین پیام ادامه می‌یابد
        console.log(`${key}: retry-later ${e.message}`);
        break;
      }
      errors.push(`${key}: ${e.message}`); // خطای دائمی — تلاش مجدد بی‌فایده
      state.done.push(key);
      state.lastUpdateId = u.update_id;
      console.log(`${key}: fatal ${e.message}`);
    }
  }
  if (errors.length) fs.appendFileSync('debug.log', `${new Date().toISOString()}\n${errors.join('\n')}\n\n`);
  if (state.done.length > 5000) state.done = state.done.slice(-4000);
  saveState(state);
  console.log(`updates=${updates.length}`);
}

async function diag() {
  for (const k of ['BOT_TOKEN', 'JOOMLA_BASE', 'JOOMLA_TOKEN']) if (!process.env[k]) throw new Error('Missing ' + k);
  const h = await fetch(`${TG}/getWebhookInfo`).then(r => r.json());
  console.log('webhook:', JSON.stringify(h.result));
  const me = await tg('getMe');
  console.log('bot:', me.username, me.id);
  if (process.env.TG_CHAT_ID) {
    const m = await tg('getChatMember', { chat_id: process.env.TG_CHAT_ID, user_id: me.id }).catch(e => 'ERR ' + e.message);
    console.log('membership:', typeof m === 'string' ? m : m.status);
  }
  const arts = await joomla('GET', `${JC}/content/articles?page[limit]=5`);
  console.log('latest articles:');
  for (const a of arts.data || []) {
    const x = a.attributes;
    console.log(`  id=${x.id} state=${x.state} featured=${x.featured} ${String(x.title).slice(0, 60)}`);
  }
  const media = await joomla('GET', `${JC}/media?path=images`);
  console.log('media root:');
  for (const f of (media.data || []).slice(0, 60)) console.log('  ', (f.attributes && (f.attributes.path || f.attributes.name)) || JSON.stringify(f).slice(0, 90));
  const id = process.argv[3];
  if (id) {
    const one = await joomla('GET', `${JC}/content/articles/${id}`);
    const x = one.data.attributes;
    console.log(`article ${id}: created=${x.created} by=${x.created_by} cat=${x.catid} state=${x.state}`);
    console.log('articletext[0:600]:', String(x.articletext).slice(0, 600));
  }
}

if (process.argv[2] === 'diag') await diag();
else if (process.env.TEST !== '1') await main();

export { parseStructured, toHtml, extOf };
