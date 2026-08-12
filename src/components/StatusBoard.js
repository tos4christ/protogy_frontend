import React from 'react';
import api from '../api';

// FEATURE 4: status of all feeders - all / online / offline, auto-refreshes.
class StatusBoard extends React.Component {
  constructor(props) {
    super(props);
    this.state = { filter: 'all', disco: 'all', discos: [], search: '', searchInput: '', data: null, error: null, busy: false };
    this.searchTimer = null;
    this.load = this.load.bind(this);
    this.setFilter = this.setFilter.bind(this);
  }

  componentDidMount() {
    api.listDiscos().then((discos) => this.setState({ discos })).catch(() => {});
    this.load();
    // polling becomes the FALLBACK (60s); the WebSocket does the real-time work
    this.timer = setInterval(() => { if (!document.hidden) this.load(); }, 60000);
    this.connectLive();
  }

  // ---- real-time channel -------------------------------------------------
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
        this.ws = null; // reconnect with backoff while the tab is open
        this.wsRetry = setTimeout(() => this.connectLive(), 5000);
      };
    } catch (e) { /* WebSocket unavailable: polling fallback still works */ }
  }

  applyLive(msg) {
    if (msg.type !== 'reading' || !this.state.data) return;
    const d = msg.data;
    const meters = this.state.data.meters.slice();
    const i = meters.findIndex((m) => m.meter_id === msg.meterId);
    if (i === -1) {
      // unknown meter (just auto-registered): refresh the list, throttled
      if (!this.unknownReload || Date.now() - this.unknownReload > 30000) {
        this.unknownReload = Date.now();
        this.load();
      }
      return;
    }
    meters[i] = {
      ...meters[i],
      connectivity: 'online',
      last_reading_at: d.timestamp,
      last_received_at: msg.receivedTs,
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

  componentWillUnmount() {
    clearInterval(this.timer); clearTimeout(this.searchTimer); clearTimeout(this.wsRetry);
    if (this.ws) { this.ws.onclose = null; this.ws.close(); }
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
      <div className="card">
        <h2>Feeder Status <span className="live-dot" title="Live updates active"></span> {busy && <span className="muted">refreshing…</span>}</h2>
        <div className="controls">
          {['all', 'online', 'offline'].map((f) => (
            <button key={f}
              className={'btn ' + (filter === f ? '' : 'secondary')}
              onClick={() => this.setFilter(f)}>
              {f.toUpperCase()}
            </button>
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
        {data && data.counts && (
          <div className="stat-grid" style={{ marginBottom: 14 }}>
            <div className="stat"><div className="v">{data.count}</div><div className="l">Total feeders</div></div>
            <div className="stat"><div className="v">{data.counts.online || 0}</div><div className="l">Online</div></div>
            <div className="stat"><div className="v">{data.counts.offline || 0}</div><div className="l">Offline</div></div>
            <div className="stat"><div className="v">{data.counts.never_reported || 0}</div><div className="l">Never reported</div></div>
          </div>
        )}
        {data && (
          <div className="table-wrap">
            <table className="data wide">
              <thead>
                <tr>
                  <th>Feeder</th><th>Disco</th><th>Meter ID</th><th>Connectivity</th><th>Onboarding</th>
                  <th>Last Reading</th>
                  <th>V L1</th><th>V L2</th><th>V L3</th>
                  <th>I L1</th><th>I L2</th><th>I L3</th>
                  <th>Active Pwr</th><th>Reactive Pwr</th><th>Apparent Pwr</th>
                  <th>PF</th><th>Freq</th>
                  <th>Active Energy</th><th>Reactive Energy</th><th>Apparent Energy</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((m) => (
                  <tr key={m.meter_id + '|' + (m.last_received_at || '')} className="row-live">
                    <td>{m.feeder_name || '—'}</td>
                    <td>{m.disco || '—'}</td>
                    <td>{m.meter_id}</td>
                    <td><span className={'badge ' + m.connectivity}>{m.connectivity}</span></td>
                    <td><span className={'badge ' + m.onboarding_status}>{m.onboarding_status}</span></td>
                    <td>{m.last_reading_at ? new Date(m.last_reading_at).toLocaleString() : '—'}</td>
                    {[['voltage_l1',1],['voltage_l2',1],['voltage_l3',1],
                      ['current_l1',2],['current_l2',2],['current_l3',2],
                      ['active_power',1],['reactive_power',1],['apparent_power',1],
                      ['power_factor',3],['frequency',2],
                      ['active_energy',1],['reactive_energy',1],['apparent_energy',1]]
                      .map(([k, dp]) => (
                        <td key={k}>{m[k] != null ? Number(m[k]).toFixed(dp) : '—'}</td>
                      ))}
                  </tr>
                ))}
                {visible.length === 0 && (
                  <tr><td colSpan="20" className="muted">No feeders match this filter.</td></tr>
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
