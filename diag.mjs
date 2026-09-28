// پروب: تست آپلود overwrite با فیلدهای مختلف Joomla
import { readFileSync } from 'node:fs';

const JC = `${process.env.JOOMLA_BASE}/api/index.php/v1`;
const H = { 'Content-Type': 'application/json', Accept: 'application/vnd.api+json', 'X-Joomla-Token': process.env.JOOMLA_TOKEN };

const path = 'local-images:/tg/test-probe.jpg';
const content = readFileSync('t2146.jpg').toString('base64');

async function j(method, url, body) {
  const r = await fetch(url, { method, headers: H, body: body ? JSON.stringify(body) : undefined });
  const t = await r.text();
  console.log(`  ${method} ${url.split('/').pop()?.slice(0, 20)} → ${r.status} ${t.slice(0, 120)}`);
  return { status: r.status, text: t };
}

// 1. Upload without overwrite (expect 400 if exists, or 200 if first time)
console.log('1. POST no overwrite:');
await j('POST', `${JC}/media/files`, { path, content });

// 2. POST with override:true in body
console.log('2. POST override:true body:');
await j('POST', `${JC}/media/files`, { path, content, override: true });

// 3. POST with overwrite=1 query param
console.log('3. POST overwrite=1 query:');
await j('POST', `${JC}/media/files?overwrite=1`, { path, content });

// 4. POST with overwrite:true in body
console.log('4. POST overwrite:true body:');
await j('POST', `${JC}/media/files`, { path, content, overwrite: true });

// 5. DELETE via query param
console.log('5. DELETE query path:');
await j('DELETE', `${JC}/media/files?path=${encodeURIComponent(path)}`);

// 6. DELETE via body
console.log('6. DELETE body path:');
await j('DELETE', `${JC}/media/files`, { path });

// 7. GET to check current state
console.log('7. GET file:');
await j('GET', `${JC}/media/files?path=${encodeURIComponent(path)}&content=0`);
