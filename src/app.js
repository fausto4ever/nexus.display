import { loadConfig } from './core/config.js';
import { GatewayClient } from './core/gateway-client.js';
import { registerRenderer, getRenderer } from './core/renderer-registry.js';
import { renderControlAccess } from './renderers/control-access.js';

registerRenderer('control-access', renderControlAccess);
registerRenderer('default', renderControlAccess);

const root = document.querySelector('#app');
const splash = document.querySelector('#startup-splash');
const SCREEN_ID_KEY = 'nexus.display.screenId';
const SCREEN_TOKEN_KEY = 'nexus.display.screenToken';

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

function normalizeRemoteConfig(config) {
  if (!config || typeof config !== 'object') return {};
  return { ...config, mode: config.view || config.mode };
}

function normalizeDisplayItems(items) {
  if (!Array.isArray(items)) return [];
  return items.map(item => ({ ...item, studentName: item.studentName || item.displayName || null }));
}

function storedIdentity() {
  try {
    return {
      screenId: localStorage.getItem(SCREEN_ID_KEY) || '',
      screenToken: localStorage.getItem(SCREEN_TOKEN_KEY) || ''
    };
  } catch {
    return { screenId:'', screenToken:'' };
  }
}

function saveIdentity(screenId, screenToken) {
  localStorage.setItem(SCREEN_ID_KEY, screenId);
  localStorage.setItem(SCREEN_TOKEN_KEY, screenToken);
}

function clearIdentity() {
  try {
    localStorage.removeItem(SCREEN_ID_KEY);
    localStorage.removeItem(SCREEN_TOKEN_KEY);
  } catch {}
}

function renderEnrollment(enrollment, message = '') {
  const code = String(enrollment?.code || '------');
  root.innerHTML = `<section class="enrollment-screen">
    <div class="enrollment-card">
      <div class="enrollment-brand">Nexus Display</div>
      <h1 class="enrollment-title">Vincular esta pantalla</h1>
      <p class="enrollment-copy">Autoriza esta pantalla desde el administrador usando el siguiente código.</p>
      <div class="enrollment-code">${code}</div>
      <p class="enrollment-expiry">El código vence automáticamente en unos minutos.</p>
      ${message ? `<p class="enrollment-message">${message}</p>` : ''}
    </div>
  </section>`;
}

async function enrollDisplay(client, localConfig) {
  const enrollment = await client.requestEnrollment(localConfig.screenName || localConfig.screenId || 'Nexus Display');
  hideSplash();
  renderEnrollment(enrollment);

  for (;;) {
    await new Promise(resolve => setTimeout(resolve, 2000));
    const status = await client.getEnrollment(enrollment.enrollmentId);
    if (status.status === 'APPROVED' && status.screenId && status.screenToken) {
      saveIdentity(status.screenId, status.screenToken);
      client.setScreenToken(status.screenToken);
      return { screenId: status.screenId, screenToken: status.screenToken };
    }
    if (status.status === 'EXPIRED') {
      renderEnrollment(enrollment, 'El código venció. Generando uno nuevo…');
      return enrollDisplay(client, localConfig);
    }
  }
}

async function start() {
  const localConfig = await loadConfig();
  let identity = storedIdentity();
  const client = new GatewayClient(localConfig.gatewayBaseUrl, identity.screenToken);
  let effectiveConfig = { ...localConfig };
  let testModeOverride = null;
  let lastModel = localConfig.demo ? demoState(effectiveConfig) : { online:false, config:effectiveConfig, counters:{}, pickupRequests:[] };

  if (localConfig.gatewayBaseUrl && (!identity.screenId || !identity.screenToken)) {
    identity = await enrollDisplay(client, localConfig);
  }
  if (identity.screenId) effectiveConfig.screenId = identity.screenId;

  const paint = model => {
    const config = testModeOverride ? { ...model.config, mode:testModeOverride } : model.config;
    getRenderer(config?.app || effectiveConfig.app)(root, { ...model, config });
  };

  root.addEventListener('click', event => {
    const toggle = event.target.closest('[data-edge-menu-toggle]');
    if (toggle) {
      root.querySelector('.edge-menu')?.classList.toggle('open');
      return;
    }
    const button = event.target.closest('[data-display-mode]');
    if (!button) return;
    testModeOverride = button.dataset.displayMode;
    paint(lastModel);
  });

  paint(lastModel);

  async function refresh() {
    try {
      if (!effectiveConfig.screenId) throw new Error('Pantalla no vinculada');
      const remoteConfig = await client.getDisplayConfig(effectiveConfig.screenId);
      effectiveConfig = { ...effectiveConfig, ...normalizeRemoteConfig(remoteConfig.config || remoteConfig) };
      const state = await client.getDisplayState(effectiveConfig.screenId);
      if (state.config) effectiveConfig = { ...effectiveConfig, ...normalizeRemoteConfig(state.config) };

      lastModel = {
        online: true,
        config: effectiveConfig,
        counters: state.counters || {},
        pickupRequests: normalizeDisplayItems(state.items || state.pickupRequests || []),
        revision: state.revision ?? 0,
        updatedAt: new Date().toLocaleTimeString()
      };
    } catch (error) {
      const code = error?.data?.error;
      if (['SCREEN_AUTH_REQUIRED','SCREEN_AUTH_INVALID','SCREEN_NOT_FOUND'].includes(code)) {
        clearIdentity();
        identity = await enrollDisplay(client, localConfig);
        effectiveConfig.screenId = identity.screenId;
        return refresh();
      }
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
