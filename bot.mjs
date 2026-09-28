// tg2joomla — پیام‌های کانال تلگرام → مطلب جوملا ۶ (انتشار مستقیم، بدون بازنویسی)
// ساختار پیام: سطر اول = عنوان مطلب، سطرهای بعدی = متن مطلب
// ویرایش پیام کانال → به‌روزرسانی همان مطلب در جوملا (بدون ساخت مطلب تکراری)
import fs from 'node:fs';
import { execSync } from 'node:child_process';

const BOT_TOKEN = process.env.BOT_TOKEN;
const JOOMLA_BASE = (process.env.JOOMLA_BASE || '').replace(/\/+$/, '');
const JOOMLA_TOKEN = process.env.JOOMLA_TOKEN;
const CAT_TEXT = '90'; // دسته «مطالب نویسندگان» — همه مطالب اینجا و state:0 تا ادمین منتشر کند
const MEDIA_DIR = process.env.MEDIA_DIR || 'tg';
const AUDIO_DIR = process.env.AUDIO_DIR || 'tg-audio';
const LANGUAGE = process.env.JOOMLA_LANGUAGE || '*';
const STATE_FILE = process.env.STATE_FILE || 'state/processed.json';
const TG = `https://api.telegram.org/bot${BOT_TOKEN}`;
const JC = `${JOOMLA_BASE}/api/index.php/v1`;
const CHANNEL = process.env.TG_CHANNEL || 'koohnameh';

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

const createArticle = a => joomla('POST', `${JC}/content/articles`, { ...a, state: 0, language: LANGUAGE }); // state:0 = منتشر نشده (بررسی ادمین)
// API جوملا ۶: path در بدنه، با نام آداپتر local-images؛ نقطه در path = فایل، بدون نقطه = پوشه
const ensureDir = async dir => {
  const segs = dir.split('/');
  for (let i = 1; i <= segs.length; i++) {
    await joomla('POST', `${JC}/media/files`, { path: `local-images:/${segs.slice(0, i).join('/')}` })
      .catch(e => { if (e.status !== 400 && e.status !== 409) throw e; }); // 400/409 = پوشه از قبل هست
  }
};
const uploadMedia = async (dir, name, buf) => {
  await ensureDir(dir);
  // override: true در بدنه = بازنویسی فایل موجود (DELETE route برای فایل وجود ندارد)
  return joomla('POST', `${JC}/media/files`, { path: `local-images:/${dir}/${name}`, content: buf.toString('base64'), override: true });
};

// دانلود فایل تلگرام — با curl (node fetch/undici روی GH runners از تلگرام 404 می‌گیرد؛ curl تست‌شده سالم است)
function curlDownload(url) {
  return execSync(`curl -sS -f --max-time 180 "${url}"`, { maxBuffer: 512 * 1024 * 1024 });
}

async function downloadFile(fileId) {
  const f = await tg('getFile', { file_id: fileId });
  const url = `${TG}/file/bot${BOT_TOKEN}/${f.file_path}`;
  let buf;
  try {
    buf = curlDownload(url);
  } catch (e) {
    const code = (String(e.stderr || e.message).match(/\b(4\d\d|5\d\d)\b/) || [])[1] || '0';
    const err = new Error(`TG download ${code} (file_path=${f.file_path}) ${String(e.stderr || e.message).slice(-120).replace(/\n/g, ' ')}`);
    err.status = code === '404' ? 0 : 500; // 404 دانلود تلگرام موقت شمرده می‌شود (تا سقف ۱۰ تلاش)
    throw err;
  }
  if (!buf || buf.length < 8) throw new Error(`TG download empty (file_path=${f.file_path})`);
  // محافظت قطعی: هرگز پاسخ خطای JSON تلگرام را به‌جای تصویر ذخیره نکن
  const head = buf.slice(0, 16).toString();
  if (head.startsWith('{"ok":false')) {
    const code = (buf.toString().match(/"error_code":(\d+)/) || [])[1] || 'ERR';
    const err = new Error(`TG download ${code} (file_path=${f.file_path}) ${buf.toString().slice(0, 120)}`);
    err.status = code === '404' ? 0 : 500;
    throw err;
  }
  return { buf, name: f.file_path.split('/').pop() };
}

// دانلود از صفحهٔ عمومی کانال — وقتی لینک Bot API منقضی شده (فایل قدیمی)؛
// t.me/s/<channel>/<id> همیشه در دسترس است و URL عکس را می‌دهد
function downloadFromChannelPage(msgId) {
  const html = execSync(`curl -sS --max-time 20 "https://t.me/s/${CHANNEL}/${msgId}"`, { maxBuffer: 16 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] }).toString();
  // فقط ناحیهٔ همین پیام — صفحه پیام‌های اطراف را هم رندر می‌کند
  const idx = html.indexOf(`data-post="${CHANNEL}/${msgId}"`);
  if (idx < 0) throw new Error(`channel page: msg ${msgId} not found`);
  const next = html.indexOf('data-post="', idx + 10);
  const seg = html.slice(idx, next > 0 ? next : idx + 10000);
  const m = seg.match(/background-image:\s*url\(([^)]+)\)/);
  if (!m) throw new Error(`channel page: no photo in msg ${msgId}`);
  const url = m[1].trim().replace(/^['"]|['"]$/g, '');
  const buf = execSync(`curl -sS -f --max-time 60 "${url}"`, { maxBuffer: 512 * 1024 * 1024 });
  const head = buf.slice(0, 4).toString('hex');
  if (head.startsWith('ffd8')) return { buf, name: `${msgId}.jpg` };
  if (head.startsWith('8950')) return { buf, name: `${msgId}.png` };
  throw new Error(`channel page: not an image (head=${head})`);
}

// دانلود رسانه: Bot API (ریترای 404) → در نهایت صفحهٔ عمومی کانال
async function resolveMediaBuffer(fid, msgId, tries = 2) {
  let lastErr;
  for (let a = 1; a <= tries; a++) {
    try { return await downloadFile(fid); }
    catch (e) {
      lastErr = e;
      if (!/TG download 404/.test(e.message)) throw e;
      if (a < tries) await new Promise(r => setTimeout(r, 15000));
    }
  }
  try { return downloadFromChannelPage(msgId); }
  catch { throw lastErr; } // پیام خطای اصلی حفظ شود (سقف تلاش شناخته شود)
}

// فیلتر پیام‌هایی که نباید به سایت بروند (بر اساس عنوان)
const DENY = [
  /^🏔\s*پیش‌بینی/,        // پیش‌بینی آب‌وهوای قله‌ها
  /گزارش کانال‌های فعال/,  // 📡 گزارش کانال‌های فعال امروز
  /پست‌های داغ/,           // 🔥 پست‌های داغ امروز
  /پادکست روزانه/,          // پادکست روزانه
];
const denied = title => DENY.some(re => re.test(title));

// تعیین نوع پیام و تولید محتوای مطلب از روی آن
function buildContent(post) {
  const audio = post.audio || (post.document && String(post.document.mime_type || '').startsWith('audio/') && post.document);
  if (audio) {
    const cap = (post.caption || '').trim();
    const p = cap ? parseStructured(cap) : null;
    const title = p ? p.title : (audio.file_name || 'فایل صوتی').replace(/\.[a-z0-9]+$/i, '');
    if (denied(title)) return { kind: 'denied' };
    return { kind: 'audio', audio, title, html: p ? toHtml(p.body) : '', catid: CAT_TEXT };
  }
  if (post.photo) {
    if (!post.caption) return { kind: 'photo-no-caption-skipped' };
    const p = parseStructured(post.caption);
    if (!p) return { kind: 'structure-skipped' };
    if (denied(p.title)) return { kind: 'denied' };
    return { kind: 'photo', photos: post.photo, title: p.title, html: toHtml(p.body), alt: esc(p.title), catid: CAT_TEXT };
  }
  if (post.text) {
    const p = parseStructured(post.text);
    if (!p) return { kind: 'structure-skipped' };
    if (denied(p.title)) return { kind: 'denied' };
    return { kind: 'text', title: p.title, html: toHtml(p.body), catid: CAT_TEXT };
  }
  return { kind: 'type-skipped' };
}

// دانلود و آپلود رسانه (در صورت تغییر file_id؛ در غیر این صورت از آپلود قبلی استفاده می‌شود)
async function mediaFor(post, c, key, state) {
  const dir = c.kind === 'photo' ? MEDIA_DIR : AUDIO_DIR;
  const mime = c.kind === 'photo' ? 'image/jpeg' : c.audio.mime_type;
  const fid = c.kind === 'photo' ? c.photos[c.photos.length - 1].file_id : c.audio.file_id;
  if (state.files[key] === fid && state.fnames[key]) return state.fnames[key];
  const n = (state.fcount[key] || 0) + 1;
  let buf, name;
  if (c.kind === 'photo') {
    // از بزرگ‌ترین سایز شروع کن؛ همه 404 دادند → صفحهٔ عمومی کانال
    try {
      for (let i = c.photos.length - 1; i >= 0; i--) {
        try { ({ buf, name } = await downloadFile(c.photos[i].file_id)); break; }
        catch (e) { if (i === 0 || !/TG download 404/.test(e.message)) throw e; console.log(`  photo size ${i} failed, trying smaller…`); }
      }
    } catch (e) {
      if (!/TG download 404/.test(e.message)) throw e;
      ({ buf, name } = downloadFromChannelPage(post.message_id)); // لینک Bot API منقضی شده
    }
  } else {
    ({ buf, name } = await resolveMediaBuffer(fid, post.message_id));
  }
  const fname = `tg-${post.message_id}${n > 1 ? '-' + n : ''}.${extOf(name, mime)}`;
  await uploadMedia(dir, fname, buf);
  state.files[key] = fid; state.fnames[key] = fname; state.fcount[key] = n;
  return fname;
}

// خروجی: رشته = رد شده؛ شیء = محتوای آماده انتشار
async function handlePost(post, key, state) {
  const c = buildContent(post);
  if (['photo-no-caption-skipped', 'structure-skipped', 'type-skipped'].includes(c.kind)) return c.kind;
  const fname = c.kind === 'photo' || c.kind === 'audio' ? await mediaFor(post, c, key, state).catch(e => {
    if (/file is too big/.test(e.message)) return null; // >20MB: قابل دانلود نیست — مطلب با لینک تلگرام ساخته می‌شود
    throw e;
  }) : null;
  if (!fname && c.kind === 'audio') {
    const u = post.chat.username ? `https://t.me/${post.chat.username}/${post.message_id}` : '';
    if (!u) return 'too-big-no-username-skipped';
    return { c, art: c.html + `\n<p><a href="${u}">🔊 شنیدن این فایل صوتی در تلگرام</a></p>`, tooBig: true };
  }
  const art = c.kind === 'photo'
    ? `<figure><img src="/images/${MEDIA_DIR}/${fname}" alt="${c.alt}"></figure>\n${c.html}`
    : c.kind === 'audio'
      ? `<audio controls src="/images/${AUDIO_DIR}/${fname}"></audio>${c.html ? '\n' + c.html : ''}`
      : c.html;
  return { c, art };
}

const loadState = () => {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); }
  catch { return { lastUpdateId: 0, done: [] }; }
};
const saveState = s => { fs.mkdirSync(STATE_FILE.replace(/\/[^/]+$/, ''), { recursive: true }); fs.writeFileSync(STATE_FILE, JSON.stringify(s)); };

async function main() {
  const missing = ['BOT_TOKEN', 'JOOMLA_BASE', 'JOOMLA_TOKEN'].filter(k => !process.env[k]);
  if (missing.length) throw new Error('Missing secrets: ' + missing.join(', '));

  const state = loadState();
  state.ids = state.ids || {}; state.files = state.files || {}; state.fnames = state.fnames || {}; state.fcount = state.fcount || {}; state.tries = state.tries || {};
  // یک‌بار: ترمیم رسانه — اگر فایل آپلودشده JSON خطای تلگرام باشد، دوباره دانلود و آپلود می‌شود
  if (!state.media_migrated) {
    const OLD = '/images/images/tg/', NEW = '/images/tg/';
    let repairFailed = false;
    for (const [k, fid] of Object.entries(state.files)) {
      const dir = k.endsWith('-a') || state.fnames[k]?.endsWith('.mp3') || state.fnames[k]?.endsWith('.ogg') || state.fnames[k]?.endsWith('.m4a') ? AUDIO_DIR : MEDIA_DIR;
      const fname = state.fnames[k];
      if (!fname) continue;
      try {
        const cur = await joomla('GET', `${JC}/media/files?path=${encodeURIComponent(`local-images:/${dir}/${fname}`)}&content=1`);
        const content = String((Array.isArray(cur.data) ? cur.data[0] : cur.data)?.attributes?.content || '');
        const head = Buffer.from(content, 'base64').slice(0, 16).toString();
        if (!head.startsWith('{"ok":false')) continue; // سالم است
        console.log(`repair ${fname}: stored file is TG error JSON, re-downloading…`);
        // Bot API (۲ تلاش) → در صورت انقضا، صفحهٔ عمومی کانال
        const { buf } = await resolveMediaBuffer(fid, k.split(':')[1]);
        await uploadMedia(dir, fname, buf);
        console.log(`repair ${fname}: re-uploaded ${buf.length} bytes`);
      } catch (e) { console.log(`repair ${fname}: ${e.message.slice(0, 140)}`); repairFailed = true; }
    }
    // اصلاح URL قدیمی داخل مطالب (در صورت وجود)
    for (const [k, aid] of Object.entries(state.ids)) {
      try {
        const one = await joomla('GET', `${JC}/content/articles/${aid}`);
        const txt = String(one.data.attributes.text || '');
        if (txt.includes(OLD)) {
          await joomla('PATCH', `${JC}/content/articles/${aid}`, { articletext: txt.split(OLD).join(NEW) });
          console.log(`url-fixed article ${aid}`);
        }
      } catch (e) { console.log(`url-fix article ${aid}: ${e.message.slice(0, 140)}`); }
    }
    if (repairFailed) {
      console.log('repair: some files still failing — will retry next run');
      saveState(state);
    } else {
      state.media_migrated = true;
      saveState(state);
    }
  }

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
    if (post.chat.username) state.channel = post.chat.username; // برای fallback t.me/s/
    const key = `${post.chat.id}:${post.message_id}`;
    try {
      const known = state.done.includes(key);
      if (!known || edited) {
        const r = await handlePost(post, key, state);
        if (typeof r === 'string') {
          console.log(`${key}: ${r}${edited ? ' (edit)' : ''}`);
          if (!known) state.done.push(key); // ردشده برای همیشه رد می‌شود؛ ویرایش بعدی دوباره بررسی می‌شود
        } else {
          const { c, art } = r;
          let target = state.ids[key];
          if (edited && !target) {
            // مطلبِ اصلِ این پیام ممکن است قبل از ثبت ids ساخته شده باشد — با عنوان پیدا می‌شود
            const found = await joomla('GET', `${JC}/content/articles?page[limit]=10&search=${encodeURIComponent(c.title)}`);
            const hit = (found.data || []).find(a => a.attributes.title === c.title);
            if (hit) { target = hit.attributes.id; state.ids[key] = target; }
          }
          if (target && edited) {
            await joomla('PATCH', `${JC}/content/articles/${target}`, { title: c.title, articletext: art, catid: c.catid, state: 0 }); // ویرایش هم برای بررسی مجدد منتشر نشده می‌شود
            console.log(`${key}: updated article ${target} (${c.kind})`);
          } else if (target && !edited) {
            console.log(`${key}: already article ${target} — skipped`);
          } else {
            const res = await createArticle({ title: c.title, articletext: art, catid: c.catid });
            state.ids[key] = res.data.attributes.id;
            console.log(`${key}: ${c.kind} article ${state.ids[key]}`);
          }
          if (!known) state.done.push(key); // ردشده (denied/skipped) و منتشرنشده هم ثبت می‌شوند — ویرایش بعدی همچنان دوباره بررسی می‌شود
        }
      }
      state.lastUpdateId = u.update_id;
    } catch (e) {
      const dl404 = /TG download 404/.test(e.message);
      const soft = !e.status || e.status >= 500 || e.status === 429; // خطای موقت شبکه/سرور
      const tries = (state.tries[key] || 0) + (soft || dl404 ? 1 : 0);
      if (soft || dl404) state.tries[key] = tries;
      const cap = dl404 ? 10 : 3;
      const retry = (soft || dl404) && tries < cap;
      if (retry) {
        state.lastUpdateId = u.update_id - 1; // اجرای بعدی از همین پیام ادامه می‌یابد
        const hint = /properties of undefined/.test(e.message) ? ' post=' + JSON.stringify(post).slice(0, 300) : '';
        console.log(`${key}: retry-later #${tries} ${e.message}${hint}`);
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
  // آزمون تعیین‌کننده: عکس تازه توسط خود بات ارسال و بلافاصله دانلود می‌شود
  const chat = process.env.TG_CHAT_ID;
  if (chat) {
    try {
      const px = Buffer.from('/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwcJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AVN//2Q==', 'base64');
      const fd = new FormData();
      fd.append('chat_id', process.env.TG_CHAT_ID);
      fd.append('photo', new Blob([px], { type: 'image/jpeg' }), 't.jpg');
      const sent = await fetch(`${TG}/sendPhoto`, { method: 'POST', body: fd }).then(r => r.json());
      if (!sent.ok) throw new Error('sendPhoto: ' + JSON.stringify(sent).slice(0, 120));
      const fid = sent.result.photo[sent.result.photo.length - 1].file_id;
      const { execSync } = await import('node:child_process');
      let dlOk = false;
      for (let i = sent.result.photo.length - 1; i >= 0 && !dlOk; i--) {
        const fp = (await tg('getFile', { file_id: sent.result.photo[i].file_id })).file_path;
        for (const tool of ['node', 'curl']) {
          try {
            if (tool === 'curl') execSync(`curl -sS -o /dev/null -w "%{http_code}" "https://api.telegram.org/file/bot${BOT_TOKEN}/${fp}"`, { stdio: ['ignore', 'pipe', 'pipe'] });
            else await downloadFile(sent.result.photo[i].file_id);
            console.log(`fresh size ${i} via ${tool}: OK`);
            dlOk = true;
            break;
          } catch (e) {
            const out = String(e.stdout || e.message || '').slice(-160).replace(/\n/g, ' ');
            console.log(`fresh size ${i} via ${tool}: FAIL ${out}`);
          }
        }
      }
      if (dlOk) console.log('CONCLUSION: node/fetch issue — switch download to curl');
      else console.log('CONCLUSION: Telegram blocks file downloads from GitHub runners — need proxy');
      await tg('deleteMessage', { chat_id: process.env.TG_CHAT_ID, message_id: sent.result.message_id }).catch(() => {});
    } catch (e) { console.log('fresh TG upload+download FAILED:', e.message.slice(0, 160)); }
  }
  try {
    for (const p of ['local-images:/images/tg', 'local-images:/tg']) {
      const m = await joomla('GET', `${JC}/media/files?path=${encodeURIComponent(p)}`);
      const items = (m.data || []).map(f => f.attributes && f.attributes.name).join(' | ');
      console.log(`dir ${p}: ${items || '(empty)'}`);
    }
  } catch (e) { console.log('tg dir listing FAILED:', e.message.slice(0, 120)); }
  const px = Buffer.from('/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwcJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AVN//2Q==', 'base64');
  const dfn = `diag-test-${Date.now()}.jpg`;
  for (const [label, url, body] of [
    ['file with full path', `${JC}/media/files`, { path: `local-images:/${MEDIA_DIR}/${dfn}`, content: px.toString('base64') }],
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

export { parseStructured, toHtml, extOf, denied, buildContent };
