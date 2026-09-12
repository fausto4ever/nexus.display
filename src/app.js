import { loadConfig } from './core/config.js';
import { GatewayClient } from './core/gateway-client.js';
import { registerRenderer, getRenderer } from './core/renderer-registry.js';
import { renderControlAccess } from './renderers/control-access.js';

registerRenderer('control-access', renderControlAccess);
registerRenderer('default', renderControlAccess);

const root = document.querySelector('#app');
const splash = document.querySelector('#startup-splash');

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

function hideSplash() {
  if (!splash || splash.classList.contains('hide')) return;
  requestAnimationFrame(() => splash.classList.add('hide'));
  setTimeout(() => splash.remove(), 650);
}

async function start() {
  const localConfig = await loadConfig();
  const client = new GatewayClient(localConfig.gatewayBaseUrl);
  let effectiveConfig = { ...localConfig };
  let testModeOverride = null;
  let lastModel = localConfig.demo ? demoState(effectiveConfig) : { online:false, config:effectiveConfig, counters:{}, pickupRequests:[] };

  const paint = model => {
    const config = testModeOverride ? { ...model.config, mode:testModeOverride } : model.config;
    getRenderer(config?.app || effectiveConfig.app)(root, { ...model, config });
  };

  root.addEventListener('click', event => {
    const toggle = event.target.closest('[data-edge-menu-toggle]');
    if (toggle) {
      const menu = root.querySelector('.edge-menu');
      menu?.classList.toggle('open');
      return;
    }

    const button = event.target.closest('[data-display-mode]');
    if (!button) return;
    testModeOverride = button.dataset.displayMode;
    paint(lastModel);
  });

  root.addEventListener('wheel', event => {
    const menu = event.target.closest?.('.edge-menu');
    if (!menu) return;
    menu.classList.add('open');
    clearTimeout(menu._closeTimer);
    menu._closeTimer = setTimeout(() => menu.classList.remove('open'), 1600);
  }, { passive:true });

  root.addEventListener('pointerleave', event => {
    const menu = event.target.closest?.('.edge-menu');
    if (menu && !menu.matches(':focus-within')) menu.classList.remove('open');
  }, true);

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

  if (effectiveConfig.gatewayBaseUrl) await refresh();
  hideSplash();

  if (effectiveConfig.gatewayBaseUrl) {
    setInterval(refresh, Math.max(1000, Number(effectiveConfig.pollIntervalMs) || 5000));
  }
}

start().catch(error => {
  hideSplash();
  root.textContent = `No se pudo iniciar Nexus Display: ${String(error?.message || error)}`;
});
