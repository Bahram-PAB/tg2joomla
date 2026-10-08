const JC = `${process.env.JOOMLA_BASE}/api/index.php/v1`;
const H = { Accept: 'application/vnd.api+json', 'X-Joomla-Token': process.env.JOOMLA_TOKEN };
// مطالب جدید 5637-5648: دسته و وضعیت
for (const id of [5637, 5638, 5640, 5643, 5645, 5648]) {
  const r = await fetch(`${JC}/content/articles/${id}`, { headers: H });
  const j = await r.json();
  const a = j.data?.attributes || {};
  console.log(`art ${id} | catid=${a.catid} | state=${a.state} | ${String(a.title).slice(0, 45)}`);
}
// دسته 90: همه مطالب
const c = await fetch(`${JC}/content/articles?filter[catid]=90&filter[ordering]=id&filter[direction]=DESC&page[limit]=30`, { headers: H });
const cj = await c.json();
console.log('--- cat 90 count:', cj.data?.length);
for (const a of cj.data || []) console.log(` 90#${a.attributes.id} s=${a.attributes.state} ${String(a.attributes.title).slice(0, 50)}`);
