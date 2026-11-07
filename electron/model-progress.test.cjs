const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createModelProgress } = require('./model-progress.cjs');

test('progress includes all files, not just the current file', () => {
  const progress = createModelProgress([{ digest: 'a', size: 1000 }, { digest: 'b', size: 1000 }]);
  assert.equal(progress({ digest: 'a', total: 1000, completed: 1000 }).percent, 50);
  const next = progress({ digest: 'b', total: 1000, completed: 200 });
  assert.equal(next.completed, 1200);
  assert.equal(next.total, 2000);
  assert.equal(next.percent, 60);
});

test('percentage preserves hundredths such as 1.11%', () => {
  const progress = createModelProgress([{ digest: 'a', size: 10000 }]);
  assert.equal(progress({ digest: 'a', total: 10000, completed: 111 }).percent, 1.11);
});

test('repeated and resumed file events do not double-count or regress', () => {
  const progress = createModelProgress([{ digest: 'a', size: 1000 }, { digest: 'b', size: 1000 }]);
  progress({ digest: 'a', total: 1000, completed: 800 });
  assert.equal(progress({ digest: 'a', total: 1000, completed: 400 }).completed, 800);
  assert.equal(progress({ digest: 'a', total: 1000, completed: 800 }).percent, 40);
});

test('100% is reserved for successful verification and completion', () => {
  const progress = createModelProgress([{ digest: 'a', size: 1000 }]);
  assert.equal(progress({ digest: 'a', total: 1000, completed: 1000 }).percent, 99.99);
  assert.equal(progress({ status: 'verifying sha256 digest' }).percent, 99.99);
  assert.equal(progress({ status: 'success' }).percent, 100);
});

test('missing manifest never reports a misleading per-file percentage', () => {
  const progress = createModelProgress();
  assert.equal(progress({ digest: 'a', total: 1000, completed: 500 }).percent, null);
  assert.equal(progress({ status: 'success' }).percent, 100);
});