import test from 'node:test';
import assert from 'node:assert/strict';
import { createPollGate } from '../../src/core/poll-gate.js';

test('Display: ticks repetidos no duplican llamadas mientras polling está pendiente',async()=>{
  const gate=createPollGate();let release;const pending=new Promise(resolve=>{release=resolve;});let calls=0;
  const first=gate.run(async()=>{calls++;await pending;});
  assert.equal(gate.inFlight,true);
  assert.equal(await gate.run(async()=>{calls++;}),false);
  assert.equal(calls,1);
  release();assert.equal(await first,true);
  assert.equal(gate.inFlight,false);
  assert.equal(await gate.run(async()=>{calls++;}),true);
  assert.equal(calls,2);
});

test('Display: error de red libera gate y permite nuevo polling',async()=>{
  const gate=createPollGate();
  await assert.rejects(gate.run(async()=>{throw new Error('offline');}),/offline/);
  assert.equal(gate.inFlight,false);
  assert.equal(await gate.run(async()=>{}),true);
});
