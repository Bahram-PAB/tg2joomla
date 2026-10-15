const BOT = process.env.BOT_TOKEN;
const r = await fetch(`https://api.telegram.org/bot${BOT}/getUpdates?limit=5&allowed_updates=["channel_post","edited_channel_post"]`);
const j = await r.json();
for (const u of j.result) {
  const p = u.channel_post || u.edited_channel_post;
  if (!p) continue;
  console.log('msg', p.message_id, 'keys:', Object.keys(p).filter(k=>!['photo','video','document','caption_entities','entities'].includes(k)));
  console.log('  from:', p.from);
  console.log('  sender_chat:', p.sender_chat);
  console.log('  author_signature:', p.author_signature);
  console.log('  forward_from:', p.forward_from);
  console.log('  forward_from_chat:', p.forward_from_chat);
  console.log('---');
}