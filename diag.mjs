// پروب: مطالب اخیر دسته 90 — عنوان + وجود عکس/صوت
const JC = `${process.env.JOOMLA_BASE}/api/index.php/v1`;
const H = { Accept: 'application/vnd.api+json', 'X-Joomla-Token': process.env.JOOMLA_TOKEN };
const r = await fetch(`${JC}/content/articles?page[limit]=12&filter[catid]=90&filter[ordering]=id&filter[direction]=DESC`, { headers: H }).then(x => x.json());
for (const a of r.data || []) {
  const t = String(a.attributes.text || '');
  const img = (t.match(/<img [^>]*src="([^"]+)"/) || [])[1] || '-';
  const hasAudio = /<audio/.test(t);
  console.log(`${a.attributes.id} | img=${img} | audio=${hasAudio} | ${String(a.attributes.title).slice(0, 70)}`);
}
