import test from 'node:test';
import assert from 'node:assert/strict';
import { createStateGuard } from '../../src/core/state-guard.js';

const deferred = () => {
  let resolve;
  const promise = new Promise(r => { resolve = r; });
  return { promise, resolve };
};

test('Display: polling tardío no pisa evento SSE más reciente', async () => {
  const guard = createStateGuard();
  const poll = deferred();
  const snapshot = guard.capture('screen-a');
  let shown = 'WAITING';
  shown = 'READY';
  guard.advance(); // Evento SSE recibido durante polling.
  poll.resolve('WAITING');
  const stale = await poll.promise;
  if (guard.isCurrent(snapshot, 'screen-a')) shown = stale;
  assert.equal(shown, 'READY');
});

test('Display: respuesta de identidad antigua no pisa pantalla reenrolada', async () => {
  const guard = createStateGuard();
  const snapshot = guard.capture('screen-old');
  const poll = deferred();
  poll.resolve('old-state');
  assert.equal(guard.isCurrent(snapshot, 'screen-new'), false);
  assert.equal(await poll.promise, 'old-state');
});

test('Display: respuesta vigente sí se aplica; posterior avance la invalida', () => {
  const guard = createStateGuard();
  const snapshot = guard.capture('screen-a');
  assert.equal(guard.isCurrent(snapshot, 'screen-a'), true);
  guard.advance();
  assert.equal(guard.isCurrent(snapshot, 'screen-a'), false);
  assert.equal(guard.isCurrent(guard.capture('screen-a'), 'screen-a'), true);
});
