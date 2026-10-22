import test from 'node:test';
import assert from 'node:assert/strict';
import {saveAuthorizedScreenConfig} from '../../src/core/save-screen-config.js';
const config={configurationMode:'SELF_SERVICE',enabled:true};
test('saves authorized fields and accepts Gateway configuration',async()=>{
  let body;
  const client={saveDisplayConfig:async(id,patch)=>{body={id,patch};return {config:{...config,rows:7},configRevision:'rev-2'};}};
  const result=await saveAuthorizedScreenConfig({client,screenId:'screen-A',config,changes:{rows:7},currentScreenId:()=> 'screen-A'});
  assert.deepEqual(body,{id:'screen-A',patch:{rows:7}});
  assert.equal(result.config.rows,7);
  assert.equal(result.revision,'rev-2');
});
test('reads canonical configuration if save response lacks config',async()=>{
  let reads=0;
  const client={saveDisplayConfig:async()=>({ok:true}),getDisplayConfig:async()=>{reads++;return {config:{...config,rows:3,configRevision:'rev-3'}};}};
  const result=await saveAuthorizedScreenConfig({client,screenId:'A',config,changes:{rows:3},currentScreenId:()=> 'A'});
  assert.equal(reads,1);assert.equal(result.revision,'rev-3');
});
test('never reads or applies stale screen after re-enrollment',async()=>{
  let current='A',reads=0;
  const client={saveDisplayConfig:async()=>{current='B';return {ok:true};},getDisplayConfig:async()=>{reads++;return {};}};
  const result=await saveAuthorizedScreenConfig({client,screenId:'A',config,changes:{rows:2},currentScreenId:()=>current});
  assert.deepEqual(result,{stale:true});assert.equal(reads,0);
});
test('rejects unauthorized writes without calling Gateway',async()=>{
  let calls=0;
  const client={saveDisplayConfig:async()=>{calls++;return {};}};
  await assert.rejects(saveAuthorizedScreenConfig({client,screenId:'A',config:{configurationMode:'LOCKED'},changes:{rows:2},currentScreenId:()=> 'A'}));
  assert.equal(calls,0);
});
