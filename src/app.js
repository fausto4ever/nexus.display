import { loadConfig } from './core/config.js';
import { GatewayClient } from './core/gateway-client.js';
import { registerRenderer, getRenderer } from './core/renderer-registry.js';
import { renderControlAccess } from './renderers/control-access.js';
import { APP_VERSION } from './version.js';

registerRenderer('control-access', renderControlAccess);
registerRenderer('default', renderControlAccess);

const root = document.querySelector('#app');

function installVersionBadge() {
  let badge = document.querySelector('#app-version');
  if (!badge) {
    badge = document.createElement('div');
    badge.id = 'app-version';
    badge.className = 'version-badge';
    document.body.appendChild(badge);
  }
  badge.textContent = `Nexus Display v${APP_VERSION}`;
}

installVersionBadge();

const demoState = cfg => ({
  online: false,
  revision: 0,
  updatedAt: new Date().toLocaleTimeString(),
  config: cfg,
  counters: { inside: 428, entriesToday: 437, exitsToday: 9 },
  pickupRequests: [
    { requestId:'DEMO-1', studentName:'Alumno en puerta', status:'AT_GATE', priority:1, distanceMeters:8, vehicle:{description:'Vehículo gris'} },
    { requestId:'DEMO-2', studentName:'Alumno en camino', status:'ON_THE_WAY', priority:3, distanceMeters:42, vehicle:{description:'SUV blanca'} }
  ]
});

async function start() {
  const localConfig = await loadConfig();
  const client = new GatewayClient(localConfig.gatewayBaseUrl);
  let effectiveConfig = { ...localConfig };
  let lastModel = localConfig.demo ? demoState(effectiveConfig) : { online:false, config:effectiveConfig, counters:{}, pickupRequests:[] };
  const renderer = getRenderer(effectiveConfig.app);

  const paint = model => renderer(root, model);
  paint(lastModel);

  async function refresh() {
    try {
      let remoteConfig = null;
      let state = null;
      try { remoteConfig = await client.getScreenConfig(effectiveConfig.screenId); } catch (_) {}
      if (remoteConfig) effectiveConfig = { ...effectiveConfig, ...(remoteConfig.config || remoteConfig.screen || remoteConfig) };
      try { state = await client.getScreenState(effectiveConfig.screenId); } catch (_) {}

      if (!state) {
        const attendance = await client.getAttendanceState();
        state = { counters: attendance.counters || attendance, pickupRequests: [], revision: attendance.revision };
      }

      lastModel = {
        online: true,
        config: effectiveConfig,
        counters: state.counters || {},
        pickupRequests: state.pickupRequests || [],
        revision: state.revision ?? 0,
        updatedAt: new Date().toLocaleTimeString()
      };
    } catch (error) {
      lastModel = { ...lastModel, online:false, config:effectiveConfig, updatedAt:new Date().toLocaleTimeString(), error:String(error?.message || error) };
    }
    paint(lastModel);
  }

  if (effectiveConfig.gatewayBaseUrl) {
    await refresh();
    setInterval(refresh, Math.max(1000, Number(effectiveConfig.pollIntervalMs) || 5000));
  }
}

start().catch(error => {
  root.innerHTML = `<section class="boot-card"><div class="brand-mark">N</div><h1>Nexus Display</h1><p>No se pudo iniciar: ${String(error?.message || error)}</p></section>`;
});
