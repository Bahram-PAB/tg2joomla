const BOT = process.env.BOT_TOKEN;
const CHAT = process.env.TG_CHAT_ID || '-1001042002375';
// 1) خام getUpdates از آخرین آفست state
const st = await (await fetch('https://raw.githubusercontent.com/Bahram-PAB/tg2joomla/main/state/processed.json')).json();
console.log('state.lastUpdateId=', st.lastUpdateId);
const u = await (await fetch(`https://api.telegram.org/bot${BOT}/getUpdates?offset=${st.lastUpdateId + 1}&limit=20&timeout=0`)).json();
console.log('getUpdates ok=', u.ok, 'count=', u.result?.length);
for (const r of u.result || []) {
  const m = r.channel_post || r.edited_channel_post || r.message;
  console.log(` upd ${r.update_id} ${r.channel_post ? 'post' : r.edited_channel_post ? 'edit' : 'msg'} id=${m?.message_id} chat=${m?.chat?.id} text=${String(m?.text || m?.caption || '').slice(0, 60).replace(/\n/g, ' ')}`);
}
// 2) آخرین پیام‌های کانال از پیش‌نمایش عمومی (روی اکشنز باز می‌شود)
const h = await (await fetch('https://t.me/s/koohnameh')).text();
const ids = [...h.matchAll(/data-post="koohnameh\/(\d+)"/g)].map(m => +m[1]);
console.log('public page latest ids:', ids.slice(-6).join(','));
