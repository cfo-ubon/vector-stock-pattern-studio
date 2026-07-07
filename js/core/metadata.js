export function metadataCsv(schema) {
  const m = schema.metadata;
  const esc = (v) => `"${String(v || '').replaceAll('"', '""')}"`;
  const kw = m.keywords.join(', ');
  const rows = [
    ['platform', 'title', 'description', 'keywords', 'category'],
    ['Adobe Stock', m.title.slice(0, 70), m.description.slice(0, 200), kw, 'Illustrations'],
    ['Shutterstock', m.title.slice(0, 80), m.description.slice(0, 200), kw, 'Vector'],
    ['Freepik', m.title, '', kw, 'Vector'],
    ['Etsy', m.title.slice(0, 140), m.description, kw, 'Digital Paper'],
  ];
  return rows.map((r) => r.map(esc).join(',')).join('\n');
}
