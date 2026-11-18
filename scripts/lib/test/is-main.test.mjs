import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { isMain } from '../is-main.mjs';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'is-main-'));

test('isMain detects the entry file through a symlinked directory', () => {
  const base = tmp();
  try {
    const real = path.join(base, 'real');
    fs.mkdirSync(real);
    const file = path.join(real, 'entry.mjs');
    fs.writeFileSync(file, '');
    const link = path.join(base, 'link');
    fs.symlinkSync(real, link);
    const viaSymlink = path.join(link, 'entry.mjs');
    assert.notEqual(viaSymlink, file);
    assert.equal(isMain(pathToFileURL(fs.realpathSync(file)).href, viaSymlink), true);
    assert.equal(isMain(pathToFileURL(file).href, viaSymlink), true);
  } finally { fs.rmSync(base, { recursive: true, force: true }); }
});

test('isMain is false for another file', () => {
  const base = tmp();
  try {
    const a = path.join(base, 'a.mjs'), b = path.join(base, 'b.mjs');
    fs.writeFileSync(a, ''); fs.writeFileSync(b, '');
    assert.equal(isMain(pathToFileURL(a).href, b), false);
  } finally { fs.rmSync(base, { recursive: true, force: true }); }
});

test('isMain is false when argv1 is undefined', () => {
  assert.equal(isMain(import.meta.url, undefined), false);
});

test('isMain is false when a path does not exist', () => {
  assert.equal(isMain('file:///nonexistent/x.mjs', '/nonexistent/x.mjs'), false);
});
