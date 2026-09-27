const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const dist = path.join(__dirname, '..', 'dist');
const manifest = JSON.parse(fs.readFileSync(path.join(dist, 'manifest.json'), 'utf8'));

assert.equal(manifest.manifest_version, 3);
assert.deepEqual(manifest.background.scripts, ['background.js']);
assert.equal(manifest.background.service_worker, undefined);
assert.equal(manifest.permissions.includes('offscreen'), false);
assert.ok(manifest.browser_specific_settings.gecko.id);
assert.ok(manifest.host_permissions.some(origin => origin.includes('huggingface.co')));

for (const file of [
  'background.js',
  'content-script.js',
  'ui/popup.html',
  'ui/popup.js',
  'ui/settings.html',
  'ui/settings.js',
  'ui/pico.min.css',
]) {
  assert.ok(fs.existsSync(path.join(dist, file)), `Missing packaged file: ${file}`);
}

assert.equal(fs.existsSync(path.join(dist, 'offscreen.js')), false);
assert.equal(fs.existsSync(path.join(dist, 'offscreen.html')), false);
assert.match(
  fs.readFileSync(path.join(dist, 'ui/settings.html'), 'utf8'),
  /href="pico\.min\.css"/
);
assert.equal(fs.readdirSync(path.join(dist, 'wasm')).some(file => file.endsWith('.wasm')), true);

console.log('Firefox package manifest and resources passed.');