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
    return this.getJson(`/api/display/config?screenId=${encodeURIComponent(screenId)}`);
  }

  saveDisplayConfig(screenId, config) {
    return this.putJson('/api/display/config', { screenId, ...config });
  }

  getDisplayState(screenId) {
    return this.getJson(`/api/display/state?screenId=${encodeURIComponent(screenId)}`);
  }
}
