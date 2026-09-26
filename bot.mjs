// tg2joomla — پیام‌های کانال تلگرام → مطلب جوملا ۶ (انتشار مستقیم، بدون بازنویسی)
// ساختار پیام: سطر اول = عنوان مطلب، سطرهای بعدی = متن مطلب
// ویرایش پیام کانال → به‌روزرسانی همان مطلب در جوملا (بدون ساخت مطلب تکراری)
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
  || { 'audio/ogg': 'ogg', 'audio/mp4': 'm4a', 'audio/mpeg': 'mp3', 'image/jpeg': 'jpg' }[mime]
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
// com_media: پوشه مقصد در query با پیشوند آداپتر (images:/images/tg) و نام فایل در فیلد name
const uploadMedia = (dir, name, buf) =>
  joomla('POST', `${JC}/media/files?path=${encodeURIComponent(`images:/${dir}`)}`, { name, content: buf.toString('base64') });

async function downloadFile(fileId) {
  const f = await tg('getFile', { file_id: fileId });
  const res = await fetch(`${TG}/file/bot${BOT_TOKEN}/${f.file_path}`);
  if (!res.ok) { const e = new Error(`TG download ${res.status}`); e.status = res.status; throw e; }
  return { buf: Buffer.from(await res.arrayBuffer()), name: f.file_path.split('/').pop() };
}

// تعیین نوع پیام و تولید محتوای مطلب از روی آن
function buildContent(post) {
  const audio = post.audio || (post.document && String(post.document.mime_type || '').startsWith('audio/') && post.document);
  if (audio) {
    const cap = (post.caption || '').trim();
    const p = cap ? parseStructured(cap) : null;
    return { kind: 'audio', audio, title: p ? p.title : (audio.file_name || 'فایل صوتی').replace(/\.[a-z0-9]+$/i, ''), html: p ? toHtml(p.body) : '', catid: CAT_AUDIO };
  }
  if (post.photo) {
    if (!post.caption) return { kind: 'photo-no-caption-skipped' };
    const p = parseStructured(post.caption);
    if (!p) return { kind: 'structure-skipped' };
    return { kind: 'photo', photo: post.photo[post.photo.length - 1], title: p.title, html: toHtml(p.body), alt: esc(p.title), catid: CAT_TEXT };
  }
  if (post.text) {
    const p = parseStructured(post.text);
    if (!p) return { kind: 'structure-skipped' };
    return { kind: 'text', title: p.title, html: toHtml(p.body), catid: CAT_TEXT };
  }
  return { kind: 'type-skipped' };
}

// دانلود و آپلود رسانه (در صورت تغییر file_id؛ در غیر این صورت از آپلود قبلی استفاده می‌شود)
async function mediaFor(post, c, key, state) {
  const dir = c.kind === 'photo' ? MEDIA_DIR : AUDIO_DIR;
  const fid = c.kind === 'photo' ? c.photo.file_id : c.audio.file_id;
  const mime = c.kind === 'photo' ? 'image/jpeg' : c.audio.mime_type;
  if (state.files[key] === fid && state.fnames[key]) return state.fnames[key];
  const n = (state.fcount[key] || 0) + 1;
  const fname = `tg-${post.message_id}${n > 1 ? '-' + n : ''}.${extOf(c.audio && c.audio.file_name, mime)}`;
  const { buf } = await downloadFile(fid);
  await uploadMedia(dir, fname, buf);
  state.files[key] = fid; state.fnames[key] = fname; state.fcount[key] = n;
  return fname;
}

// خروجی: رشته = رد شده؛ شیء = محتوای آماده انتشار
async function handlePost(post, key, state) {
  const c = buildContent(post);
  if (['photo-no-caption-skipped', 'structure-skipped', 'type-skipped'].includes(c.kind)) return c.kind;
  const fname = await mediaFor(post, c, key, state);
  const art = c.kind === 'photo'
    ? `<figure><img src="/${MEDIA_DIR}/${fname}" alt="${c.alt}"></figure>\n${c.html}`
    : c.kind === 'audio'
      ? `<audio controls src="/${AUDIO_DIR}/${fname}"></audio>${c.html ? '\n' + c.html : ''}`
      : c.html;
  return { c, art };
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
  state.ids = state.ids || {}; state.files = state.files || {}; state.fnames = state.fnames || {}; state.fcount = state.fcount || {};
  const updates = (await tg('getUpdates', { offset: state.lastUpdateId + 1, allowed_updates: ['channel_post', 'edited_channel_post'], timeout: 0 })) || [];

  // اجرای اول: تاریخچه انبوه (بیش از ۲ پیام معلق) منتشر نمی‌شود؛ پیام‌های تازه بلافاصله می‌روند
  if (state.lastUpdateId === 0 && updates.length > 2) {
    state.lastUpdateId = updates.at(-1).update_id;
    saveState(state);
    console.log(`baseline: skipped ${updates.length} old updates`);
    process.exit(0);
  }

  const errors = [];
  for (const u of updates) {
    const post = u.edited_channel_post || u.channel_post;
    const edited = !!u.edited_channel_post;
    if (!post) { state.lastUpdateId = u.update_id; continue; }
    const key = `${post.chat.id}:${post.message_id}`;
    try {
      const known = state.done.includes(key);
      if (!known || edited) {
        const r = await handlePost(post, key, state);
        if (typeof r === 'string') {
          console.log(`${key}: ${r}${edited ? ' (edit)' : ''}`);
        } else {
          const { c, art } = r;
          let target = state.ids[key];
          if (edited && known && !target) {
            // مطلبِ اصلِ این پیام قبل از ثبت ids ساخته شده — با عنوان پیدا می‌شود
            const found = await joomla('GET', `${JC}/content/articles?page[limit]=10&search=${encodeURIComponent(c.title)}`);
            const hit = (found.data || []).find(a => a.attributes.title === c.title);
            if (hit) { target = hit.attributes.id; state.ids[key] = target; }
          }
          if (target && edited) {
            await joomla('PATCH', `${JC}/content/articles/${target}`, { title: c.title, articletext: art, catid: c.catid });
            console.log(`${key}: updated article ${target} (${c.kind})`);
          } else if (target && !edited) {
            console.log(`${key}: already article ${target} — skipped`);
          } else {
            const res = await createArticle({ title: c.title, articletext: art, catid: c.catid });
            state.ids[key] = res.data.attributes.id;
            console.log(`${key}: ${c.kind} article ${state.ids[key]}`);
            if (!known) state.done.push(key);
          }
        }
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
      if (!edited && !state.done.includes(key)) state.done.push(key);
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
  try {
    const lst = await joomla('GET', `${JC}/media/files?path=/`);
    console.log('media root listing:', JSON.stringify(lst.data || lst).slice(0, 400));
  } catch (e) { console.log('media list FAILED:', e.message.slice(0, 150)); }
  const px = Buffer.from('/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwcJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AVN//2Q==', 'base64');
  const dfn = `diag-test-${Date.now()}.jpg`;
  for (const [label, url, body] of [
    ['query adapter path', `${JC}/media/files?path=${encodeURIComponent('images:/images/tg')}`, { name: dfn, content: px.toString('base64') }],
    ['path in body', `${JC}/media/files`, { name: dfn, content: px.toString('base64'), path: 'images:/images/tg' }],
    ['root + slashname', `${JC}/media/files?path=${encodeURIComponent('images:/')}`, { name: `tg/${dfn}`, content: px.toString('base64') }],
  ]) {
    try {
      await joomla('POST', url, body);
      console.log(`upload variant [${label}]: OK`);
      break;
    } catch (e) { console.log(`upload variant [${label}]: ${e.message.slice(0, 140)}`); }
  }
  const arts = await joomla('GET', `${JC}/content/articles?page[limit]=5`);
  console.log('latest articles:');
  for (const a of arts.data || []) {
    const x = a.attributes;
    console.log(`  id=${x.id} state=${x.state} featured=${x.featured} ${String(x.title).slice(0, 60)}`);
  }
  const id = process.argv[3];
  if (id) {
    const one = await joomla('GET', `${JC}/content/articles/${id}`);
    const x = one.data.attributes;
    console.log(`article ${id}: created=${x.created} by=${x.created_by} keys=${Object.keys(x).join(',')}`);
    console.log('introtext[0:400]:', String(x.introtext || '').slice(0, 400));
    console.log('fulltext[0:400]:', String(x.fulltext || '').slice(0, 400));
  }
}

if (process.argv[2] === 'diag') await diag();
else if (process.env.TEST !== '1') await main();

export { parseStructured, toHtml, extOf };
