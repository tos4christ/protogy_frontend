import React from 'react';
import api from '../api';

const today = () => new Date().toISOString().slice(0, 10);
const yesterday = () => { const d = new Date(); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0, 10); };
const pctColor = (pct) => (pct == null ? undefined : pct >= 95 ? '#2f9e44' : pct >= 80 ? '#e8a80c' : '#d64545');

function Tile({ value, label, color }) {
  return (
    <div className="stat">
      <div className="v" style={color ? { color } : undefined}>{value}</div>
      <div className="l">{label}</div>
    </div>
  );
}

// PAGE 1 — EXECUTIVE SUMMARY (NERC requirement, Aug 2026 correspondence).
// Fleet status for a single day, filterable by Date, Disco, State, Voltage
// Level, and Band: online/offline, DAR, Availability (hours supplied ÷
// hours required for each feeder's Band — the same formula the monthly
// Performance Categorization page will use), energy, and load.
class ExecutiveSummary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      data: null, error: null,
      discos: [], states: [], voltageClasses: [],
      date: yesterday(), disco: 'all', band: 'all', state: 'all', voltageClass: 'all',
    };
    this.load = this.load.bind(this);
  }

  componentDidMount() {
    api.listDiscos().then((discos) => this.setState({ discos })).catch(() => {});
    api.listStates().then((states) => this.setState({ states })).catch(() => {});
    api.listVoltageClasses().then((voltageClasses) => this.setState({ voltageClasses })).catch(() => {});
    this.load();
  }

  load() {
    const { date, disco, band, state, voltageClass } = this.state;
    api.executiveSummary({ date, disco, band, state, voltageClass })
      .then((data) => this.setState({ data, error: null }))
      .catch((e) => this.setState({ error: e.message }));
  }

  onFilterChange(patch) {
    this.setState(patch, this.load);
  }

  // Placeholder for the Page 1 -> Page 3 drill-down link (Page 3 not built
  // yet). Once it exists, this hands the clicked Disco + current filters to
  // the parent App shell so it can switch tabs and pre-select them there.
  drillInto(disco) {
    if (this.props.onDrillDown) {
      this.props.onDrillDown({ disco, date: this.state.date, band: this.state.band,
        state: this.state.state, voltageClass: this.state.voltageClass });
    }
  }

  render() {
    const { data, error, discos, states, voltageClasses, date, disco, band, state, voltageClass } = this.state;
    if (error) return <div className="error">{error}</div>;
    if (!data) return <div className="card">Loading executive summary…</div>;

    return (
      <div>
        <div className="card">
          <h2>Executive Summary</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            Fleet-wide feeder performance for a single day. Defaults to yesterday, since a
            day still in progress can't yet have accumulated its required supply hours.
          </p>
          <div className="controls">
            <label>Date
              <input type="date" value={date} max={today()}
                onChange={(e) => this.onFilterChange({ date: e.target.value })} />
            </label>
            <label>Disco
              <select value={disco} onChange={(e) => this.onFilterChange({ disco: e.target.value })}>
                <option value="all">All Discos</option>
                {discos.map((d) => <option key={d.disco} value={d.disco}>{d.disco} ({d.feeders})</option>)}
              </select>
            </label>
            <label>State
              <select value={state} onChange={(e) => this.onFilterChange({ state: e.target.value })}>
                <option value="all">All States</option>
                {states.map((s) => <option key={s.state} value={s.state}>{s.state} ({s.feeders})</option>)}
              </select>
            </label>
            <label>Voltage Level
              <select value={voltageClass} onChange={(e) => this.onFilterChange({ voltageClass: e.target.value })}>
                <option value="all">All Voltage Levels</option>
                {voltageClasses.map((v) => (
                  <option key={v.voltage_class} value={v.voltage_class}>{v.voltage_class} ({v.feeders})</option>
                ))}
              </select>
            </label>
            <label>Band
              <select value={band} onChange={(e) => this.onFilterChange({ band: e.target.value })}>
                <option value="all">All Bands</option>
                {['A', 'B', 'C', 'D', 'E'].map((b) => <option key={b} value={b}>Band {b}</option>)}
              </select>
            </label>
          </div>

          <div className="stat-grid">
            <Tile value={data.feeders} label="Feeders in scope" />
            <Tile value={data.online} label="Online feeders" color="#2f9e44" />
            <Tile value={data.offline} label="Offline feeders" color="#d64545" />
            <Tile value={data.avgDarPct != null ? data.avgDarPct + '%' : '—'} label="Avg D.A.R"
              color={pctColor(data.avgDarPct)} />
            <Tile value={data.availabilityPct != null ? data.availabilityPct + '%' : '—'}
              label="Availability compliance" color={pctColor(data.availabilityPct)} />
            <Tile value={data.totalEnergyKwh.toLocaleString() + ' kWh'} label="Total energy (day)" />
            <Tile value={(data.avgLoadKW != null ? data.avgLoadKW : '—') + ' kW'} label="Avg load" />
            <Tile value={(data.peakLoadKW != null ? data.peakLoadKW : '—') + ' kW'} label="Peak load" />
          </div>
          <p className="muted" style={{ marginTop: 10 }}>
            Availability = hours actually supplied ÷ hours required for each feeder's NERC
            Band, for {date}. This is the same formula the monthly Performance Categorization
            page will use over the 1st–21st window, applied here to a single day.
          </p>
        </div>

        <div className="card">
          <h2>By Disco</h2>
          <div className="table-wrap">
            <table className="data compact">
              <thead>
                <tr><th>Disco</th><th>Feeders</th><th>Online</th><th>Offline</th>
                  <th>Avg D.A.R</th><th>Availability</th><th>Energy (kWh)</th>
                  <th>Avg Load (kW)</th><th>Peak Load (kW)</th></tr>
              </thead>
              <tbody>
                {data.discos.map((d) => (
                  <tr key={d.disco} onClick={() => this.drillInto(d.disco)} style={{ cursor: 'pointer' }}
                    title="Drill down (opens in the Reporting page once built)">
                    <td>{d.disco}</td>
                    <td>{d.feeders}</td>
                    <td style={{ color: '#2f9e44', fontWeight: 700 }}>{d.online}</td>
                    <td style={{ color: '#d64545', fontWeight: 700 }}>{d.offline}</td>
                    <td style={{ color: pctColor(d.avgDarPct), fontWeight: 700 }}>
                      {d.avgDarPct != null ? d.avgDarPct + '%' : '—'}
                    </td>
                    <td style={{ color: pctColor(d.availabilityPct), fontWeight: 700 }}>
                      {d.availabilityPct != null ? d.availabilityPct + '%' : '—'}
                    </td>
                    <td>{d.energyKwh.toLocaleString()}</td>
                    <td>{d.avgLoadKW != null ? d.avgLoadKW : '—'}</td>
                    <td>{d.peakLoadKW}</td>
                  </tr>
                ))}
                {data.discos.length === 0 &&
                  <tr><td colSpan="9" className="muted">No feeders match this filter.</td></tr>}
              </tbody>
            </table>
          </div>
          <p className="muted">Click a row to drill into that Disco's detail — this will open
            the Reporting page (Page 3) pre-filtered once it's built.</p>
        </div>
      </div>
    );
  }
}

export default ExecutiveSummary;
