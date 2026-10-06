const JC = `${process.env.JOOMLA_BASE}/api/index.php/v1`;
const H = { Accept: 'application/vnd.api+json', 'X-Joomla-Token': process.env.JOOMLA_TOKEN };
for (const p of ['local-images:/tg/tg-2283.jpg', 'local-images:/tg/tg-2286.jpg', 'local-images:/images/tg/tg-2143.jpg', 'local-images:/tg/tg-2143.jpg']) {
  try { const r = await fetch(`${JC}/media/files?path=${encodeURIComponent(p)}&content=1`, { headers: H }); const j = await r.json(); const c = j.data && j.data.attributes && j.data.attributes.content; console.log(`file ${p.split('/').slice(-2).join('/')}: ${r.status}${c ? ' b64len=' + String(c.length) : ''}`); }
  catch (e) { console.log(`file ${p}: ERR ${e.message.slice(0, 60)}`); }
}
try { const l = await fetch(`${JC}/media/files?path=${encodeURIComponent('local-images:/tg')}`, { headers: H }); const j = await l.json(); console.log('dir /tg/:', (j.data || []).map(f => f.attributes && f.attributes.name).join(' | ') || '(empty)'); }
catch (e) { console.log('dir /tg/: ERR ' + e.message.slice(0, 60)); }
for (const id of [5632, 5634]) {
  try {
    const r = await fetch(`${JC}/content/articles/${id}`, { headers: H });
    const t = r.ok ? (await r.json()).data.attributes.text : '';
    console.log(`--- ${id} text[0:500]: ${String(t).replace(/\s+/g, ' ').slice(0, 500)}`);
  } catch (e) { console.log(`article ${id}: ERR ${e.message.slice(0, 60)}`); }
}
