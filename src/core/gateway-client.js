export class GatewayClient {
  constructor(baseUrl) {
    this.baseUrl = String(baseUrl || '').replace(/\/$/, '');
  }

  async getJson(path) {
    if (!this.baseUrl) throw new Error('Gateway no configurado');
    const res = await fetch(`${this.baseUrl}${path}`, {
      headers: { Accept: 'application/json' },
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

  getAttendanceState() {
    return this.getJson('/api/attendance/state');
  }

  getScreenConfig(screenId) {
    const id = encodeURIComponent(screenId || '');
    return this.getJson(`/api/display/config?screenId=${id}`);
  }

  getScreenState(screenId) {
    const id = encodeURIComponent(screenId || '');
    return this.getJson(`/api/display/state?screenId=${id}`);
  }

  getDisplayState(filters = {}) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
    }
    return this.getJson(`/api/display/state${params.toString() ? `?${params}` : ''}`);
  }
}
