const JC = `${process.env.JOOMLA_BASE}/api/index.php/v1`;
const H = { Accept: 'application/vnd.api+json', 'X-Joomla-Token': process.env.JOOMLA_TOKEN };
const r = await fetch(`${JC}/content/articles?filter[catid]=90&filter[ordering]=id&filter[direction]=DESC&page[limit]=20`, { headers: H });
const j = await r.json();
for (const a of j.data || []) {
  const x = a.attributes;
  const t = String(x.text || '');
  const imgs = [...t.matchAll(/<img [^>]*src="([^"]+)"/g)].map(m => m[1]);
  console.log(`${x.id} | img=${imgs.join(',') || '-'} | ${String(x.title).slice(0, 65)}`);
}
