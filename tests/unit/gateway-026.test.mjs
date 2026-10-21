import test from 'node:test';
import assert from 'node:assert/strict';
import {GatewayClient} from '../../src/core/gateway-client.js';

const client=()=>new GatewayClient('https://qa.test','secret-token');
const mockFetch=(t,handler)=>t.mock.method(globalThis,'fetch',handler);

test('Gateway 0.26: guardar configuracion usa POST, screenId confiable y omite displayId',async t=>{
  let req;
  mockFetch(t,async(url,options)=>{req={url,options};return Response.json({ok:true});});
  await client().saveDisplayConfig('SCR-REAL',{screenId:'SCR-FALSO',displayId:'old',rows:12});
  assert.equal(req.url,'https://qa.test/api/display/config/save');
  assert.equal(req.options.method,'POST');
  assert.equal(req.options.headers.Authorization,'Bearer secret-token');
  assert.deepEqual(JSON.parse(req.options.body),{rows:12,screenId:'SCR-REAL'});
});

test('Gateway 0.26: leer configuracion utiliza ruta canonica',async t=>{
  let url;
  mockFetch(t,async value=>{url=value;return Response.json({ok:true,config:{rows:4}});});
  await client().getDisplayConfig('screen #2');
  assert.equal(url,'https://qa.test/api/displays/screen%20%232/config');
});

test('Gateway 0.26: LOCKED y FORBIDDEN rechazan guardado',async t=>{
  mockFetch(t,async()=>Response.json({ok:false,error:'DISPLAY_CONFIG_LOCKED'},{status:403}));
  await assert.rejects(client().saveDisplayConfig('scr',{rows:5}),e=>e.status===403&&e.code==='DISPLAY_CONFIG_LOCKED');
});

test('Gateway 0.26: preview es publico y nunca transmite Bearer',async t=>{
  let request;
  mockFetch(t,async(url,options)=>{request={url,options};return Response.json({ok:true});});
  await client().getDisplayPreview({locationId:'A'});
  assert.equal(request.url,'https://qa.test/api/display/preview?locationId=A');
  assert.equal(request.options.headers.Authorization,undefined);
});

test('SSE: recibe eventos state fragmentados, ignora heartbeat y usa Bearer',async t=>{
  const encoder=new TextEncoder();
  let request;
  mockFetch(t,async(url,options)=>{
    request={url,options};
    const body=new ReadableStream({start(controller){
      controller.enqueue(encoder.encode(': heartbeat\\n\\nevent: state\\ndata: {"revision":'));
      controller.enqueue(encoder.encode('7,"items":[]}\\n\\n'));
      controller.close();
    }});
    return new Response(body,{headers:{'content-type':'text/event-stream'}});
  });
  const states=[];
  await client().streamDisplayState('scr 1',state=>states.push(state));
  assert.equal(request.url,'https://qa.test/api/displays/scr%201/state');
  assert.equal(request.options.headers.Authorization,'Bearer secret-token');
  assert.deepEqual(states,[{revision:7,items:[]}]);
});

test('SSE: rechazo HTTP conserva codigo de error',async t=>{
  mockFetch(t,async()=>Response.json({error:'SCREEN_AUTH_INVALID'},{status:403}));
  await assert.rejects(client().streamDisplayState('scr',()=>{}),e=>e.code==='SCREEN_AUTH_INVALID');
});

test('SSE: señal AbortController llega a fetch',async t=>{
  let signal;
  mockFetch(t,async(_url,options)=>{
    signal=options.signal;
    return new Response(new ReadableStream({start(controller){controller.close();}}));
  });
  const controller=new AbortController();
  await client().streamDisplayState('scr',()=>{},controller.signal);
  assert.equal(signal,controller.signal);
});

test('POST incremental: error 503 no se transforma en estado vacio',async t=>{
  mockFetch(t,async()=>Response.json({ok:false,error:'DISPLAY_STATE_UNAVAILABLE'},{status:503}));
  await assert.rejects(client().queryDisplayState({screenId:'scr',revision:5}),e=>e.status===503&&e.code==='DISPLAY_STATE_UNAVAILABLE');
});
