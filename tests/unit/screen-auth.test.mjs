import test from 'node:test';
import assert from 'node:assert/strict';
import { isScreenIdentityRejected } from '../../src/core/screen-auth.js';
import { GatewayClient } from '../../src/core/gateway-client.js';

test('Display: solo rechazo explícito de pantalla permite reenrolamiento', () => {
  for (const code of ['SCREEN_AUTH_REQUIRED', 'SCREEN_AUTH_INVALID', 'SCREEN_NOT_FOUND']) {
    assert.equal(isScreenIdentityRejected(code), true, code);
  }
  for (const code of ['NETWORK_ERROR', 'REQUEST_TIMEOUT', 'HTTP_503', 'FORBIDDEN', undefined, null]) {
    assert.equal(isScreenIdentityRejected(code), false, String(code));
  }
});

test('Display: caída temporal de Gateway no invalida el token del cliente', async t => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ok:false,error:'SERVICE_UNAVAILABLE'}, {status:503}));
  const client = new GatewayClient('https://qa.test', 'screen-token-still-valid');
  await assert.rejects(client.queryDisplayState({screenId:'screen-1'}), error => {
    assert.equal(isScreenIdentityRejected(error?.data?.error), false);
    return true;
  });
  assert.equal(client.screenToken, 'screen-token-still-valid');
});

test('Display: token rechazado se distingue de una interrupción de red', async t => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ok:false,error:'SCREEN_AUTH_INVALID'}, {status:401}));
  const client = new GatewayClient('https://qa.test', 'expired-screen-token');
  await assert.rejects(client.queryDisplayState({screenId:'screen-1'}), error => {
    assert.equal(isScreenIdentityRejected(error?.data?.error), true);
    return true;
  });
});
