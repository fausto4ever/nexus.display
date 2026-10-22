import { canSelfConfigure, selfServicePatch } from './core/self-service-config.js';
import { loadConfig } from './core/config.js';
import { GatewayClient } from './core/gateway-client.js';
import { registerRenderer, getRenderer } from './core/renderer-registry.js';
import { renderControlAccess, refreshLiveTimers } from './renderers/control-access.js';

registerRenderer('control-access', renderControlAccess);
registerRenderer('default', renderControlAccess);

const root = document.querySelector('#app');
const splash = document.querySelector('#startup-splash');
const SCREEN_ID_KEY = 'nexus.display.screenId';
const SCREEN_TOKEN_KEY = 'nexus.display.screenToken';
const ENROLLMENT_POLL_MS = 2000;
const RETRY_DELAYS = [2000, 5000, 10000, 30000, 60000];

// TEMPORARY PREVIEW TEST ONLY — REMOVE after we finish validating historical Nexus.Display previews.
// Any Cloudflare version/preview host like <version>-nexus-display.shindarked.workers.dev skips screen enrollment.
// Production nexus-display.shindarked.workers.dev keeps the normal screen enrollment/authentication flow.
const PREVIEW_HOST_SUFFIX = '-nexus-display.shindarked.workers.dev';
function isPreviewDeployment(){return window.location.hostname.toLowerCase().endsWith(PREVIEW_HOST_SUFFIX);}
function previewStatePath(config={}){const params=new URLSearchParams();params.set('view',String(config.view||config.mode||'DELIVERIES'));for(const key of ['locationId','entityType','rows']){const value=config[key];if(value!==undefined&&value!==null&&value!=='')params.set(key,String(value));}return `/api/display/preview?${params.toString()}`;}

const demoState = cfg => ({online:false,revision:0,updatedAt:new Date().toLocaleTimeString(),config:cfg,counters:{inside:428,entriesToday:437,exitsToday:9},pickupRequests:[{requestId:'DEMO-1',studentName:'Alumno en puerta',status:'AT_GATE',priority:1,distanceMeters:8,vehicle:{description:'Vehículo gris'}},{requestId:'DEMO-2',studentName:'Alumno en camino',status:'ON_THE_WAY',priority:3,distanceMeters:42,vehicle:{description:'SUV blanca'}}]});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
import { waitForReconnect } from './core/reconnect.js';
import { createStateGuard } from './core/state-guard.js';
import { isScreenIdentityRejected } from './core/screen-auth.js';
import { recoverScreenIdentity } from './core/identity-recovery.js';
import { createPollGate } from './core/poll-gate.js';
function hideSplash(){if(!splash||splash.classList.contains('hide'))return;requestAnimationFrame(()=>splash.classList.add('hide'));setTimeout(()=>splash.remove(),650);}
function normalizeRemoteConfig(config){if(!config||typeof config!=='object')return{};return{...config,mode:config.view||config.mode};}
function normalizeDisplayItems(items){if(!Array.isArray(items))return[];const seen=new Set();return items.filter(item=>item&&['WAITING','READY','AT_GATE'].includes(String(item.status||'').toUpperCase())).map(item=>({requestId:String(item.requestId||item.pickupRequestId||item.id||''),studentName:item.studentName||item.displayName||null,status:String(item.status).toUpperCase(),locationId:item.locationId,levelId:item.levelId,gradeId:item.gradeId,groupId:item.groupId,levelName:item.levelName,gradeName:item.gradeName,groupName:item.groupName,priority:item.priority,distanceMeters:item.distanceMeters,requestedAt:item.requestedAt,updatedAt:item.updatedAt,arrivalTriggeredAt:item.arrivalTriggeredAt,arrivalMode:item.arrivalMode})).filter(item=>{if(!item.requestId||seen.has(item.requestId))return false;seen.add(item.requestId);return true;});}
function storedIdentity(){try{return{screenId:localStorage.getItem(SCREEN_ID_KEY)||'',screenToken:localStorage.getItem(SCREEN_TOKEN_KEY)||''};}catch{return{screenId:'',screenToken:''};}}
function saveIdentity(screenId,screenToken){localStorage.setItem(SCREEN_ID_KEY,screenId);localStorage.setItem(SCREEN_TOKEN_KEY,screenToken);}
function clearIdentity(){try{localStorage.removeItem(SCREEN_ID_KEY);localStorage.removeItem(SCREEN_TOKEN_KEY);}catch{}}
function connectionMessage(error){if(!navigator.onLine)return'Sin conexión a Internet. Esperando conexión…';if(error?.code==='REQUEST_TIMEOUT')return'Tiempo de espera agotado. Reintentando…';return'No se pudo conectar al Gateway. Reintentando…';}
function renderEnrollment(enrollment,options={}){const code=String(enrollment?.code||'------'),message=String(options.message||''),state=String(options.state||'active'),action=String(options.action||''),actionLabel=String(options.actionLabel||''),expiryText=state==='expired'?'Este código ya no puede utilizarse.':'El código vence automáticamente en unos minutos.';root.innerHTML=`<section class="enrollment-screen"><div class="enrollment-card"><div class="enrollment-brand brand-wordmark" aria-label="Nexus.Display"><span class="brand-nexus">Nexus</span><span class="brand-dot">.</span><span class="brand-display">Display</span></div><h1 class="enrollment-title">Vincular esta pantalla</h1><p class="enrollment-copy">Autoriza esta pantalla desde el administrador usando el siguiente código.</p><div class="enrollment-code${state==='expired'?' expired':''}">${code}</div><p class="enrollment-expiry">${expiryText}</p>${message?`<p class="enrollment-message ${state}">${message}</p>`:''}${action&&actionLabel?`<button class="enrollment-action" type="button" data-enrollment-action="${action}">${actionLabel}</button>`:''}</div></section>`;}
function waitForEnrollmentAction(action){return new Promise(resolve=>{const button=root.querySelector(`[data-enrollment-action="${action}"]`);if(!button)return resolve();button.focus();button.addEventListener('click',()=>resolve(),{once:true});});}
function waitForRetry(delayMs){return new Promise(resolve=>{let done=false;const button=root.querySelector('[data-enrollment-action="retry"]');const finish=()=>{if(done)return;done=true;clearTimeout(timer);window.removeEventListener('online',finish);button?.removeEventListener('click',finish);resolve();};const timer=navigator.onLine?setTimeout(finish,delayMs):null;window.addEventListener('online',finish,{once:true});button?.addEventListener('click',finish,{once:true});});}
async function createEnrollment(client,localConfig){let retryIndex=0;for(;;){try{return await client.requestEnrollment(localConfig.screenName||localConfig.screenId||'Nexus.Display');}catch(error){hideSplash();renderEnrollment(null,{message:connectionMessage(error),state:navigator.onLine?'connection':'offline',action:'retry',actionLabel:'Reintentar ahora'});await waitForRetry(RETRY_DELAYS[Math.min(retryIndex,RETRY_DELAYS.length-1)]);retryIndex+=1;}}}
async function enrollDisplay(client,localConfig){const enrollment=await createEnrollment(client,localConfig);hideSplash();renderEnrollment(enrollment);let retryIndex=0;for(;;){await sleep(ENROLLMENT_POLL_MS);try{const status=await client.getEnrollment(enrollment.enrollmentId);retryIndex=0;if(status.status==='APPROVED'&&status.screenId&&status.screenToken){saveIdentity(status.screenId,status.screenToken);client.setScreenToken(status.screenToken);return{screenId:status.screenId,screenToken:status.screenToken};}if(status.status==='EXPIRED'){renderEnrollment(enrollment,{message:'Código vencido',state:'expired',action:'generate',actionLabel:'Generar nuevo código'});await waitForEnrollmentAction('generate');return enrollDisplay(client,localConfig);}renderEnrollment(enrollment);}catch(error){renderEnrollment(enrollment,{message:connectionMessage(error),state:navigator.onLine?'connection':'offline',action:'retry',actionLabel:'Reintentar ahora'});await waitForRetry(RETRY_DELAYS[Math.min(retryIndex,RETRY_DELAYS.length-1)]);retryIndex+=1;}}}

async function toggleFullscreen(){try{if(document.fullscreenElement){await document.exitFullscreen?.();return;}const target=document.documentElement;if(target.requestFullscreen){await target.requestFullscreen();return;}if(target.webkitRequestFullscreen)target.webkitRequestFullscreen();}catch(error){console.warn('Nexus.Display fullscreen unavailable',error);}}
function requestKey(item,index){return String(item?.requestId||item?.id||item?.pickupRequestId||item?.studentId||`row-${index}`);}
function statusLane(status){const s=String(status||'').toUpperCase();if(s==='AT_GATE'||s==='NOW')return'NOW';if(s==='ON_THE_WAY'||s==='READY')return'READY';return'WAITING';}
function cardSnapshot(){const map=new Map();root.querySelectorAll('.queue-card[data-request-id]').forEach(card=>{const rect=card.getBoundingClientRect();map.set(card.dataset.requestId,{rect,lane:card.dataset.lane||'',html:card.outerHTML});});return map;}
function modelLaneMap(model){const map=new Map();(Array.isArray(model?.pickupRequests)?model.pickupRequests:[]).forEach((item,index)=>map.set(requestKey(item,index),statusLane(item.status)));return map;}
function animateRemovedCards(before,newLanes){before.forEach((snap,id)=>{if(newLanes.has(id))return;const ghost=document.createElement('div');ghost.className='queue-card-ghost is-disintegrating';ghost.innerHTML=snap.html;Object.assign(ghost.style,{left:`${snap.rect.left}px`,top:`${snap.rect.top}px`,width:`${snap.rect.width}px`,height:`${snap.rect.height}px`});document.body.appendChild(ghost);setTimeout(()=>ghost.remove(),1250);});}
function pulseLane(lane){const section=root.querySelector(`.queue-lane-${String(lane).toLowerCase()}`);if(!section)return;const cls=`lane-update-${String(lane).toLowerCase()}`;section.classList.remove(cls);void section.offsetWidth;section.classList.add(cls);setTimeout(()=>section.classList.remove(cls),1150);}
function animatePaint(before,oldLanes,newLanes){const changedLanes=new Set();root.querySelectorAll('.queue-card[data-request-id]').forEach(card=>{const id=card.dataset.requestId,snap=before.get(id),newLane=card.dataset.lane||newLanes.get(id)||'';if(snap){const rect=card.getBoundingClientRect(),dx=snap.rect.left-rect.left,dy=snap.rect.top-rect.top,oldLane=oldLanes.get(id)||snap.lane,laneChanged=Boolean(oldLane&&newLane&&oldLane!==newLane),moved=Math.abs(dx)>1||Math.abs(dy)>1;if(moved){card.animate([{transform:`translate(${dx}px,${dy}px) scale(.975)`,boxShadow:'0 12px 30px rgba(15,23,42,.22)'},{offset:.72,transform:'translate(0,0) scale(1.018)',boxShadow:'0 7px 18px rgba(15,23,42,.13)'},{transform:'translate(0,0) scale(1)',boxShadow:'0 1px 2px rgba(15,23,42,.03)'}],{duration:760,easing:'cubic-bezier(.16,.8,.2,1)'});if(!laneChanged){card.classList.add('state-reorder');setTimeout(()=>card.classList.remove('state-reorder'),900);}}if(laneChanged){changedLanes.add(newLane);card.classList.add(`state-flash-${newLane.toLowerCase()}`);setTimeout(()=>card.classList.remove(`state-flash-${newLane.toLowerCase()}`),1300);}}else{card.classList.add('state-enter');setTimeout(()=>card.classList.remove('state-enter'),700);}});changedLanes.forEach(pulseLane);refreshLiveTimers(root);}

async function start(){
  const localConfig=await loadConfig();
  const previewBypassEnrollment=isPreviewDeployment();
  let identity=storedIdentity();
  const client=new GatewayClient(localConfig.gatewayBaseUrl,identity.screenToken);
  let effectiveConfig={...localConfig};let testModeOverride=null;let lastModel=localConfig.demo?demoState(effectiveConfig):{online:false,config:effectiveConfig,counters:{},pickupRequests:[]};let lastLaneMap=modelLaneMap(lastModel);let pickupRevision=null;let configRevision=null;let operationalRevision=null;let streamController=null;let streamGeneration=0;let streamActive=false;const stateGuard=createStateGuard();let identityRecovery=null;const pollGate=createPollGate();let configSyncInFlight=false;let appliedConfigRevision=null;

  // TEMPORARY PREVIEW TEST ONLY — REMOVE this block after preview validation.
  // Preview builds deliberately ignore any stored screen identity/token and consume the Gateway public display-state endpoint.
  if(previewBypassEnrollment){identity={screenId:'',screenToken:''};client.setScreenToken('');effectiveConfig.screenId='';}

  // TEMPORARY PREVIEW TEST ONLY — enrollment remains mandatory in production; only preview hosts bypass this line.
  if(!previewBypassEnrollment&&localConfig.gatewayBaseUrl&&(!identity.screenId||!identity.screenToken))identity=await enrollDisplay(client,localConfig);
  if(!previewBypassEnrollment&&identity.screenId)effectiveConfig.screenId=identity.screenId;

  const paint=model=>{const before=cardSnapshot(),oldLanes=lastLaneMap,newLanes=modelLaneMap(model),config=testModeOverride?{...model.config,mode:testModeOverride}:model.config;animateRemovedCards(before,newLanes);getRenderer(config?.app||effectiveConfig.app)(root,{...model,config});requestAnimationFrame(()=>animatePaint(before,oldLanes,newLanes));lastLaneMap=newLanes;};
  root.addEventListener('click',async event=>{const toggle=event.target.closest('[data-edge-menu-toggle]');if(toggle){root.querySelector('.edge-menu')?.classList.toggle('open');return;}const fullscreen=event.target.closest('[data-fullscreen-toggle]');if(fullscreen){await toggleFullscreen();root.querySelector('.edge-menu')?.classList.remove('open');return;}const button=event.target.closest('[data-display-mode]');if(!button)return;testModeOverride=button.dataset.displayMode;paint(lastModel);});
  root.addEventListener('submit',async event=>{
    const form=event.target.closest?.('[data-display-self-service]');
    if(!form)return;
    event.preventDefault();
    const output=form.querySelector('[data-config-result]');
    const button=form.querySelector('[type=submit]');
    if(button?.disabled)return;
    try{
      if(!canSelfConfigure(effectiveConfig))throw new Error('Configuración restringida por administrador');
      const changes=selfServicePatch(effectiveConfig,{
        locationId:form.elements.locationId.value.trim()||null,
        rows:Number(form.elements.rows.value),
        showDistance:form.elements.showDistance.checked,
        showPriority:form.elements.showPriority.checked
      });
      if(button)button.disabled=true;
      if(output)output.textContent='Guardando…';
      const saved=await client.saveDisplayConfig(effectiveConfig.screenId,changes);
      const remote=saved.config||await client.getDisplayConfig(effectiveConfig.screenId).then(result=>result.config||result);
      effectiveConfig={...effectiveConfig,...normalizeRemoteConfig(remote)};
      appliedConfigRevision=null;
      pickupRevision=null;
      configRevision=null;
      resetStream(); // Gateway closes SSE after a successful SELF_SERVICE save.
      lastModel={...lastModel,config:effectiveConfig};
      await refresh();
      void connectStream();
    }catch(error){
      if(output)output.textContent=String(error?.data?.error||error?.message||error);
      if(button)button.disabled=false;
    }
  });
  paint(lastModel);
  setInterval(()=>refreshLiveTimers(root),1000);
  function applyState(state) {
    stateGuard.advance();
    if(state.config){effectiveConfig={...effectiveConfig,...normalizeRemoteConfig(state.config)};if(state.configRevision!=null)appliedConfigRevision=state.configRevision;}
    const requests=Array.isArray(state.items)?normalizeDisplayItems(state.items):lastModel.pickupRequests;
    pickupRevision=state.revision??pickupRevision;
    configRevision=state.configRevision??configRevision;
    operationalRevision=state.operationalRevision??operationalRevision;
    lastModel={online:true,config:effectiveConfig,counters:state.counters??lastModel.counters,pickupRequests:requests,revision:pickupRevision,operationalRevision,configRevision,updatedAt:new Date().toLocaleTimeString()};
    paint(lastModel);
    // State may advertise a newer remote configuration without including its body.
    if(!state.config&&state.configRevision!=null&&state.configRevision!==appliedConfigRevision)void syncRemoteConfig();
  }
  async function syncRemoteConfig(){
    if(configSyncInFlight||previewBypassEnrollment||!effectiveConfig.screenId||identityRecovery)return;
    configSyncInFlight=true;
    const screenId=effectiveConfig.screenId;
    try{
      const response=await client.getDisplayConfig(screenId);
      if(screenId!==effectiveConfig.screenId)return;
      const config=response.config||response;
      if(!config||typeof config!=='object'||Array.isArray(config))return;
      effectiveConfig={...effectiveConfig,...normalizeRemoteConfig(config)};
      if(response.configRevision!=null)appliedConfigRevision=response.configRevision;
      else if(config.configRevision!=null)appliedConfigRevision=config.configRevision;
      else appliedConfigRevision=configRevision;
      lastModel={...lastModel,config:effectiveConfig};
      paint(lastModel);
    }catch(error){console.warn('Display remote config sync failed',error);}
    finally{configSyncInFlight=false;}
  }
  async function connectStream() {
    if(previewBypassEnrollment||!effectiveConfig.screenId||streamController)return;
    const generation=++streamGeneration;
    const controller=new AbortController();
    streamController=controller;
    let retry=0;
    while(!controller.signal.aborted&&generation===streamGeneration){
      try {
        await client.streamDisplayState(effectiveConfig.screenId,state=>{
          if(controller.signal.aborted||generation!==streamGeneration)return;
          streamActive=true;
          retry=0;
          applyState(state);
        },controller.signal);
      } catch(error) {
        if(controller.signal.aborted)break;
        streamActive=false;
        if(isScreenIdentityRejected(error?.code||error?.data?.error)){
          // SSE can be the first endpoint to notice a revoked token.
          // Delegate identity recovery to the same authenticated polling path.
          console.warn('Display SSE identity rejected; verifying via polling');
          await refresh();
          if(controller.signal.aborted||generation!==streamGeneration)break;
        }else console.warn('Display SSE reconnecting',error);
      }
      if(controller.signal.aborted)break;
      streamActive=false;
      await waitForReconnect(Math.min(30000,2000*2**Math.min(retry++,4)),controller.signal);
    }
    if(streamController===controller){streamActive=false;streamController=null;}
  }
  function resetStream(){
    streamGeneration++;
    streamController?.abort();
    streamController=null;
    streamActive=false;
  }
  async function refresh(){const snapshot=stateGuard.capture(effectiveConfig.screenId);try{
    if(previewBypassEnrollment){
      // TEMPORARY PREVIEW TEST ONLY — REMOVE this public-state branch after visual preview testing.
      // No screenId or bearer token is sent here; Gateway /api/display/preview is for laboratory use only.
      const state=await client.getJson(previewStatePath(effectiveConfig),{auth:false});
      if(state.config)effectiveConfig={...effectiveConfig,...normalizeRemoteConfig(state.config),screenId:''};
      lastModel={online:true,config:effectiveConfig,counters:state.counters||{},pickupRequests:normalizeDisplayItems(state.items||state.pickupRequests||[]),revision:state.revision??0,updatedAt:new Date().toLocaleTimeString()};
    }else{
      if(!effectiveConfig.screenId)throw new Error('Pantalla no vinculada');
      const state=await client.queryDisplayState({screenId:effectiveConfig.screenId,...(pickupRevision===null?{}:{revision:pickupRevision}),...(configRevision===null?{}:{configRevision})});
      if(!stateGuard.isCurrent(snapshot,effectiveConfig.screenId))return;
      applyState(state);
      return;
    }
  }catch(error){if(!stateGuard.isCurrent(snapshot,effectiveConfig.screenId))return;const code=error?.data?.error;
    // TEMPORARY PREVIEW TEST ONLY — previews must never fall back into enrollment while this test switch exists.
    if(!previewBypassEnrollment&&isScreenIdentityRejected(code)){
      if(identityRecovery){console.warn('Display: nueva identidad rechazada durante reenrolamiento');return;}
      identityRecovery=recoverScreenIdentity({resetStream,clearIdentity,client,markUnlinked:()=>{effectiveConfig.screenId='';pickupRevision=null;configRevision=null;appliedConfigRevision=null;operationalRevision=null;lastModel={...lastModel,online:false,pickupRequests:[],counters:{}};paint(lastModel);},enroll:()=>enrollDisplay(client,localConfig),setIdentity:next=>{identity=next;effectiveConfig.screenId=next.screenId;},refresh,connectStream});
      try{await identityRecovery;}finally{identityRecovery=null;}
      return;
    }
    lastModel={...lastModel,online:false,config:effectiveConfig,updatedAt:new Date().toLocaleTimeString(),error:String(error?.message||error)};
  }paint(lastModel);}
  if(effectiveConfig.gatewayBaseUrl)await refresh();hideSplash();
  if(effectiveConfig.gatewayBaseUrl){
    if(!previewBypassEnrollment)void connectStream();
    setInterval(()=>{if(!streamActive&&!identityRecovery)void pollGate.run(refresh).catch(error=>console.warn('Display polling failed',error));},Math.max(1000,Number(effectiveConfig.pollIntervalMs)||5000));
  }
}
start().catch(error=>{hideSplash();root.textContent=`No se pudo iniciar Nexus.Display: ${String(error?.message||error)}`;});
