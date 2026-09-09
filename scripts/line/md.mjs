export const SHIPPING_FIELDS = ['title', 'excerpt', 'seoDescription', 'coverImageAlt'];

export function splitFrontmatter(md) {
  const m = md.match(/^---\n([\s\S]*?)\n---\n\n?([\s\S]*)$/);
  if (!m) return { meta: {}, body: md.trim(), order: [] };
  const meta = {}, order = [];
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (!kv) continue;
    let v = kv[2].trim();
    if (v.startsWith('[')) v = JSON.parse(v);
    else if (v === 'true' || v === 'false') v = v === 'true';
    else v = v.replace(/^"(.*)"$/, '$1');
    meta[kv[1]] = v; order.push(kv[1]);
  }
  return { meta, body: m[2].replace(/\n$/, ''), order };
}

export function joinFrontmatter(meta, body, order = Object.keys(meta)) {
  const fm = order.filter((k) => k in meta).map((k) => {
    const v = meta[k];
    if (Array.isArray(v)) return `${k}: [${v.map((x) => JSON.stringify(x)).join(', ')}]`;
    if (typeof v === 'boolean' || /^\d{4}-\d{2}-\d{2}$/.test(String(v)) || k.startsWith('cover') && k !== 'coverImageAlt') return `${k}: ${v}`;
    return `${k}: "${String(v).replace(/"/g, '\\"')}"`;
  });
  return `---\n${fm.join('\n')}\n---\n\n${body}\n`;
}
