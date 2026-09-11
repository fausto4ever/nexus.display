function esc(v=''){return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
function n(v){return Number.isFinite(Number(v))?Number(v):'—';}

export function renderControlAccess(root, model) {
  const cfg = model.config || {};
  const counters = model.counters || {};
  const requests = Array.isArray(model.pickupRequests) ? model.pickupRequests : [];
  const mode = cfg.mode || 'DELIVERIES';
  const queue = requests.map((r,i)=>{
    const urgent = r.status === 'AT_GATE' || Number(r.priority) <= 1;
    const right = cfg.showDistance && Number.isFinite(Number(r.distanceMeters)) ? `${Math.round(Number(r.distanceMeters))} m` : esc(r.status || '');
    return `<article class="queue-item${urgent?' urgent':''}"><div class="badge">${i+1}</div><div><h3>${esc(r.studentName || r.studentId || 'Solicitud')}</h3><p>${esc(r.status || 'REQUESTED')}${r.vehicle?.description?` · ${esc(r.vehicle.description)}`:''}</p></div><div>${right}</div></article>`;
  }).join('');

  root.innerHTML = `<section class="display-card">
    <header class="header"><div class="header-main"><div class="brand-mark">N</div><div><div class="eyebrow">Nexus Display · ${esc(cfg.app || 'control-access')}</div><h1 class="title">${esc(cfg.name || mode)}</h1><div class="muted">${esc(cfg.locationName || cfg.locationId || 'Todas las ubicaciones')}</div></div></div><div class="status-pill ${model.online?'online':'offline'}">${model.online?'Conectado':'Sin conexión'}</div></header>
    ${cfg.showOfficialInsideCount!==false?`<section class="counter-grid"><div class="counter"><strong>${n(counters.inside)}</strong><span>Dentro</span></div><div class="counter"><strong>${n(counters.entriesToday ?? counters.entries)}</strong><span>Entradas hoy</span></div><div class="counter"><strong>${n(counters.exitsToday ?? counters.exits)}</strong><span>Salidas hoy</span></div></section>`:''}
    <div class="eyebrow">${mode==='DELIVERIES'?'Solicitudes activas':'Actividad reciente'}</div>
    <section class="queue">${queue || '<div class="empty">Sin elementos para mostrar.</div>'}</section>
    <footer class="footer"><span>Pantalla ${esc(cfg.screenId || 'default')}</span><span>Rev. ${esc(model.revision ?? '—')} · ${esc(model.updatedAt || '')}</span></footer>
  </section>`;
}
