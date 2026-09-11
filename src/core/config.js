const DEFAULTS = Object.freeze({
  app: 'control-access',
  screenId: 'default',
  gatewayBaseUrl: '',
  pollIntervalMs: 5000,
  mode: 'DELIVERIES',
  locationId: '',
  showOfficialInsideCount: true,
  showDistance: true,
  showPriority: true,
  demo: true
});

function fromQuery() {
  const q = new URLSearchParams(location.search);
  const out = {};
  for (const key of ['app','screenId','gatewayBaseUrl','mode','locationId']) {
    if (q.has(key)) out[key] = q.get(key);
  }
  if (q.has('demo')) out.demo = q.get('demo') !== '0' && q.get('demo') !== 'false';
  return out;
}

export async function loadConfig() {
  let file = {};
  try {
    const res = await fetch('./config.json', { cache: 'no-store' });
    if (res.ok) file = await res.json();
  } catch (_) {}
  return { ...DEFAULTS, ...file, ...fromQuery() };
}
