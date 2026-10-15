const BOT = process.env.BOT_TOKEN;
const r = await fetch(`https://api.telegram.org/bot${BOT}/getUpdates?limit=5&allowed_updates=["channel_post","edited_channel_post"]`);
const j = await r.json();
console.log('=== RAW TELEGRAM UPDATES ===');
for (const u of j.result) {
  const p = u.channel_post || u.edited_channel_post;
  if (!p) continue;
  console.log('msg_id:', p.message_id);
  console.log('  author_signature:', p.author_signature);
  console.log('  forward_from:', p.forward_from ? JSON.stringify(p.forward_from) : 'none');
  console.log('  forward_from_chat:', p.forward_from_chat ? JSON.stringify(p.forward_from_chat) : 'none');
  console.log('  from:', JSON.stringify(p.from));
  console.log('  sender_chat:', JSON.stringify(p.sender_chat));
  console.log('  date:', new Date(p.date * 1000).toISOString());
  console.log('---');
}