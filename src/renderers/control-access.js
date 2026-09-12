import { APP_VERSION } from '../version.js';

function esc(v=''){return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
function n(v){return Number.isFinite(Number(v))?Number(v):'—';}

export function renderControlAccess(root, model) {
  const cfg = model.config || {};
  const counters = model.counters || {};
  const requests = Array.isArray(model.pickupRequests) ? model.pickupRequests : [];
  const mode = cfg.mode || 'DELIVERIES';
  const instanceName = cfg.instanceName || cfg.name || cfg.instanceKey || 'Control de Acceso';
  const queue = requests.map((r,i)=>{
    const urgent = r.status === 'AT_GATE' || Number(r.priority) <= 1;
    const right = cfg.showDistance && Number.isFinite(Number(r.distanceMeters)) ? `${Math.round(Number(r.distanceMeters))} m` : esc(r.status || '');
    return `<article class="queue-item${urgent?' urgent':''}"><div class="badge">${i+1}</div><div><h3>${esc(r.studentName || r.studentId || 'Solicitud')}</h3><p>${esc(r.status || 'REQUESTED')}${r.vehicle?.description?` · ${esc(r.vehicle.description)}`:''}</p></div><div class="queue-right">${right}</div></article>`;
  }).join('');

  const modeSelector = cfg.showTestControls === false ? '' : `<nav class="mode-selector" aria-label="Vista de prueba">
    ${[['ENTRY','Entradas'],['EXIT','Salidas'],['DELIVERIES','Entregas'],['MIXED','Mixto']].map(([value,label])=>`<button type="button" data-display-mode="${value}" class="mode-button${mode===value?' active':''}">${label}</button>`).join('')}
  </nav>`;

  root.innerHTML = `<section class="display-card minimal-display">
    <header class="topbar">
      <div class="instance-heading"><h1 class="instance-title">${esc(instanceName)}</h1><div class="screen-caption">${esc(cfg.screenName || cfg.screenId || 'Pantalla')} · ${esc(cfg.locationName || cfg.locationId || 'General')}</div></div>
      <div class="topbar-right">
        ${cfg.showOfficialInsideCount!==false?`<section class="compact-counters"><div><strong>${n(counters.inside)}</strong><span>Dentro</span></div><div><strong>${n(counters.entriesToday ?? counters.entries)}</strong><span>Entradas</span></div><div><strong>${n(counters.exitsToday ?? counters.exits)}</strong><span>Salidas</span></div></section>`:''}
        <div class="connection-dot ${model.online?'online':'offline'}" title="${model.online?'Conectado':'Sin conexión'}"></div>
      </div>
    </header>
    ${modeSelector}
    <div class="list-heading"><strong>${mode==='DELIVERIES'?'Solicitudes activas':'Actividad reciente'}</strong><span>${requests.length ? `${requests.length} en lista` : ''}</span></div>
    <section class="queue primary-queue">${queue || '<div class="empty">Sin elementos para mostrar.</div>'}</section>
    <footer class="margin-note"><span>Nexus Display v${esc(APP_VERSION)}</span><span>${esc(cfg.screenId || 'default')} · Rev. ${esc(model.revision ?? '—')} · ${esc(model.updatedAt || '')}</span></footer>
  </section>`;
}
