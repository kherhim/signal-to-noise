/* Structured data on the built site. Runs against dist/, so build first
   (npm run build); skips with a note when there is no build. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const DIST = new URL('../../../dist/', import.meta.url);
const built = fs.existsSync(new URL('insights/', DIST));

function blocks(html) {
  return [...html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)]
    .map((m) => JSON.parse(m[1]));
}

function essayPages() {
  const dir = new URL('insights/', DIST);
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name !== 'tag')
    .map((d) => path.join(dir.pathname, d.name, 'index.html'))
    .filter((f) => fs.existsSync(f));
}

test('every essay page carries a valid BlogPosting and breadcrumb', { skip: !built && 'no dist/ build' }, () => {
  const pages = essayPages();
  assert.ok(pages.length > 0, 'no essay pages found in dist/insights');
  for (const file of pages) {
    const ld = blocks(fs.readFileSync(file, 'utf8'));
    const post = ld.find((b) => b['@type'] === 'BlogPosting');
    assert.ok(post, `${file}: no BlogPosting`);
    for (const key of ['@type', 'headline', 'datePublished', 'author']) {
      assert.ok(post[key], `${file}: BlogPosting missing ${key}`);
    }
    assert.ok(!Number.isNaN(Date.parse(post.datePublished)), `${file}: bad datePublished`);
    assert.ok(ld.some((b) => b['@type'] === 'BreadcrumbList'), `${file}: no BreadcrumbList`);
  }
});

test('homepage and About describe the site and its author', { skip: !built && 'no dist/ build' }, () => {
  const home = blocks(fs.readFileSync(new URL('index.html', DIST), 'utf8')).map((b) => b['@type']);
  assert.deepEqual(home.sort(), ['Person', 'WebSite']);
  const about = blocks(fs.readFileSync(new URL('about/index.html', DIST), 'utf8'));
  assert.equal(about[0]['@type'], 'ProfilePage');
  assert.equal(about[0].mainEntity.name, 'Himanshu Kher');
});

/* Published essays straight from the content files: everything not marked draft. */
function publishedCount() {
  const dir = new URL('../../../src/content/insights/', import.meta.url);
  return fs.readdirSync(dir)
    .filter((f) => /\.mdx?$/.test(f))
    .filter((f) => {
      const fm = fs.readFileSync(new URL(f, dir), 'utf8').split(/^---\s*$/m)[1] ?? '';
      return !/^draft:\s*true\b/m.test(fm);
    }).length;
}

test('llms.txt lists every published essay', { skip: !built && 'no dist/ build' }, () => {
  const txt = fs.readFileSync(new URL('llms.txt', DIST), 'utf8');
  assert.match(txt, /^# Signal to Noise\n/);
  const essays = txt.split('## Essays\n')[1].split('\n## ')[0];
  const links = essays.match(/^\s*- \[.+\]\(https:\/\/signal-to-noise\.co\/insights\/[^)]+\/\): .+$/gm) ?? [];
  assert.equal(links.length, publishedCount());
  assert.equal(new Set(links.map((l) => l.match(/\((.+?)\)/)[1])).size, links.length, 'duplicate essay');
});

test('sitemap gives every essay a lastmod', { skip: !built && 'no dist/ build' }, () => {
  const xml = fs.readFileSync(new URL('sitemap-0.xml', DIST), 'utf8');
  const essays = [...xml.matchAll(/<url><loc>https:\/\/signal-to-noise\.co\/insights\/(?!tag\/)[^<]+\/<\/loc>(<lastmod>[^<]+<\/lastmod>)?/g)];
  assert.equal(essays.length, publishedCount());
  assert.ok(essays.every((m) => m[1]), 'essay without lastmod');
});
