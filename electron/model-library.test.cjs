const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseLibrary, fetchLibrary, fetchVersions } = require('./model-library.cjs');

test('library lists all 270 models without an 80-result limit', async () => {
  const html = Array.from({ length: 270 }, (_, i) => `<a href="/library/model-${i}"><p>Model ${i}</p><span>vision</span><span>7b</span></a>`).join('');
  const rows = await fetchLibrary('', async (url) => {
    assert.equal(url, 'https://ollama.com/library?sort=popular');
    return { ok: true, text: async () => html };
  });
  assert.equal(rows.length, 270);
  assert.deepEqual(rows[269].capabilities, ['vision']);
});

test('versions preserve exact tags and distinguish cloud-only versions', () => {
  const rows = parseLibrary('<a href="/library/llama3.2:1b"><span>llama3.2:1b</span>1.3GB • 128K</a><a href="/library/llama3.2:1b">llama3.2:1b</a><a href="/library/llama3.2:cloud">Cloud</a>', true);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].name, 'llama3.2:1b');
  assert.equal(rows[0].size, '1.3GB');
  assert.equal(rows[1].cloudOnly, true);
});

test('search includes live model metadata and handles network failures honestly', async () => {
  const rows = await fetchLibrary('vision', async (url) => {
    assert.equal(url, 'https://ollama.com/search?q=vision');
    return { ok: true, text: async () => '<a href="/library/llava"><p>Images &amp; screenshots</p><span>vision</span></a>' };
  });
  assert.equal(rows[0].description, 'Images & screenshots');
  await assert.rejects(fetchLibrary('', async () => ({ ok: false, status: 503 })), /unavailable/);
});

test('version lookup rejects missing models instead of inventing tag names', async () => {
  await assert.rejects(fetchVersions('missing', async () => ({ ok: true, text: async () => '' })), /No downloadable versions/);
});