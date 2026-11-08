// Browser-independent public Ollama catalog parsing, shared by tests and desktop.
function text(html) {
  return html.replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

function parseLibrary(html, tags = false) {
  const rows = new Map();
  for (const match of html.matchAll(/<a\b[^>]*href=["']\/library\/([^"'?#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const name = decodeURIComponent(match[1]);
    if (!/^[a-z0-9._-]+(?::[a-z0-9._-]+)?$/i.test(name) || (tags && !name.includes(':')) || (!tags && name.includes(':'))) continue;
    const body = match[2];
    const plain = text(body);
    const capabilities = [...new Set([...body.matchAll(/<span\b[^>]*>\s*(vision|tools|thinking|embedding|cloud|audio)\s*<\/span>/gi)].map((m) => m[1].toLowerCase()))];
    const sizes = [...new Set([...body.matchAll(/<span\b[^>]*>\s*([\d.]+[bm]|e\d+b)\s*<\/span>/gi)].map((m) => m[1].toLowerCase()))];
    const description = text(body.match(/<p\b[^>]*>([\s\S]*?)<\/p>/i)?.[1] || '') || (tags ? plain : 'Ollama model');
    const size = plain.match(/\b[\d.]+\s*(?:GB|MB|KB|TB)\b/i)?.[0];
    const row = { name, description, sizes, capabilities, ...(size ? { size } : {}), cloudOnly: /(?:^|-)cloud$/i.test(name.split(':')[1] || '') || (tags && /\bcloud\b/i.test(plain) && !size) };
    const old = rows.get(name);
    if (!old || body.length > old.length) rows.set(name, { ...row, length: body.length });
  }
  return [...rows.values()].map(({ length, ...row }) => row);
}

async function fetchLibrary(query, fetcher = fetch) {
  const q = String(query || '').trim();
  const url = new URL(q ? `https://ollama.com/search?q=${encodeURIComponent(q)}` : 'https://ollama.com/library?sort=popular');
  const res = await fetcher(url.href, { signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`Ollama library is unavailable (${res.status}).`);
  const rows = parseLibrary(await res.text());
  if (!q && !rows.length) throw new Error('Could not read the Ollama library. Please retry.');
  return rows;
}

async function fetchVersions(name, fetcher = fetch) {
  const family = String(name).split(':')[0];
  if (!/^[a-z0-9._-]+$/i.test(family)) throw new Error('Invalid library model name.');
  const res = await fetcher(`https://ollama.com/library/${encodeURIComponent(family)}/tags`, { signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`Could not load model versions (${res.status}).`);
  const rows = parseLibrary(await res.text(), true).filter((row) => row.name.startsWith(`${family}:`));
  if (!rows.length) throw new Error('No downloadable versions were found for this model.');
  return rows;
}

module.exports = { parseLibrary, fetchLibrary, fetchVersions };