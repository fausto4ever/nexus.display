import { APP_VERSION } from '../version.js';

function esc(v=''){return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
function n(v){return Number.isFinite(Number(v))?Number(v):'—';}

export function renderControlAccess(root, model) {
  const cfg = model.config || {};
  const counters = model.counters || {};
  const requests = Array.isArray(model.pickupRequests) ? model.pickupRequests : [];
  const mode = cfg.mode || 'DELIVERIES';
  const instanceName = cfg.instanceName || cfg.name || cfg.instanceKey || 'Control de Acceso';
  const gatewayBaseUrl = String(cfg.gatewayBaseUrl || '').replace(/\/$/, '');
  const instanceLogoUrl = gatewayBaseUrl ? `${gatewayBaseUrl}/instance-assets/logo` : '';
  const queue = requests.map((r,i)=>{
    const urgent = r.status === 'AT_GATE' || Number(r.priority) <= 1;
    const right = cfg.showDistance && Number.isFinite(Number(r.distanceMeters)) ? `${Math.round(Number(r.distanceMeters))} m` : esc(r.status || '');
    return `<article class="queue-item${urgent?' urgent':''}"><div class="badge">${i+1}</div><div><h3>${esc(r.studentName || r.studentId || 'Solicitud')}</h3><p>${esc(r.status || 'REQUESTED')}${r.vehicle?.description?` · ${esc(r.vehicle.description)}`:''}</p></div><div class="queue-right">${right}</div></article>`;
  }).join('');

  const edgeMenu = cfg.showTestControls === false ? '' : `<aside class="edge-menu" aria-label="Vistas de prueba">
    <button type="button" class="edge-tab" data-edge-menu-toggle aria-label="Abrir selector de vista"><span></span></button>
    <div class="edge-drawer">
      ${[['ENTRY','Entradas'],['EXIT','Salidas'],['DELIVERIES','Solicitudes de entrega']].map(([value,label])=>`<button type="button" data-display-mode="${value}" class="edge-mode-button${mode===value?' active':''}">${label}</button>`).join('')}
    </div>
  </aside>`;

  const heading = mode==='DELIVERIES' ? 'Solicitudes activas' : mode==='ENTRY' ? 'Entradas recientes' : mode==='EXIT' ? 'Salidas recientes' : 'Actividad reciente';

  root.innerHTML = `<section class="display-card minimal-display">
    <header class="topbar">
      <div class="instance-heading-wrap">
        ${instanceLogoUrl?`<img class="instance-logo" src="${esc(instanceLogoUrl)}" alt="">`:''}
        <div class="instance-heading"><h1 class="instance-title">${esc(instanceName)}</h1><div class="screen-caption">${esc(cfg.displayId || cfg.screenName || cfg.screenId || 'Pantalla')} · ${esc(cfg.locationName || cfg.locationId || 'General')}</div></div>
      </div>
      <div class="topbar-right">
        ${cfg.showOfficialInsideCount!==false?`<section class="compact-counters"><div><strong>${n(counters.inside)}</strong><span>Dentro</span></div><div><strong>${n(counters.entriesToday ?? counters.entries)}</strong><span>Entradas</span></div><div><strong>${n(counters.exitsToday ?? counters.exits)}</strong><span>Salidas</span></div></section>`:''}
        <div class="connection-dot ${model.online?'online':'offline'}" title="${model.online?'Conectado':'Sin conexión'}"></div>
      </div>
    </header>
    <div class="list-heading"><strong>${heading}</strong><span>${requests.length ? `${requests.length} en lista` : ''}</span></div>
    <section class="queue primary-queue">${queue || '<div class="empty">Sin elementos para mostrar.</div>'}</section>
    <footer class="margin-note"><span class="brand-inline" aria-label="Nexus.Display"><span class="brand-nexus">Nexus</span><span class="brand-dot">.</span><span class="brand-display">Display</span> v${esc(APP_VERSION)}</span><span>${esc(cfg.displayId || cfg.screenId || 'default')} · Rev. ${esc(model.revision ?? '—')} · ${esc(model.updatedAt || '')}</span></footer>
  </section>${edgeMenu}`;
}
