import test from 'node:test';
import assert from 'node:assert/strict';
import { recoverScreenIdentity } from '../../src/core/identity-recovery.js';

const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return{promise,resolve};};

test('Display: revocación limpia token, vincula pantalla, refresca y abre SSE en orden', async()=>{
  const steps=[];const client={screenToken:'old',setScreenToken(token){this.screenToken=token;steps.push('token:'+token);}};
  const approved=deferred();let screenId='old';
  const recovery=recoverScreenIdentity({
    resetStream:()=>steps.push('abort-sse'),
    clearIdentity:()=>steps.push('clear-storage'),
    client,
    markUnlinked:()=>{screenId='';steps.push('unlinked');},
    enroll:async()=>{steps.push('enroll');return approved.promise;},
    setIdentity:next=>{screenId=next.screenId;steps.push('linked');},
    refresh:async()=>{assert.equal(screenId,'new');assert.equal(client.screenToken,'new-token');steps.push('refresh');},
    connectStream:()=>{steps.push('connect-sse');}
  });
  await Promise.resolve();
  assert.equal(client.screenToken,'');
  assert.equal(screenId,'');
  assert.deepEqual(steps,['abort-sse','clear-storage','token:','unlinked','enroll']);
  approved.resolve({screenId:'new',screenToken:'new-token'});
  await recovery;
  assert.deepEqual(steps,['abort-sse','clear-storage','token:','unlinked','enroll','token:new-token','linked','refresh','connect-sse']);
});

test('Display: sin aprobación no se abre SSE con token antiguo', async()=>{
  const events=[];const client={setScreenToken:t=>events.push('token:'+t)};
  await assert.rejects(recoverScreenIdentity({
    resetStream:()=>events.push('stop'),clearIdentity:()=>events.push('clear'),client,
    markUnlinked:()=>{},enroll:async()=>({screenId:'new'}),
    setIdentity:()=>events.push('linked'),refresh:()=>events.push('refresh'),connectStream:()=>events.push('stream')
  }),/SCREEN_ENROLLMENT_INCOMPLETE/);
  assert.equal(events.includes('stream'),false);
  assert.equal(events.includes('linked'),false);
});

test('Display: no conecta SSE si el refresco inicial falla', async()=>{
  let connected=false;
  await assert.rejects(recoverScreenIdentity({
    resetStream:()=>{},clearIdentity:()=>{},client:{setScreenToken:()=>{}},markUnlinked:()=>{},
    enroll:async()=>({screenId:'new',screenToken:'token'}),setIdentity:()=>{},
    refresh:async()=>{throw new Error('gateway unavailable');},connectStream:()=>{connected=true;}
  }),/gateway unavailable/);
  assert.equal(connected,false);
});
