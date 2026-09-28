// پروب: لیست دسته‌بندی‌ها و شناسه مطالب نویسندگان
const JC = `${process.env.JOOMLA_BASE}/api/index.php/v1`;
const H = { Accept: 'application/vnd.api+json', 'X-Joomla-Token': process.env.JOOMLA_TOKEN };
const r = await fetch(`${JC}/content/categories?page[limit]=100`, { headers: H });
const d = await r.json();
for (const a of d.data || []) {
  const { title, id, parent_id } = a.attributes;
  console.log(`id=${id} parent=${parent_id} "${title}"`);
}
