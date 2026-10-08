const JC = `${process.env.JOOMLA_BASE}/api/index.php/v1`;
const H = { Accept: 'application/vnd.api+json', 'X-Joomla-Token': process.env.JOOMLA_TOKEN };
// 1) همه دسته‌ها
const c = await fetch(`${JC}/content/categories?filter[published]=1&page[limit]=100`, { headers: H });
const cj = await c.json();
for (const x of cj.data || []) {
  const a = x.attributes;
  console.log(`cat ${a.id} | parent=${a.parent_id} | ${a.title}`);
}
// 2) catid مطالب جدید
for (const id of [5636, 5635, 5634, 5633, 5632]) {
  const r = await fetch(`${JC}/content/articles/${id}`, { headers: H });
  const j = await r.json();
  const a = j.data?.attributes || {};
  const cat = j.data?.relationships?.category?.data?.id;
  console.log(`art ${id} | catid=${a.catid ?? cat} | state=${a.state} | ${String(a.title).slice(0, 40)}`);
}
