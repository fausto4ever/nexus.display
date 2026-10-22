import test from 'node:test';
import assert from 'node:assert/strict';
import { waitForReconnect } from '../../src/core/reconnect.js';

test('SSE: una generación abortada no espera el backoff de 30 segundos', async () => {
  const controller = new AbortController();
  const started = performance.now();
  const pending = waitForReconnect(30000, controller.signal);
  controller.abort();
  await pending;
  assert.ok(performance.now() - started < 1000);
});

test('SSE: señal ya abortada retorna inmediatamente', async () => {
  const controller = new AbortController();
  controller.abort();
  await waitForReconnect(30000, controller.signal);
});

test('SSE: backoff sin interrupción cumple espera corta', async () => {
  const started = performance.now();
  await waitForReconnect(20, new AbortController().signal);
  assert.ok(performance.now() - started >= 10);
});
