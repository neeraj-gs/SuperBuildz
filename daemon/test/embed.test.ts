/**
 * Turning a share link into a player.
 *
 * Tested from the daemon's runner because it is the only one there is, and
 * because the failure it prevents is worth catching: every host here has a
 * share URL that is *not* an embed URL, and putting the share URL in an iframe
 * shows the visitor a sign-in page. On the landing section whose entire
 * argument is that the product works, that reads as the product not working.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { embedFor } from '../../ui/src/features/landing/embed.ts';

test('no url is no player, not a broken one', () => {
  assert.equal(embedFor(''), null);
  assert.equal(embedFor('   '), null);
});

test('a Loom share link becomes a Loom embed', () => {
  const e = embedFor('https://www.loom.com/share/a1b2c3d4e5f67890abcdef1234567890');
  assert.equal(e?.kind, 'iframe');
  assert.match(e!.src, /^https:\/\/www\.loom\.com\/embed\/a1b2c3d4e5f67890abcdef1234567890\?/);
  assert.doesNotMatch(e!.src, /autoplay/, 'it starts paused unless asked');
});

test('a Loom link already in embed form is left alone', () => {
  assert.match(embedFor('https://www.loom.com/embed/abc123')!.src, /\/embed\/abc123/);
});

test('a Google Drive share link becomes /preview, both ways Drive writes it', () => {
  assert.equal(
    embedFor('https://drive.google.com/file/d/1AbC-dEfGhIjKlMnOpQ/view?usp=sharing')?.src,
    'https://drive.google.com/file/d/1AbC-dEfGhIjKlMnOpQ/preview',
  );
  assert.equal(
    embedFor('https://drive.google.com/open?id=1AbC-dEfGhIjKlMnOpQ')?.src,
    'https://drive.google.com/file/d/1AbC-dEfGhIjKlMnOpQ/preview',
  );
});

test('YouTube, in each of the shapes people paste', () => {
  for (const url of [
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://youtu.be/dQw4w9WgXcQ',
    'https://www.youtube.com/embed/dQw4w9WgXcQ',
  ]) {
    assert.match(embedFor(url)!.src, /youtube-nocookie\.com\/embed\/dQw4w9WgXcQ/, url);
  }
});

test('a file a video element can take is given to one', () => {
  const e = embedFor('https://files.example.com/super-builds-run.mp4');
  assert.equal(e?.kind, 'video');
  assert.equal(e?.src, 'https://files.example.com/super-builds-run.mp4');
});

test('autoplay is added only when it is asked for, and to the right hosts', () => {
  assert.match(embedFor('https://www.loom.com/share/abc123', true)!.src, /autoplay=1/);
  assert.match(embedFor('https://youtu.be/dQw4w9WgXcQ', true)!.src, /autoplay=1/);
});

test('anything unrecognised is still shown rather than swallowed', () => {
  const e = embedFor('https://player.vimeo.com/video/12345');
  assert.equal(e?.kind, 'iframe');
  assert.equal(e?.src, 'https://player.vimeo.com/video/12345');
});
