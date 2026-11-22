const { test } = require('node:test');
const assert = require('node:assert/strict');
const { APP_URL } = require('./app-url.cjs');

test('desktop opens chat directly instead of the home screen', () => {
  const url = new URL(APP_URL);
  assert.equal(url.origin, 'https://webbai.lovable.app');
  assert.equal(url.pathname, '/chat');
});

test('desktop packaging includes the startup URL module', () => {
  const desktopPackage = require('./package.json');
  assert.ok(desktopPackage.build.files.includes('app-url.cjs'));
});
