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
// ساخت محتوا: فعلا فقط عکس + کپشن منتقل می‌شود؛ متن/صدا رد می‌شوند
const caption = 'صعود دیواره علم‌کوه\n\nخبر کامل اینجاست.';
assert.equal(buildContent({ photo: [{ file_id: 'x' }], caption }).kind, 'photo');
assert.equal(buildContent({ photo: [{ file_id: 'x' }] }).kind, 'photo-no-caption-skipped');
assert.equal(buildContent({ text: caption }).kind, 'type-skipped');
assert.equal(buildContent({ audio: { file_id: 'a', mime_type: 'audio/mpeg' }, caption }).kind, 'type-skipped');
// باگ رگرسیون: پیام ردشده باید رشته skip برگرداند نه شیء بدون عنوان (وگرنه Joomla 400 می‌دهد)
const { handlePost } = await import('./bot.mjs');
assert.equal(await handlePost({ text: caption }, 'k', {}), 'type-skipped');
assert.equal(await handlePost({ audio: { file_id: 'a', mime_type: 'audio/mpeg' }, caption }, 'k', {}), 'type-skipped');

console.log('OK');
