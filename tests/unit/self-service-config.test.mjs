import test from 'node:test';
import assert from 'node:assert/strict';
import {canSelfConfigure,selfServicePatch} from '../../src/core/self-service-config.js';

const self={configurationMode:'SELF_SERVICE',enabled:true};
test('Gateway 0.26: solo pantalla SELF_SERVICE activa permite editar',()=>{
  assert.equal(canSelfConfigure(self),true);
  for(const configurationMode of ['ADMIN_ONLY','LOCKED',undefined])assert.equal(canSelfConfigure({configurationMode}),false);
  assert.equal(canSelfConfigure({...self,enabled:false}),false);
});
test('Gateway 0.26: acepta únicamente campos y rangos soportados',()=>{
  assert.deepEqual(selfServicePatch(self,{rows:12,locationId:'gate-1',showDistance:false}),{rows:12,locationId:'gate-1',showDistance:false});
  for(const patch of [{screenId:'hijack'},{displayId:'id'},{configurationMode:'SELF_SERVICE'},{filters:{}},{view:'MIXED'},{rows:0},{rows:101},{rows:2.5},{showCounter:'false'}])assert.throws(()=>selfServicePatch(self,patch));
  assert.throws(()=>selfServicePatch({configurationMode:'LOCKED'},{rows:5}));
});
