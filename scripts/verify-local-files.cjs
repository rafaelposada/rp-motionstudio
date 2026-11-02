// RP MotionStudio edition: modifications by Rafael Posada (2026). See NOTICE.
// Run only against the isolated test server:
// RP_MOTION_CONFIG_DIR=<test-only folder> PORT=3002 ...
// node scripts/verify-local-files.cjs http://127.0.0.1:3002
const assert = require('node:assert/strict'), fs = require('node:fs/promises'), path = require('node:path');
async function main() {
  const base = process.argv[2];
  if (base !== 'http://127.0.0.1:3002') throw new Error('Use the isolated test server on port 3002.');
  const post = (route, body, headers = {}) => fetch(base + route, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
  for (const kind of ['exports', 'drafts', 'templates']) {
    const directory = path.resolve('verification', `saved-${kind}`); await fs.mkdir(directory, { recursive: true });
    const response = await post('/api/destinations', { action: 'set', kind, path: directory });
    assert.equal(response.status, 200); assert.equal((await response.json())[kind], directory);
  }
  assert.equal((await post('/api/destinations', { action: 'set', kind: 'exports', path: '../relative' })).status, 400);
  assert.equal((await post('/api/destinations', { action: 'set', kind: 'unsupported', path: '/tmp' })).status, 400);
  assert.equal((await post('/api/destinations', { action: 'set', kind: 'exports', path: '/tmp' }, { Origin: 'https://example.com' })).status, 403);
  assert.equal((await post('/api/export', { action: 'begin' }, { Origin: 'https://example.com' })).status, 403);
  assert.equal((await post('/api/export', { action: 'begin' }, { Origin: 'http://localhost:3002' })).status, 403, 'Origin must match the actual HTTP Host, not Next canonical localhost URL');
  assert.equal((await fetch(base + '/api/project-package', { method: 'POST', headers: { Origin: 'https://example.com' }, body: 'invalid' })).status, 403);
  const destinations = await fetch(base + '/api/destinations').then(r => r.json());
  assert.equal(destinations.exports, path.resolve('verification/saved-exports'));
  const begin = await post('/api/export', { action: 'begin' }, { Origin: base }); assert.equal(begin.status, 200, 'Same-origin browser exports must work');
  const session = await begin.json();
  assert.match(session.sessionId, /^[\da-f-]{36}$/);
  assert.equal((await post('/api/export', { action: 'cancel', sessionId: session.sessionId })).status, 200);
  assert.equal((await post('/api/export', { action: 'frame', sessionId: session.sessionId, index: 0, dataUrl: '' })).status, 400);
  console.log('Local file API checks passed: 3 destinations, persistence, invalid paths, cross-site write rejection, cancellation and session validation.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
