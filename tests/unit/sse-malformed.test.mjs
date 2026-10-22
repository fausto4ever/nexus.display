import test from 'node:test';
import assert from 'node:assert/strict';
import { GatewayClient } from '../../src/core/gateway-client.js';

test('SSE: trama JSON corrupta no descarta evento posterior válido',async t=>{
  const encoder=new TextEncoder();
  t.mock.method(globalThis,'fetch',async()=>new Response(new ReadableStream({start(controller){
    controller.enqueue(encoder.encode('event: state\\ndata: {broken}\\n\\nevent: state\\ndata: {"revision":9,"items":[]}\\n\\n'.replaceAll('\\n','\n')));
    controller.close();
  }})));
  const states=[];
  await new GatewayClient('https://qa.test','token').streamDisplayState('screen',state=>states.push(state));
  assert.deepEqual(states,[{revision:9,items:[]}]);
});

test('SSE: excepción real del consumidor se propaga',async t=>{
  const encoder=new TextEncoder();
  t.mock.method(globalThis,'fetch',async()=>new Response(new ReadableStream({start(controller){
    controller.enqueue(encoder.encode('event: state\\ndata: {"revision":1}\\n\\n'.replaceAll('\\n','\n')));
    controller.close();
  }})));
  await assert.rejects(new GatewayClient('https://qa.test','token').streamDisplayState('screen',()=>{throw new Error('render failed');}),/render failed/);
});
