export class GatewayClient {
  constructor(baseUrl, screenToken = '') {
    this.baseUrl = String(baseUrl || '').replace(/\/$/, '');
    this.screenToken = String(screenToken || '');
  }

  setScreenToken(token) {
    this.screenToken = String(token || '');
  }

  async request(path, options = {}) {
    if (!this.baseUrl) throw new Error('Gateway no configurado');
    const headers = { Accept: 'application/json', ...(options.headers || {}) };
    if (options.auth !== false && this.screenToken) headers.Authorization = `Bearer ${this.screenToken}`;

    const timeoutMs = Math.max(1000, Number(options.timeoutMs) || 10000);
    const controller = new AbortController();
    const externalSignal = options.signal;
    let externalAbort;
    if (externalSignal) {
      if (externalSignal.aborted) controller.abort();
      else {
        externalAbort = () => controller.abort();
        externalSignal.addEventListener('abort', externalAbort, { once: true });
      }
    }
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const requestOptions = { ...options };
      delete requestOptions.timeoutMs;
      const res = await fetch(`${this.baseUrl}${path}`, {
        ...requestOptions,
        headers,
        signal: controller.signal,
        cache: 'no-store'
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.ok === false) {
        const error = new Error(data?.error || `HTTP ${res.status}`);
        error.status = res.status;
        error.data = data;
        error.code = data?.error || `HTTP_${res.status}`;
        throw error;
      }
      return data;
    } catch (error) {
      if (error?.name === 'AbortError') {
        const timeoutError = new Error('Tiempo de espera agotado');
        timeoutError.code = 'REQUEST_TIMEOUT';
        throw timeoutError;
      }
      if (error instanceof TypeError) {
        const networkError = new Error('No se pudo conectar al Gateway');
        networkError.code = 'NETWORK_ERROR';
        throw networkError;
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
      if (externalSignal && externalAbort) externalSignal.removeEventListener('abort', externalAbort);
    }
  }

  getJson(path, options = {}) {
    return this.request(path, { ...options, method: 'GET' });
  }

  postJson(path, body = {}, options = {}) {
    return this.request(path, {
      ...options,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      body: JSON.stringify(body)
    });
  }

  putJson(path, body = {}, options = {}) {
    return this.request(path, {
      ...options,
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      body: JSON.stringify(body)
    });
  }

  getBootstrap() {
    return this.getJson('/bootstrap', { auth: false });
  }

  getGatewayVersion() {
    return this.getJson('/api/gateway/version', { auth: false });
  }

  getAttendanceState() {
    return this.getJson('/api/attendance/state', { auth: false });
  }

  requestEnrollment(clientLabel = '') {
    return this.postJson('/api/display/enroll', { clientLabel }, { auth: false });
  }

  getEnrollment(enrollmentId) {
    return this.getJson(`/api/display/enroll/${encodeURIComponent(enrollmentId)}`, { auth: false });
  }

  getDisplayConfig(screenId) {
    return this.getJson(`/api/displays/${encodeURIComponent(screenId)}/config`);
  }

  saveDisplayConfig(screenId, config) {
    const { screenId: ignoredScreenId, displayId: ignoredDisplayId, ...editable } = config || {};
    return this.postJson('/api/display/config/save', { ...editable, screenId });
  }

  queryDisplayState(body) {
    return this.postJson('/api/display/state', body);
  }

  getDisplayPreview(params = {}) {
    const query = new URLSearchParams(params);
    return this.getJson(`/api/display/preview${query.size ? `?${query}` : ''}`, { auth: false });
  }

  async streamDisplayState(screenId, onState, signal) {
    const headers = { Accept: 'text/event-stream' };
    if (this.screenToken) headers.Authorization = `Bearer ${this.screenToken}`;
    const response = await fetch(`${this.baseUrl}/api/displays/${encodeURIComponent(screenId)}/state`, {
      method: 'GET', headers, signal, cache: 'no-store'
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      const error = new Error(data.error || `HTTP ${response.status}`);
      error.code = data.error || `HTTP_${response.status}`;
      throw error;
    }
    if (!response.body) throw new Error('SSE_STREAM_UNAVAILABLE');
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true }).replace(/\r/g, '');
        let boundary;
        while ((boundary = buffer.indexOf('\n\n')) !== -1) {
          const frame = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          const lines = frame.split('\n');
          const event = lines.find(line => line.startsWith('event:'))?.slice(6).trim() || 'message';
          if (event !== 'state') continue;
          const payload = lines.filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n');
          if (payload) {
            try { onState(JSON.parse(payload)); }
            catch (error) {
              if (!(error instanceof SyntaxError)) throw error;
              console.warn('Display SSE: malformed state frame ignored');
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  getDisplayState(screenId) {
    return this.getJson(`/api/displays/${encodeURIComponent(screenId)}/state`);
  }
}
