import test from 'node:test';
import assert from 'node:assert/strict';
import { avatarDimensions, isRasterAvatar, prepareAvatar } from '../src/plugins/SettingsPlugin/sections/avatarImage.ts';

test('avatar resizing bounds both dimensions, preserves orientation, and avoids upscaling', () => {
  assert.deepEqual(avatarDimensions(4000, 3000), { width: 256, height: 192 });
  assert.deepEqual(avatarDimensions(3000, 4000), { width: 192, height: 256 });
  assert.deepEqual(avatarDimensions(80, 120), { width: 80, height: 120 });
  assert.deepEqual(avatarDimensions(1, 10000), { width: 1, height: 256 });
});

test('invalid or excessively large decoded images cannot create a canvas', () => {
  for (const [width, height] of [[0, 5], [10, NaN], [Infinity, 1], [8000, 8000]]) {
    assert.throws(() => avatarDimensions(width, height), /valid dimensions/);
  }
});

test('avatar file signatures accept supported raster formats and reject SVG or truncated headers', () => {
  const bytes = values => new Uint8Array(values);
  assert.equal(isRasterAvatar(bytes([137, 80, 78, 71, 13, 10, 26, 10])), true);
  assert.equal(isRasterAvatar(bytes([255, 216, 255, 224])), true);
  assert.equal(isRasterAvatar(new TextEncoder().encode('GIF89a')), true);
  assert.equal(isRasterAvatar(new TextEncoder().encode('RIFF....WEBP')), true);
  assert.equal(isRasterAvatar(new TextEncoder().encode('<svg></svg>')), false);
  assert.equal(isRasterAvatar(bytes([137, 80, 78])), false);
});

test('a mislabeled vector file is rejected before any browser image decoding', async () => {
  const file = new File(['<svg xmlns="http://www.w3.org/2000/svg"></svg>'], 'fake.png', { type: 'image/png' });
  await assert.rejects(prepareAvatar(file), /SVG files are not supported/);
  await assert.rejects(prepareAvatar(new File([], 'empty.png', { type: 'image/png' })), /smaller than 10 MB/);
});
