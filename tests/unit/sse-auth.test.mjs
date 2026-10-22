import test from 'node:test';
import assert from 'node:assert/strict';
import { GatewayClient } from '../../src/core/gateway-client.js';
import { isScreenIdentityRejected } from '../../src/core/screen-auth.js';

test('SSE: rechazo de token conserva código para activar recuperación', async t => {
  let headers;
  t.mock.method(globalThis, 'fetch', async (_url, opts) => {
    headers=opts.headers;
    return Response.json({error:'SCREEN_AUTH_INVALID'}, {status:401});
  });
  const client=new GatewayClient('https://example.test','expired-token');
  await assert.rejects(client.streamDisplayState('screen-1',()=>{},new AbortController().signal), error=>{
    assert.equal(error.code,'SCREEN_AUTH_INVALID');
    assert.equal(isScreenIdentityRejected(error.code),true);
    return true;
  });
  assert.equal(headers.Authorization,'Bearer expired-token');
});

test('SSE: fallo transitorio no se confunde con identidad revocada', async t => {
  t.mock.method(globalThis, 'fetch', async()=>Response.json({error:'SERVICE_UNAVAILABLE'}, {status:503}));
  const client=new GatewayClient('https://example.test','still-valid');
  await assert.rejects(client.streamDisplayState('screen-1',()=>{},new AbortController().signal), error=>{
    assert.equal(isScreenIdentityRejected(error.code),false);
    return true;
  });
  assert.equal(client.screenToken,'still-valid');
});
