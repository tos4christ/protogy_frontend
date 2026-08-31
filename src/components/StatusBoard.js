import React from 'react';
import api from '../api';

// NERC item 4: last reading as "minutes ago"
function minutesAgo(ts) {
  if (!ts) return '—';
  const s = Math.max(0, (Date.now() - new Date(ts).getTime()) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m ago`;
}

// NERC item 6: column order — feeder/connectivity/last-reading/phases first,
// admin columns (Disco, Band, Meter ID, Onboarding) at the end.
// NERC item 1: phase colours Red/Yellow/Blue on L1/L2/L3 headers.
// NERC review II, item xi: every electrical column carries its unit. Voltage,
// current and frequency are always in the same SI unit regardless of meter,
// so the unit lives in the header. Power and energy can be reported in W/kW
// or Wh/kWh per meter (see meters.power_unit / energy_unit), so those
// columns carry the unit per-row instead of a single fixed header unit.
const PHASE = { 1: 'ph-r', 2: 'ph-y', 3: 'ph-b' };
const NUM_COLS = [
  ['voltage_l1', 1, 'V L1 (kV)', PHASE[1]], ['voltage_l2', 1, 'V L2 (kV)', PHASE[2]], ['voltage_l3', 1, 'V L3 (kV)', PHASE[3]],
  ['current_l1', 2, 'I L1 (A)', PHASE[1]], ['current_l2', 2, 'I L2 (A)', PHASE[2]], ['current_l3', 2, 'I L3 (A)', PHASE[3]],
  ['active_power', 1, 'Active Pwr', null, 'power_unit'],
  ['reactive_power', 1, 'Reactive Pwr', null, 'power_unit'],
  ['apparent_power', 1, 'Apparent Pwr', null, 'power_unit'],
  ['power_factor', 3, 'PF (ratio)'], ['frequency', 2, 'Freq (Hz)'],
  ['active_energy', 1, 'Active Energy', null, 'energy_unit'],
  ['reactive_energy', 1, 'Reactive Energy', null, 'energy_unit'],
  ['apparent_energy', 1, 'Apparent Energy', null, 'energy_unit'],
];
const PAGE_SIZES = [25, 50, 100, 250, 500];
const BANDS = ['A', 'B', 'C', 'D', 'E'];

class StatusBoard extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      filter: 'all', disco: 'all', band: 'all', discos: [], search: '', searchInput: '',
      page: 1, limit: 100,
      data: null, error: null, busy: false,
    };
    this.searchTimer = null;
    this.load = this.load.bind(this);
    this.setFilter = this.setFilter.bind(this);
  }

  componentDidMount() {
    api.listDiscos().then((discos) => this.setState({ discos })).catch(() => {});
    this.load();
    this.timer = setInterval(() => { if (!document.hidden) this.load(); }, 60000);
    this.connectLive();
    // re-render each 30s so "minutes ago" stays current even without new data
    this.clockTimer = setInterval(() => this.forceUpdate(), 30000);
  }

  componentWillUnmount() {
    clearInterval(this.timer); clearInterval(this.clockTimer);
    clearTimeout(this.searchTimer); clearTimeout(this.wsRetry);
    if (this.ws) { this.ws.onclose = null; this.ws.close(); }
  }

  connectLive() {
    const token = localStorage.getItem('protogy_token');
    if (!token) return;
    const proto = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
    const host = window.location.host || 'localhost:3000';
    try {
      this.ws = new WebSocket(`${proto}${host}/ws?token=${encodeURIComponent(token)}`);
      this.ws.onmessage = (ev) => {
        try { this.applyLive(JSON.parse(ev.data)); } catch (e) { /* ignore */ }
      };
      this.ws.onclose = () => {
        this.ws = null;
        this.wsRetry = setTimeout(() => this.connectLive(), 5000);
      };
    } catch (e) { /* polling fallback active */ }
  }

  applyLive(msg) {
    if (msg.type !== 'reading' || !this.state.data) return;
    const d = msg.data;
    const meters = this.state.data.meters.slice();
    const i = meters.findIndex((m) => m.meter_id === msg.meterId);
    // With server-side pagination the meter simply may not be on the current
    // page — that's normal and not a reason to reload the whole page.
    if (i === -1) return;
    meters[i] = {
      ...meters[i], connectivity: 'online',
      last_reading_at: d.timestamp, last_received_at: msg.receivedTs,
      voltage_l1: d.voltage_l1, voltage_l2: d.voltage_l2, voltage_l3: d.voltage_l3,
      current_l1: d.current_l1, current_l2: d.current_l2, current_l3: d.current_l3,
      active_power: d.active_power, reactive_power: d.reactive_power,
      apparent_power: d.apparent_power, power_factor: d.power_factor,
      frequency: d.frequency,
      active_energy: d.active_energy, reactive_energy: d.reactive_energy,
      apparent_energy: d.apparent_energy,
    };
    this.setState({ data: { ...this.state.data, meters } });
  }

  setFilter(patch) {
    // Any filter change (status/Disco/Band/search) resets to page 1, since
    // the previous page number may no longer exist in the narrower result.
    this.setState({ ...patch, page: 1 }, this.load);
  }

  load() {
    const { filter, disco, band, page, limit } = this.state;
    this.setState({ busy: true });
    api.meterStatus(filter, disco, band, page, limit)
      .then((data) => this.setState({ data, error: null, busy: false }))
      .catch((e) => this.setState({ error: e.message, busy: false }));
  }

  render() {
    const { filter, disco, band, discos, search, page, limit, data, error, busy } = this.state;
    const q = search.trim().toLowerCase();
    // Search narrows within the current page only — for fleets of thousands,
    // a global text search should go through the disco/band filters + a
    // smaller page size rather than pulling every feeder to the client.
    const visible = data ? data.meters.filter((m) =>
      !q || (m.feeder_name || '').toLowerCase().includes(q)
         || (m.meter_id || '').toLowerCase().includes(q)
         || (m.disco || '').toLowerCase().includes(q)) : [];
    const totalPages = data ? (data.totalPages || 1) : 1;

    return (
      <div className="card status-dense scada">
        <h2>Feeder Status <span className="live-dot" title="Live updates active"></span>
          {' '}{busy && <span className="muted">refreshing…</span>}
          {data && <span className="muted"> — {data.total} feeders
            {data.counts && ` (${data.counts.online || 0} online / ${(data.counts.offline || 0) + (data.counts.never_reported || 0)} offline)`}
          </span>}
        </h2>
        <div className="controls compact-controls">
          {['all', 'online', 'offline'].map((f) => (
            <button key={f} className={'btn ' + (filter === f ? '' : 'secondary')}
              onClick={() => this.setFilter({ filter: f })}>{f.toUpperCase()}</button>
          ))}
          <label>Disco
            <select value={disco}
              onChange={(e) => this.setFilter({ disco: e.target.value })}>
              <option value="all">All Discos</option>
              {discos.map((d) => (
                <option key={d.disco} value={d.disco}>{d.disco} ({d.feeders})</option>
              ))}
            </select>
          </label>
          <label>Band
            <select value={band}
              onChange={(e) => this.setFilter({ band: e.target.value })}>
              <option value="all">All Bands</option>
              {BANDS.map((b) => <option key={b} value={b}>Band {b}</option>)}
            </select>
          </label>
          <label>Search feeder (this page)
            <input value={this.state.searchInput} placeholder="type feeder name, meter id…"
              onChange={(e) => {
                const v = e.target.value;
                this.setState({ searchInput: v });
                clearTimeout(this.searchTimer);
                this.searchTimer = setTimeout(() => this.setState({ search: v }), 250);
              }} />
          </label>
          <label>Per page
            <select value={limit} onChange={(e) => this.setFilter({ limit: +e.target.value })}>
              {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
        </div>
        {error && <div className="error">{error}</div>}
        {data && (
          <React.Fragment>
            <div className="table-wrap">
              <table className="data wide compact">
                <thead>
                  <tr>
                    <th>Feeder</th><th>Connectivity</th><th>Last Reading</th>
                    {NUM_COLS.map(([k, , label, ph]) => (
                      <th key={k} className={ph || ''}>{label}</th>
                    ))}
                    <th>Disco</th><th>Band</th><th>Meter ID</th><th>Onboarding</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((m) => (
                    <tr key={m.meter_id + '|' + (m.last_received_at || '')} className="row-live">
                      <td>{m.feeder_name || '—'}</td>
                      <td><span className={'badge ' + m.connectivity}>{m.connectivity}</span></td>
                      <td>{minutesAgo(m.last_reading_at)}</td>
                      {NUM_COLS.map(([k, dp, , , unitField]) => (
                        <td key={k}>
                          {m[k] != null
                            ? Number(m[k]).toFixed(dp) + (unitField ? ' ' + (m[unitField] || '') : '')
                            : '—'}
                        </td>
                      ))}
                      <td>{m.disco || '—'}</td>
                      <td>{m.tariff_band || '—'}</td>
                      <td>{m.meter_id}</td>
                      <td><span className={'badge ' + m.onboarding_status}>{m.onboarding_status}</span></td>
                    </tr>
                  ))}
                  {visible.length === 0 && (
                    <tr><td colSpan={NUM_COLS.length + 7} className="muted">No feeders match this filter.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="controls">
              <span className="muted">
                Showing {visible.length ? (page - 1) * (typeof limit === 'number' ? limit : 0) + 1 : 0}
                –{(page - 1) * (typeof limit === 'number' ? limit : 0) + visible.length} of {data.total}
              </span>
              <button className="btn secondary" disabled={page <= 1} style={{ marginLeft: 'auto' }}
                onClick={() => this.setState({ page: page - 1 }, this.load)}>‹ Prev</button>
              <span className="muted">Page {page} of {totalPages}</span>
              <button className="btn secondary" disabled={page >= totalPages}
                onClick={() => this.setState({ page: page + 1 }, this.load)}>Next ›</button>
            </div>
          </React.Fragment>
        )}
      </div>
    );
  }
}

export default StatusBoard;
