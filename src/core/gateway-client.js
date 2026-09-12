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
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers,
      cache: 'no-store'
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.ok === false) {
      const error = new Error(data?.error || `HTTP ${res.status}`);
      error.status = res.status;
      error.data = data;
      throw error;
    }
    return data;
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
