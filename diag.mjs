const JC = `${process.env.JOOMLA_BASE}/api/index.php/v1`;
const H = { Accept: 'application/vnd.api+json', 'X-Joomla-Token': process.env.JOOMLA_TOKEN };
const r = await fetch(`${JC}/content/articles/5631`, { method: 'DELETE', headers: H });
console.log('delete 5631:', r.status);
const v = await fetch(`${JC}/content/articles/5631`, { headers: H });
console.log('verify GET after delete:', v.status);
