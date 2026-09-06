import React from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from 'recharts';
import api from '../api';

const today = () => new Date().toISOString().slice(0, 10);
const yesterday = () => { const d = new Date(); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0, 10); };
const daysAgo = (n) => { const d = new Date(); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };
const PAGE_SIZES = [10, 25, 50, 100];

// Colour-coded cell background for a DAR% value — same green/amber/red
// thresholds used everywhere else in the app, but as a tinted background
// (not just text colour) since this whole page IS the colour-coding.
function cellStyle(v) {
  if (v == null) return { background: 'var(--row-alt)', color: 'var(--mut)' };
  if (v >= 95) return { background: 'rgba(47,158,68,.22)', color: '#1c6e2e', fontWeight: 700 };
  if (v >= 80) return { background: 'rgba(232,168,12,.25)', color: '#8a6200', fontWeight: 700 };
  return { background: 'rgba(214,69,69,.22)', color: '#a02323', fontWeight: 700 };
}
const shortDay = (d) => d.slice(5); // 'YYYY-MM-DD' -> 'MM-DD'

// PAGE 2 — HISTORICAL DAR ACROSS ALL SUBSTATIONS (NERC requirement).
// A substation x date matrix, colour-coded, plus a filtered-scope daily
// average trend line above it. The date control is a From/To RANGE,
// deliberately separate from Page 1's single-date filter.
class DarHistory extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      data: null, error: null,
      discos: [], states: [], voltageClasses: [],
      from: daysAgo(13), to: yesterday(),
      disco: 'all', band: 'all', state: 'all', voltageClass: 'all',
      page: 1, limit: 25,
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
    const { from, to, disco, band, state, voltageClass, page, limit } = this.state;
    api.darHistory({ from, to, disco, band, state, voltageClass, page, limit })
      .then((data) => this.setState({ data, error: null }))
      .catch((e) => this.setState({ error: e.message }));
  }

  onFilterChange(patch) {
    this.setState({ ...patch, page: 1 }, this.load);
  }

  render() {
    const { data, error, discos, states, voltageClasses,
      from, to, disco, band, state, voltageClass, page, limit } = this.state;
    if (error) return <div className="error">{error}</div>;
    if (!data) return <div className="card">Loading DAR history…</div>;
    const totalPages = data.totalPages || 1;

    return (
      <div>
        <div className="card">
          <h2>Historical D.A.R Across All Substations</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            Data Acquisition Rate trend over a date range, across every matching substation.
            The date range here is separate from the single-day filter used on the Executive
            Summary page.
          </p>
          <div className="controls">
            <label>From
              <input type="date" value={from} max={to}
                onChange={(e) => this.onFilterChange({ from: e.target.value })} />
            </label>
            <label>To
              <input type="date" value={to} max={today()}
                onChange={(e) => this.onFilterChange({ to: e.target.value })} />
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
          {data.days.length >= 92 && (
            <p className="muted">Range capped at 92 days to keep this page responsive —
              narrow the filters above for a longer effective history.</p>
          )}

          <h3 className="sub-h">Average D.A.R Trend ({from} to {to})</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={data.dailyAvg.map((d) => ({ ...d, label: shortDay(d.day) }))}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 100]} unit="%" />
              <Tooltip formatter={(v) => [v != null ? v + '%' : '—', 'Avg D.A.R']} />
              <Line isAnimationActive={false} type="monotone" dataKey="avgDarPct"
                stroke="#1653a1" strokeWidth={2} dot={{ r: 2 }} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h2>Substation D.A.R Matrix</h2>
          <div className="controls">
            <span className="muted">Showing {data.feederRows.length} of {data.total} substations</span>
            <label style={{ marginLeft: 'auto' }}>Per page
              <select value={limit} onChange={(e) => this.onFilterChange({ limit: +e.target.value })}>
                {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            <button className="btn secondary" disabled={page <= 1}
              onClick={() => this.setState({ page: page - 1 }, this.load)}>‹ Prev</button>
            <span className="muted">Page {page} of {totalPages}</span>
            <button className="btn secondary" disabled={page >= totalPages}
              onClick={() => this.setState({ page: page + 1 }, this.load)}>Next ›</button>
          </div>
          <div className="controls">
            <span className="map-legend">
              <i style={{ background: '#2f9e44' }}></i> ≥ 95%
              <i style={{ background: '#e8a80c' }}></i> 80–95%
              <i style={{ background: '#d64545' }}></i> &lt; 80%
              <i style={{ background: 'var(--mut)' }}></i> no data
            </span>
          </div>
          <div className="table-wrap">
            <table className="data compact wide">
              <thead>
                <tr>
                  <th>Feeder</th><th>Disco</th><th>Band</th><th>Avg</th>
                  {data.days.map((d) => <th key={d}>{shortDay(d)}</th>)}
                </tr>
              </thead>
              <tbody>
                {data.feederRows.map((f) => (
                  <tr key={f.meterId}>
                    <td>{f.feeder}</td>
                    <td>{f.disco || '—'}</td>
                    <td>{f.band || '—'}</td>
                    <td style={{ fontWeight: 700 }}>{f.avgDarPct != null ? f.avgDarPct + '%' : '—'}</td>
                    {f.values.map((v, i) => (
                      <td key={i} style={{ textAlign: 'center', ...cellStyle(v) }}>
                        {v != null ? Math.round(v) : '—'}
                      </td>
                    ))}
                  </tr>
                ))}
                {data.feederRows.length === 0 &&
                  <tr><td colSpan={4 + data.days.length} className="muted">No feeders match this filter.</td></tr>}
              </tbody>
            </table>
          </div>
          <p className="muted">Each cell is that substation's D.A.R% for that day. Scroll
            sideways for longer date ranges.</p>
        </div>
      </div>
    );
  }
}

export default DarHistory;
