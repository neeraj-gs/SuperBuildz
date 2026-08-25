/**
 * Walking the disk to choose a folder.
 *
 * The native dialog cannot be tested without a person to press it, so what is
 * tested here is the half that has to work when the native dialog does not:
 * the listing that appears inside the interface instead.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { browse, places } from '../src/picker.ts';

function tree(): string {
  const root = mkdtempSync(join(tmpdir(), 'sb-pick-'));
  for (const d of ['node_modules', '.git', 'dist', '.hidden', 'notes', 'zebra-site', 'apple-site']) mkdirSync(join(root, d));
  writeFileSync(join(root, 'zebra-site', 'package.json'), '{}');
  writeFileSync(join(root, 'apple-site', 'index.html'), '<!doctype html>');
  writeFileSync(join(root, 'a-file.txt'), 'not a folder');
  return root;
}

test('the noise is left out and the websites come first', () => {
  const root = tree();
  const l = browse(root);
  assert.equal(l.ok, true);

  const names = l.entries.map((e) => e.name);
  // Build output, version control and dot-folders are not what anybody is
  // looking for, and they are most of what a real folder contains.
  for (const gone of ['node_modules', '.git', 'dist', '.hidden']) assert.equal(names.includes(gone), false, `${gone} should not be listed`);
  // Files are not choosable here, so they are not shown.
  assert.equal(names.includes('a-file.txt'), false);

  assert.deepEqual(names, ['apple-site', 'zebra-site', 'notes'], 'sites first, then alphabetical');
  assert.equal(l.entries[0].site, true, 'an index.html counts');
  assert.equal(l.entries[1].site, true, 'a package.json counts');
  assert.equal(l.entries[2].site, undefined);
});

test('there is always a way back up, and never above the root', () => {
  const root = tree();
  assert.equal(browse(root).up, dirname(root));
  // Whatever the root of this platform is called, it is its own parent.
  const top = browse(browse('/').path);
  assert.equal(top.up, undefined);
});

test('a path that is not there says so instead of throwing', () => {
  const l = browse(join(tree(), 'no-such-folder'));
  assert.equal(l.ok, false);
  assert.match(l.reason ?? '', /nothing at that path/i);
  // Even a failure carries the places, so the panel has somewhere to go next.
  assert.ok(l.places.length > 0);
});

test('a file is refused as a folder', () => {
  const l = browse(join(tree(), 'a-file.txt'));
  assert.equal(l.ok, false);
  assert.match(l.reason ?? '', /file, not a folder/i);
});

test('the places are real, distinct directories', () => {
  const p = places();
  assert.ok(p.length > 0);
  assert.equal(p[0].name, 'Home');
  assert.equal(new Set(p.map((x) => x.path)).size, p.length, 'no path listed twice');
});
