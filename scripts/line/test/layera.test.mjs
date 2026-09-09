import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { inspectFile, cleanFile, serviceUp, resolveServiceUrl, plausibleClean } from '../layera.mjs';

const tmp = path.join(os.tmpdir(), `layera-${Date.now()}.md`);
fs.writeFileSync(tmp, 'Clean text​ with a zero-width space.\n');

test.after(() => {
  fs.rmSync(tmp, { force: true });
});

test('inspect flags the planted zero-width space and clean removes it', { skip: !serviceUp() && 'watermarks service not running' }, () => {
  assert.equal(inspectFile(tmp).suspicious, true);
  const c = cleanFile(tmp);
  assert.equal(c.changed, true);
  assert.equal(fs.readFileSync(tmp, 'utf8').includes('​'), false);
  assert.equal(inspectFile(tmp).suspicious, false);
});

test('resolveServiceUrl accepts only local hosts', () => {
  assert.equal(resolveServiceUrl({}), 'http://127.0.0.1:8765');
  assert.equal(resolveServiceUrl({ WATERMARKS_SERVICE_URL: 'http://localhost:9000' }), 'http://localhost:9000');
  assert.throws(() => resolveServiceUrl({ WATERMARKS_SERVICE_URL: 'https://example.com' }), /must be local/);
});

test('plausibleClean rejects empty or heavily shortened output', () => {
  assert.equal(plausibleClean(1000, 998), true);
  assert.equal(plausibleClean(1000, 0), false);
  assert.equal(plausibleClean(1000, 500), false);
});
