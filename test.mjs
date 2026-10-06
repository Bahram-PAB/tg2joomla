import assert from 'node:assert';

process.env.TEST = '1';
const { parseStructured, toHtml, extOf, denied, buildContent } = await import('./bot.mjs');

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
assert.equal(extOf('', 'image/jpeg'), 'jpg');
assert.equal(extOf('track.MP3', ''), 'mp3');

// فیلتر پیام‌های غیرخبری
assert.equal(denied('🏔 پیش‌بینی یکشنبه 5 مهر'), true);
assert.equal(denied('📡 گزارش کانال‌های فعال امروز'), true);
assert.equal(denied('🔥 پست‌های داغ امروز'), true);
assert.equal(denied('🎙 پادکست روز "14 مهر 1405" کوهنامه'), true);
assert.equal(denied('تصاویر دیدنی امروز به انتخاب کوهنامه.'), true);
assert.equal(denied('صعود تازه به دیواره علم‌کوه'), false);
assert.equal(denied('پیش‌بینی بارش برف در ارتفاعات البرز'), false); // خبر واقعی با «پیش‌بینی» رد نمی‌شود
// ساخت محتوا: پیام هوا → denied؛ خبر عادی → text
assert.equal(buildContent({ text: '🏔 پیش‌بینی یکشنبه 5 مهر\n\n━━━\n⛰️ دماوند' }).kind, 'denied');
assert.equal(buildContent({ text: 'صعود دیواره علم‌کوه\n\nخبر کامل اینجاست.' }).kind, 'text');
// باگ رگرسیون: پیام فیلترشده باید رشته skip برگرداند نه شیء بدون عنوان (وگرنه Joomla 400 می‌دهد)
const { handlePost } = await import('./bot.mjs');
assert.equal(await handlePost({ text: '🏔 پیش‌بینی یکشنبه 5 مهر\n\n━━━\n⛰️ دماوند' }, 'k', {}), 'denied');

console.log('OK');
