import test from 'node:test';
import assert from 'node:assert/strict';
import { requestOnce } from './requestOnce.js';

test('requestOnce shares a pending request and allows retry after failure', async () => {
  let calls = 0;
  let release;
  const pendingRequest = new Promise((resolve) => { release = resolve; });
  const first = requestOnce('shared-request-test', async () => {
    calls += 1;
    return pendingRequest;
  });
  const replay = requestOnce('shared-request-test', () => {
    calls += 1;
    return 'unexpected';
  });
  assert.strictEqual(first, replay);
  release('shared');
  assert.equal(await first, 'shared');
  assert.equal(calls, 1);

  await assert.rejects(requestOnce('retry-request-test', async () => {
    calls += 1;
    throw new Error('temporary failure');
  }), /temporary failure/);
  assert.equal(await requestOnce('retry-request-test', async () => {
    calls += 1;
    return 'retried';
  }), 'retried');
  assert.equal(calls, 3);
});
