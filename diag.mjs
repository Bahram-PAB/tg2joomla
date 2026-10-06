const JC = `${process.env.JOOMLA_BASE}/api/index.php/v1`;
const H = { Accept: 'application/vnd.api+json', 'X-Joomla-Token': process.env.JOOMLA_TOKEN, 'Content-Type': 'application/vnd.api+json' };
const p = await fetch(`${JC}/content/articles/5631`, { method: 'PATCH', headers: H, body: JSON.stringify({ state: -2 }) });
console.log('trash PATCH:', p.status);
const d = await fetch(`${JC}/content/articles/5631`, { method: 'DELETE', headers: { Accept: 'application/vnd.api+json', 'X-Joomla-Token': process.env.JOOMLA_TOKEN } });
console.log('DELETE after trash:', d.status);
const v = await fetch(`${JC}/content/articles/5631`, { headers: { Accept: 'application/vnd.api+json', 'X-Joomla-Token': process.env.JOOMLA_TOKEN } });
if (v.status === 200) { const j = await v.json(); console.log('final state:', j.data.attributes.state); } else console.log('final GET:', v.status);
