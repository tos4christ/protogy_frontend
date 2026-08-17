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
// admin columns (Disco, Meter ID, Onboarding) at the end.
// NERC item 1: phase colours Red/Yellow/Blue on L1/L2/L3 headers.
const PHASE = { 1: 'ph-r', 2: 'ph-y', 3: 'ph-b' };
const NUM_COLS = [
  ['voltage_l1', 1, 'V L1', PHASE[1]], ['voltage_l2', 1, 'V L2', PHASE[2]], ['voltage_l3', 1, 'V L3', PHASE[3]],
  ['current_l1', 2, 'I L1', PHASE[1]], ['current_l2', 2, 'I L2', PHASE[2]], ['current_l3', 2, 'I L3', PHASE[3]],
  ['active_power', 1, 'Active Pwr'], ['reactive_power', 1, 'Reactive Pwr'], ['apparent_power', 1, 'Apparent Pwr'],
  ['power_factor', 3, 'PF'], ['frequency', 2, 'Freq'],
  ['active_energy', 1, 'Active Energy'], ['reactive_energy', 1, 'Reactive Energy'], ['apparent_energy', 1, 'Apparent Energy'],
];

class StatusBoard extends React.Component {
  constructor(props) {
    super(props);
    this.state = { filter: 'all', disco: 'all', discos: [], search: '', searchInput: '',
                   data: null, error: null, busy: false };
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
    if (i === -1) {
      if (!this.unknownReload || Date.now() - this.unknownReload > 30000) {
        this.unknownReload = Date.now();
        this.load();
      }
      return;
    }
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

  setFilter(filter) { this.setState({ filter }, this.load); }

  load() {
    this.setState({ busy: true });
    api.meterStatus(this.state.filter, this.state.disco)
      .then((data) => this.setState({ data, error: null, busy: false }))
      .catch((e) => this.setState({ error: e.message, busy: false }));
  }

  render() {
    const { filter, disco, discos, search, data, error, busy } = this.state;
    const q = search.trim().toLowerCase();
    const visible = data ? data.meters.filter((m) =>
      !q || (m.feeder_name || '').toLowerCase().includes(q)
         || (m.meter_id || '').toLowerCase().includes(q)
         || (m.disco || '').toLowerCase().includes(q)) : [];

    return (
      <div className="card status-dense">
        <h2>Feeder Status <span className="live-dot" title="Live updates active"></span>
          {' '}{busy && <span className="muted">refreshing…</span>}</h2>
        <div className="controls">
          {['all', 'online', 'offline'].map((f) => (
            <button key={f} className={'btn ' + (filter === f ? '' : 'secondary')}
              onClick={() => this.setFilter(f)}>{f.toUpperCase()}</button>
          ))}
          <label>Disco
            <select value={disco}
              onChange={(e) => this.setState({ disco: e.target.value }, this.load)}>
              <option value="all">All Discos</option>
              {discos.map((d) => (
                <option key={d.disco} value={d.disco}>{d.disco} ({d.feeders})</option>
              ))}
            </select>
          </label>
          <label>Search feeder
            <input value={this.state.searchInput} placeholder="type feeder name, meter id…"
              onChange={(e) => {
                const v = e.target.value;
                this.setState({ searchInput: v });
                clearTimeout(this.searchTimer);
                this.searchTimer = setTimeout(() => this.setState({ search: v }), 250);
              }} />
          </label>
        </div>
        {error && <div className="error">{error}</div>}
        {data && (
          <div className="table-wrap">
            <table className="data wide">
              <thead>
                <tr>
                  <th>Feeder</th><th>Connectivity</th><th>Last Reading</th>
                  {NUM_COLS.map(([k, , label, ph]) => (
                    <th key={k} className={ph || ''}>{label}</th>
                  ))}
                  <th>Disco</th><th>Meter ID</th><th>Onboarding</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((m) => (
                  <tr key={m.meter_id + '|' + (m.last_received_at || '')} className="row-live">
                    <td>{m.feeder_name || '—'}</td>
                    <td><span className={'badge ' + m.connectivity}>{m.connectivity}</span></td>
                    <td>{minutesAgo(m.last_reading_at)}</td>
                    {NUM_COLS.map(([k, dp]) => (
                      <td key={k}>{m[k] != null ? Number(m[k]).toFixed(dp) : '—'}</td>
                    ))}
                    <td>{m.disco || '—'}</td>
                    <td>{m.meter_id}</td>
                    <td><span className={'badge ' + m.onboarding_status}>{m.onboarding_status}</span></td>
                  </tr>
                ))}
                {visible.length === 0 && (
                  <tr><td colSpan={NUM_COLS.length + 6} className="muted">No feeders match this filter.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }
}

export default StatusBoard;
