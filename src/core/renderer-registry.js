const renderers = new Map();

export function registerRenderer(app, renderer) {
  if (!app || typeof renderer !== 'function') throw new Error('Renderer inválido');
  renderers.set(app, renderer);
}

export function getRenderer(app) {
  return renderers.get(app) || renderers.get('default');
}
