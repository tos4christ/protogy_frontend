// api.js - all backend calls in one place, with JWT handling
const BASE = process.env.REACT_APP_API_URL || '/api';

let onUnauthorized = null;
export function setUnauthorizedHandler(fn) { onUnauthorized = fn; }

function token() { return localStorage.getItem('protogy_token') || ''; }

async function j(url, opts = {}) {
  opts.headers = { ...(opts.headers || {}), Authorization: 'Bearer ' + token() };
  const res = await fetch(BASE + url, opts);
  if (res.status === 401 && onUnauthorized) onUnauthorized();
  if (!res.ok) {
    let msg = res.statusText;
    try { msg = (await res.json()).error || msg; } catch (e) { /* ignore */ }
    throw new Error(msg);
  }
  return res.json();
}

const api = {
  login: async (username, password) => {
    const res = await fetch(BASE + '/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      let msg = res.statusText;
      try { msg = (await res.json()).error || msg; } catch (e) { /* ignore */ }
      throw new Error(msg);
    }
    const data = await res.json();
    localStorage.setItem('protogy_token', data.token);
    localStorage.setItem('protogy_user', data.username);
    localStorage.setItem('protogy_role', data.role);
    return data;
  },
  logout: () => {
    localStorage.removeItem('protogy_token');
    localStorage.removeItem('protogy_user');
    localStorage.removeItem('protogy_role');
  },
  session: () => (token()
    ? { username: localStorage.getItem('protogy_user'), role: localStorage.getItem('protogy_role') }
    : null),

  health: () => j('/health'),
  nercSummary: (disco, band) => {
    const qs = [];
    if (disco && disco !== 'all') qs.push(`disco=${encodeURIComponent(disco)}`);
    if (band && band !== 'all') qs.push(`band=${encodeURIComponent(band)}`);
    return j(`/nerc/summary${qs.length ? `?${qs.join('&')}` : ''}`);
  },
  nercTable: (date, disco, band) => {
    const qs = [];
    if (date) qs.push(`date=${date}`);
    if (disco && disco !== 'all') qs.push(`disco=${encodeURIComponent(disco)}`);
    if (band && band !== 'all') qs.push(`band=${encodeURIComponent(band)}`);
    return j(`/nerc/summary-table${qs.length ? `?${qs.join('&')}` : ''}`);
  },
  nercCompliance: (date, disco, band) => {
    const qs = [];
    if (date) qs.push(`date=${date}`);
    if (disco && disco !== 'all') qs.push(`disco=${encodeURIComponent(disco)}`);
    if (band && band !== 'all') qs.push(`band=${encodeURIComponent(band)}`);
    return j(`/nerc/compliance${qs.length ? `?${qs.join('&')}` : ''}`);
  },
  // disco + band are folded into every report link so exports always match
  // what's selected on screen (NERC review II, items ix/x/xiii, plus Band
  // filtering added afterward so DAR can be pulled per-Band per-Disco).
  nercReportUrl: (name, qs, disco, band) =>
    `${BASE}/nerc/report/${name}?${qs}` +
    `${disco && disco !== 'all' ? `&disco=${encodeURIComponent(disco)}` : ''}` +
    `${band && band !== 'all' ? `&band=${encodeURIComponent(band)}` : ''}` +
    `&token=${encodeURIComponent(token())}`,
  sbtScorecard: (date, disco, band) => {
    const qs = [];
    if (date) qs.push(`date=${date}`);
    if (disco && disco !== 'all') qs.push(`disco=${encodeURIComponent(disco)}`);
    if (band && band !== 'all') qs.push(`band=${encodeURIComponent(band)}`);
    return j(`/nerc/sbt-scorecard${qs.length ? `?${qs.join('&')}` : ''}`);
  },
  leagueTable: (date, compareDays) => {
    const qs = [];
    if (date) qs.push(`date=${date}`);
    if (compareDays) qs.push(`compareDays=${compareDays}`);
    return j(`/nerc/league-table${qs.length ? `?${qs.join('&')}` : ''}`);
  },
  darAnomalies: (days, disco, band) => {
    const qs = [];
    if (days) qs.push(`days=${days}`);
    if (disco && disco !== 'all') qs.push(`disco=${encodeURIComponent(disco)}`);
    if (band && band !== 'all') qs.push(`band=${encodeURIComponent(band)}`);
    return j(`/nerc/dar-anomalies${qs.length ? `?${qs.join('&')}` : ''}`);
  },
  getSettings: () => j('/settings'),
  saveSettings: (body) => j('/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }),
  amiListMeters: () => j('/ami/admin/meters'),
  amiSimList: () => j('/ami/admin/meters/simulations'),
  amiSetMeterStatus: (serial, status) => j(`/ami/admin/meters/${encodeURIComponent(serial)}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  }),
  amiSimulate: (serial, action) => j(`/ami/admin/meters/${encodeURIComponent(serial)}/simulate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action }),
  }),
  amiRegisterMeter: (meterSerial, tariffNairaPerKwh) => j('/ami/admin/meters', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ meterSerial, tariffNairaPerKwh }),
  }),
  listUsers: () => j('/auth/users'),
  createUser: (username, password, role) => j('/auth/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, role }),
  }),
  deleteUser: (username) => j(`/auth/users/${encodeURIComponent(username)}`, { method: 'DELETE' }),

  listMeters: (disco) => j('/meters' + (disco && disco !== 'all' ? `?disco=${encodeURIComponent(disco)}` : '')),
  listDiscos: () => j('/discos'),
  listBands: () => j('/bands'),
  onboardMeter: (body) => j('/meters', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }),
  meterStatus: (filter, disco, band, page, limit) => {
    const qs = [`filter=${filter}`];
    if (disco && disco !== 'all') qs.push(`disco=${encodeURIComponent(disco)}`);
    if (band && band !== 'all') qs.push(`band=${encodeURIComponent(band)}`);
    if (page) qs.push(`page=${page}`);
    if (limit) qs.push(`limit=${limit}`);
    return j(`/meters/status?${qs.join('&')}`);
  },
  meterDetails: (id) => j(`/meters/${encodeURIComponent(id)}`),
  readings: (id, date, page, limit, order) =>
    j(`/meters/${encodeURIComponent(id)}/readings?date=${date}&page=${page}&limit=${limit}&order=${order}`),
  darRange: (id, from, to) => j(`/meters/${encodeURIComponent(id)}/dar?from=${from}&to=${to}`),
  darDays: (id, days) => j(`/meters/${encodeURIComponent(id)}/dar?days=${days}`),
  darIntraday: (id, date) => j(`/meters/${encodeURIComponent(id)}/dar?date=${date}&resolution=15min`),
  uptime: (id, date) => j(`/meters/${encodeURIComponent(id)}/uptime?date=${date}`),
  gaps: (id, date) => j(`/meters/${encodeURIComponent(id)}/gaps?date=${date}`),
  overview: (disco, band, page, limit) => {
    const qs = [];
    if (disco && disco !== 'all') qs.push(`disco=${encodeURIComponent(disco)}`);
    if (band && band !== 'all') qs.push(`band=${encodeURIComponent(band)}`);
    if (page) qs.push(`page=${page}`);
    if (limit) qs.push(`limit=${limit}`);
    return j(`/dashboard/overview${qs.length ? `?${qs.join('&')}` : ''}`);
  },
  series: (id, date) => j(`/meters/${encodeURIComponent(id)}/series?date=${date}`),
  setMeterStatus: (id, status) => j(`/meters/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  }),
  deleteMeter: (id, purge) => j(`/meters/${encodeURIComponent(id)}?purge=${purge ? 'true' : 'false'}`, {
    method: 'DELETE',
  }),
  // token passed as query param because <a download> cannot send headers
  downloadUrl: (id, from, to) =>
    `${BASE}/meters/${encodeURIComponent(id)}/download?from=${from}&to=${to}&token=${encodeURIComponent(token())}`,
};

export default api;
