export const SHIPPING_FIELDS = ['title', 'excerpt', 'seoDescription', 'coverImageAlt'];

const TOP_LEVEL_KV = /^(\w+):\s*(.+)$/;

function parseValue(v) {
  v = v.trim();
  if (v.startsWith('[')) return JSON.parse(v);
  if (v === 'true' || v === 'false') return v === 'true';
  const q = v.match(/^"(.*)"$/);
  if (q) return q[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  return v;
}

export function splitFrontmatter(md) {
  const m = md.match(/^---\n([\s\S]*?)\n---\n\n?([\s\S]*)$/);
  if (!m) return { meta: {}, body: md.trim(), raw: [] };
  const raw = m[1].split('\n');
  const meta = {};
  for (const line of raw) {
    const kv = line.match(TOP_LEVEL_KV);
    if (!kv) continue;
    meta[kv[1]] = parseValue(kv[2]);
  }
  return { meta, body: m[2].replace(/\n$/, ''), raw };
}

export function serialiseValue(value, originalLine) {
  if (Array.isArray(value)) return `[${value.map((x) => JSON.stringify(x)).join(', ')}]`;
  if (typeof value === 'boolean') return String(value);
  const wasQuoted = originalLine !== undefined && /^"(.*)"$/.test(originalLine.trim());
  if (wasQuoted) return `"${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  if (originalLine !== undefined) return String(value);
  // No original line to model: default to quoting strings, leaving booleans/arrays as handled above.
  return `"${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

export function joinFrontmatter(meta, body, raw = []) {
  const seen = new Set();
  const lines = raw.map((line) => {
    const kv = line.match(TOP_LEVEL_KV);
    if (!kv) return line;
    const key = kv[1];
    if (!(key in meta)) return line;
    seen.add(key);
    return `${key}: ${serialiseValue(meta[key], kv[2])}`;
  });
  for (const key of Object.keys(meta)) {
    if (seen.has(key)) continue;
    lines.push(`${key}: ${serialiseValue(meta[key])}`);
  }
  return `---\n${lines.join('\n')}\n---\n\n${body}\n`;
}
