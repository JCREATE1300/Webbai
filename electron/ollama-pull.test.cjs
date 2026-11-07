const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { createModelProgress } = require('./model-progress.cjs');

function runtime(chunks) {
  let settings = '{}';
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(require.resolve('./ollama.cjs'), 'utf8'), {
    module, __dirname: '/tmp', process: { env: {}, platform: 'linux' },
    TextDecoder, Set, fetch: async (url) => url.endsWith('/api/tags') ? { ok: true } : {
      ok: true, body: new ReadableStream({ start(controller) {
        for (const chunk of chunks) controller.enqueue(new TextEncoder().encode(chunk));
        controller.close();
      } }),
    },
    require: (name) => {
      if (name === 'electron') return { app: { getPath: () => '/tmp' } };
      if (name === 'fs') return {
        mkdirSync() {}, readFileSync: () => settings,
        writeFileSync: (_file, content) => { settings = content; },
      };
      if (name === './model-progress.cjs') return {
        createModelProgress, getModelLayers: async () => [{ digest: 'a', size: 1000 }, { digest: 'b', size: 1000 }],
      };
      return require(name);
    },
  });
  return module.exports;
}

test('pull reports overall progress and selects model after final success without a newline', async () => {
  const api = runtime([
    '{"digest":"a","total":1000,"completed":1000}\n{"digest":"b",',
    '"total":1000,"completed":200}\n{"status":"success"}',
  ]);
  const events = [];
  await api.pullModel('llama3.2', (event) => events.push(event));
  assert.equal(events[1].percent, 50);
  assert.equal(events[2].percent, 60);
  assert.equal(events.at(-1).percent, 100);
  assert.equal(api.readSettings().model, 'llama3.2');
});

test('in-stream errors reject the download without selecting a model', async () => {
  const api = runtime(['{"error":"model not found"}\n']);
  await assert.rejects(api.pullModel('missing', () => {}), /model not found/);
  assert.equal(api.readSettings().model, undefined);
});

test('interrupted stream cannot silently succeed', async () => {
  const api = runtime(['{"digest":"a","total":1000,"completed":100}\n']);
  await assert.rejects(api.pullModel('llama3.2', () => {}), /ended before it finished/);
  assert.equal(api.readSettings().model, undefined);
});