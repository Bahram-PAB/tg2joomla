// پروب: متن کامل مطالب 5631-5636 + وضعیت فایل‌های عکس
const JC = `${process.env.JOOMLA_BASE}/api/index.php/v1`;
const H = { Accept: 'application/vnd.api+json', 'X-Joomla-Token': process.env.JOOMLA_TOKEN };
for (const id of [5631, 5632, 5633, 5634, 5635, 5636]) {
  try {
    const r = await fetch(`${JC}/content/articles/${id}`, { headers: H }).then(x => x.json());
    const a = r.data.attributes;
    const t = String(a.text || '');
    const imgs = [...t.matchAll(/<img [^>]*src="([^"]+)"/g)].map(m => m[1]).join(',');
    console.log(`${id} mod=${a.modified || a.modified_time || '-'} audio=${/<audio/.test(t)} imgs=[${imgs}] len=${t.length}`);
    console.log(`   head: ${t.slice(0, 160).replace(/\s+/g, ' ')}`);
  } catch (e) { console.log(`${id} ERR ${e.message}`); }
}
for (const f of ['tg-2283.jpg', 'tg-2284.jpg', 'tg-2285.jpg', 'tg-2286.jpg']) {
  try {
    const r = await fetch(`${JC}/media/files?path=${encodeURIComponent(`local-images:/images/tg/${f}`)}`, { headers: H });
    console.log(`file ${f}: ${r.status}`);
  } catch (e) { console.log(`file ${f}: ERR ${e.message}`); }
}
