import { APP_VERSION } from '../version.js';

function esc(v=''){return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
function n(v){return Number.isFinite(Number(v))?Number(v):'—';}
function list(v){return Array.isArray(v)?v.map(String):[];}
function dimensionPass(value, rule){
  if(!rule||typeof rule!=='object')return true;
  const mode=String(rule.mode||'ALL').toUpperCase();
  if(mode==='NONE')return false;
  if(mode==='ALL')return true;
  const ids=list(rule.ids);
  return ids.includes(String(value??''));
}
function laneFor(status){
  const s=String(status||'').toUpperCase();
  if(s==='AT_GATE'||s==='NOW')return 'NOW';
  if(s==='ON_THE_WAY'||s==='READY')return 'READY';
  return 'WAITING';
}
function arrivalMode(item){
  const mode=String(item.arrivalMode||item.travelMode||'UNKNOWN').toUpperCase();
  return ['CAR','WALK','UNKNOWN'].includes(mode)?mode:'UNKNOWN';
}
function arrivalModeLabel(item){
  const mode=arrivalMode(item);
  if(mode==='CAR')return '🚗 En auto';
  if(mode==='WALK')return '🚶 A pie';
  return '';
}
function ageMinutes(item,lane){
  const raw=lane==='NOW'?(item.arrivalTriggeredAt||item.updatedAt||item.requestedAt):(item.updatedAt||item.requestedAt);
  const t=Date.parse(raw||'');
  return Number.isFinite(t)?Math.max(0,Math.floor((Date.now()-t)/60000)):0;
}
function attentionClass(item,lane,cfg){
  if(lane!=='NOW')return '';
  const thresholds=Array.isArray(cfg.nowAttentionMinutes)&&cfg.nowAttentionMinutes.length>=3?cfg.nowAttentionMinutes:[2,5,10];
  const age=ageMinutes(item,lane);
  if(age>=Number(thresholds[2]))return ' attention-3';
  if(age>=Number(thresholds[1]))return ' attention-2';
  if(age>=Number(thresholds[0]))return ' attention-1';
  return '';
}
function filteredRequests(requests,cfg){
  const f=cfg.filters||{};
  const lanes=f.lanes||{};
  return requests.filter(item=>{
    const lane=laneFor(item.status);
    if(lanes[lane.toLowerCase()]===false)return false;
    return dimensionPass(item.locationId,f.locations)
      &&dimensionPass(item.levelId,f.levels)
      &&dimensionPass(item.gradeId,f.grades)
      &&dimensionPass(item.groupId,f.groups)
      &&dimensionPass(item.requestType||'PICKUP',f.requestTypes)
      &&dimensionPass(arrivalMode(item),f.arrivalModes);
  });
}
function academicLine(item){
  const parts=[item.levelName||item.level,item.gradeName||item.grade,item.groupName||item.group].filter(Boolean);
  return parts.length?parts.join(' · '):'';
}
function requestCard(item,index,lane,cfg){
  const age=ageMinutes(item,lane);
  const academic=academicLine(item);
  const distance=cfg.showDistance!==false&&Number.isFinite(Number(item.distanceMeters))?`${Math.round(Number(item.distanceMeters))} m`:'';
  const travel=arrivalModeLabel(item);
  const meta=[academic,item.locationName||'',travel,distance].filter(Boolean).join(' · ');
  return `<article class="queue-card lane-${lane.toLowerCase()}${attentionClass(item,lane,cfg)}">
    <div class="queue-position">${index+1}</div>
    <div class="queue-person"><h3>${esc(item.studentName||item.displayName||item.studentId||'Solicitud')}</h3>${meta?`<p>${esc(meta)}</p>`:''}</div>
    ${lane==='NOW'?`<div class="queue-age" title="Tiempo en AHORA">${age} min</div>`:''}
  </article>`;
}
function laneSection(lane,title,subtitle,items,cfg){
  const cards=items.map((item,i)=>requestCard(item,i,lane,cfg)).join('');
  return `<section class="queue-lane queue-lane-${lane.toLowerCase()}">
    <header class="lane-heading"><div><strong>${title}</strong><span>${subtitle}</span></div><b>${items.length}</b></header>
    <div class="lane-items">${cards||'<div class="lane-empty">Sin alumnos</div>'}</div>
  </section>`;
}

export function renderControlAccess(root, model) {
  const cfg=model.config||{};
  const counters=model.counters||{};
  const source=Array.isArray(model.pickupRequests)?model.pickupRequests:[];
  const requests=filteredRequests(source,cfg);
  const mode=cfg.mode||'DELIVERIES';
  const schoolName=cfg.schoolName||cfg.instanceName||cfg.instanceKey||'Control de Acceso';
  const gatewayBaseUrl=String(cfg.gatewayBaseUrl||'').replace(/\/$/,'');
  const instanceLogoUrl=gatewayBaseUrl?`${gatewayBaseUrl}/instance-assets/logo`:'';
  const location=cfg.locationName||cfg.locationId||'Sin ubicación';
  const displayId=cfg.displayId||cfg.screenId||'Pantalla';
  const now=new Date();
  const time=now.toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'});
  const date=now.toLocaleDateString('es-MX',{weekday:'short',day:'2-digit',month:'short'});

  const edgeMenu=cfg.showTestControls===false?'':`<aside class="edge-menu" aria-label="Configuración rápida">
    <button type="button" class="edge-tab" data-edge-menu-toggle aria-label="Abrir configuración"><span></span></button>
    <div class="edge-drawer">
      ${[['ENTRY','Entradas'],['EXIT','Salidas'],['DELIVERIES','Entregas'],['MIXED','Mixto']].map(([value,label])=>`<button type="button" data-display-mode="${value}" class="edge-mode-button${mode===value?' active':''}">${label}</button>`).join('')}
    </div>
  </aside>`;

  let body='';
  if(mode==='DELIVERIES'||mode==='MIXED'){
    const waiting=requests.filter(r=>laneFor(r.status)==='WAITING');
    const ready=requests.filter(r=>laneFor(r.status)==='READY');
    const nowItems=requests.filter(r=>laneFor(r.status)==='NOW');
    body=`<section class="delivery-lanes">
      ${laneSection('NOW','AHORA','En la puerta · listo para salir',nowItems,cfg)}
      ${laneSection('READY','PREPÁRATE','Ya está cerca de la escuela',ready,cfg)}
      ${laneSection('WAITING','ESPERANDO','Solicitud recibida',waiting,cfg)}
    </section>`;
  }else{
    const heading=mode==='ENTRY'?'Entradas recientes':'Salidas recientes';
    const cards=requests.map((r,i)=>requestCard(r,i,'WAITING',cfg)).join('');
    body=`<div class="list-heading"><strong>${heading}</strong><span>${requests.length?`${requests.length} en lista`:''}</span></div><section class="queue primary-queue">${cards||'<div class="empty">Sin elementos para mostrar.</div>'}</section>`;
  }

  root.innerHTML=`<section class="display-card minimal-display">
    <header class="topbar nexus-topbar">
      <div class="instance-heading-wrap">
        ${instanceLogoUrl?`<img class="instance-logo" src="${esc(instanceLogoUrl)}" alt="">`:''}
        <div class="instance-heading"><h1 class="instance-title">${esc(schoolName)}</h1><div class="screen-caption"><span class="location-caption">${esc(location)}</span><span class="screen-id-caption">${esc(displayId)}</span></div></div>
      </div>
      <div class="topbar-right display-status-area">
        ${cfg.showOfficialInsideCount!==false?`<section class="compact-counters"><div><strong>${n(counters.inside)}</strong><span>Dentro</span></div><div><strong>${n(counters.entriesToday??counters.entries)}</strong><span>Entradas</span></div><div><strong>${n(counters.exitsToday??counters.exits)}</strong><span>Salidas</span></div></section>`:''}
        <div class="clock-block"><strong>${esc(time)}</strong><span>${esc(date)}</span></div>
        <div class="connection-state"><span class="connection-dot ${model.online?'online':'offline'}"></span><small>${model.online?'Conectado':'Sin conexión'}</small></div>
      </div>
    </header>
    ${body}
    <footer class="display-footer"><div class="tip-strip">${esc(cfg.footerMessage||'Prepara tus cosas para estar listo cuando lleguen por ti.')}</div><div class="margin-note"><span class="brand-inline" aria-label="Nexus.Display"><span class="brand-nexus">Nexus</span><span class="brand-dot">.</span><span class="brand-display">Display</span> v${esc(APP_VERSION)}</span><span>${esc(displayId)} · Rev. ${esc(model.revision??'—')}</span></div></footer>
  </section>${edgeMenu}`;
}
