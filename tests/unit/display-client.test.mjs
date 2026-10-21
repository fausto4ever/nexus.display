import test from 'node:test';
import assert from 'node:assert/strict';
import {GatewayClient} from '../../src/core/gateway-client.js';
import {registerRenderer,getRenderer} from '../../src/core/renderer-registry.js';

test('Display: state GET exige Bearer de pantalla y codifica screenId', async t => {
  const calls=[];
  t.mock.method(globalThis,'fetch',async(url,opt)=>{calls.push({url,opt});return Response.json({ok:true,items:[]});});
  const c=new GatewayClient('https://qa.test/','screen-test-token');
  await c.getDisplayState('pantalla 1');
  assert.equal(calls[0].url,'https://qa.test/api/displays/pantalla%201/state');
  assert.equal(calls[0].opt.headers.Authorization,'Bearer screen-test-token');
  assert.equal(calls[0].opt.method,'GET');
});

test('Display: POST estado incremental conserva revision y filtros', async t => {
  const calls=[];
  t.mock.method(globalThis,'fetch',async(url,opt)=>{calls.push({url,opt});return Response.json({ok:true,revision:4});});
  const c=new GatewayClient('https://qa.test','screen-test-token');
  await c.queryDisplayState({screenId:'scr-1',revision:3,configRevision:1});
  assert.equal(calls[0].url,'https://qa.test/api/display/state');
  assert.equal(calls[0].opt.method,'POST');
  assert.deepEqual(JSON.parse(calls[0].opt.body),{screenId:'scr-1',revision:3,configRevision:1});
  assert.equal(calls[0].opt.headers.Authorization,'Bearer screen-test-token');
});

test('Display: bootstrap publico nunca expone Bearer y rechazo Gateway no se silencia', async t => {
  const calls=[];
  t.mock.method(globalThis,'fetch',async(url,opt)=>{calls.push({url,opt});return Response.json({ok:true});});
  const c=new GatewayClient('https://qa.test','private-screen-token');
  await c.getBootstrap();
  assert.equal(calls[0].url,'https://qa.test/bootstrap');
  assert.equal(calls[0].opt.headers.Authorization,undefined);
});

test('Display: error 403 conserva codigo y no pinta un estado falso', async t => {
  t.mock.method(globalThis,'fetch',async()=>Response.json({ok:false,error:'FORBIDDEN'},{status:403}));
  const c=new GatewayClient('https://qa.test','wrong-token');
  await assert.rejects(c.getDisplayState('screen'),e=>e.code==='FORBIDDEN'&&e.status===403);
});

test('Display: renderer de otra app no suplanta fallback',()=>{
  const fallback=()=> 'default';
  const access=()=> 'access';
  registerRenderer('default',fallback);
  registerRenderer('CONTROL_ACCESS',access);
  assert.equal(getRenderer('CONTROL_ACCESS'),access);
  assert.equal(getRenderer('not-known'),fallback);
  assert.throws(()=>registerRenderer('',access),/Renderer inválido/);
});
