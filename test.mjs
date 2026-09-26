import assert from 'node:assert';

process.env.TEST = '1';
const { parseStructured, toHtml, extOf } = await import('./bot.mjs');

// سطر اول عنوان + بدنه
assert.deepEqual(parseStructured('آندرژ بارگیل عازم دائولاگیری می شود\n\nمتن کامل خبر اینجاست.'), {
  title: 'آندرژ بارگیل عازم دائولاگیری می شود',
  body: 'متن کامل خبر اینجاست.',
});
// تک‌خطی، خالی، عنوان خیلی کوتاه یا بلند → رد
assert.equal(parseStructured('سلام'), null);
assert.equal(parseStructured('تیتر\n'), null);
assert.equal(parseStructured('x'.repeat(151) + '\n\nمتن'), null);
assert.equal(parseStructured('ab\n\nمتن'), null);
// HTML امن
assert.equal(toHtml('a<b\n\nc\nd'), '<p>a&lt;b</p>\n<p>c<br>d</p>');
// پسوند فایل
assert.equal(extOf('file.mp3', 'audio/mpeg'), 'mp3');
assert.equal(extOf('', 'audio/ogg'), 'ogg');
assert.equal(extOf('photos/file_42.jpg', 'image/jpeg'), 'jpg');

console.log('OK');
