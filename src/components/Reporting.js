import React from 'react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Legend,
} from 'recharts';
import api from '../api';

const today = () => new Date().toISOString().slice(0, 10);
const yesterday = () => { const d = new Date(); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0, 10); };
const daysAgo = (n) => { const d = new Date(); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };
const num = (v, dp = 1) => (v == null ? '—' : Number(v).toFixed(dp));
const shortDay = (d) => d.slice(5);
const shortTime = (t) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const dayTime = (t) => new Date(t).toLocaleString([], { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
// Label format adapts to how the backend bucketed the intraday series —
// time-only is ambiguous once a range spans more than one day.
function intradayLabel(t, bucket) {
  if (bucket === '1 day') return shortDay(new Date(t).toISOString().slice(0, 10));
  if (bucket === '1 hour' || bucket === '30 minutes') return dayTime(t);
  return shortTime(t);
}
// Resolution options and the maximum date-range span each one allows —
// mirrors the backend's whitelist exactly. A finer resolution collapses
// the maximum viewable range; a coarser one allows a wider one.
const RESOLUTIONS = [
  { value: '1 minute', label: '1 minute', maxDays: 1 },
  { value: '5 minutes', label: '5 minutes', maxDays: 3 },
  { value: '15 minutes', label: '15 minutes', maxDays: 7 },
  { value: '30 minutes', label: '30 minutes', maxDays: 14 },
  { value: '1 hour', label: '1 hour', maxDays: 92 },
];
const maxDaysFor = (resolution) => (RESOLUTIONS.find((r) => r.value === resolution) || RESOLUTIONS[2]).maxDays;
const addDays = (dateStr, n) => { const d = new Date(dateStr + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

function Tile({ value, label }) {
  return (
    <div className="stat">
      <div className="v">{value}</div>
      <div className="l">{label}</div>
    </div>
  );
}

// Builds and triggers a client-side CSV download from already-fetched data
// — no separate backend export endpoint needed, and "download" stays a
// bonus action rather than a required step, per the NERC request that
// viewing without downloading should be the default.
function downloadCsv(filename, headers, rows) {
  const esc = (v) => (v == null ? '' : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
  const csv = [headers.join(','), ...rows.map((r) => r.map(esc).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// PAGE 3 — REPORTING & DRILL-DOWN (NERC requirement).
// Single-feeder deep dive: numbers + graphs for voltage, current, frequency,
// power factor, active/reactive/apparent power (intraday, for the "to"
// date), plus Load Flow and Energy trend lines across the full From-To
// range. Filterable by Disco/Band/State/Voltage Level to narrow which
// feeder to pick. Every result is viewable on screen; downloading is an
// optional extra action, never required.
class Reporting extends React.Component {
  constructor(props) {
    super(props);
    const dd = props.drillDown || {};
    this.state = {
      feeders: [], discos: [], states: [], voltageClasses: [],
      disco: dd.disco || 'all', band: dd.band || 'all',
      state: dd.state || 'all', voltageClass: dd.voltageClass || 'all', search: '',
      meterId: dd.meterId || '',
      resolution: '15 minutes', from: daysAgo(6), to: yesterday(),
      detail: null, error: null, loadingFeeders: true,
    };
    this.loadFeeders = this.loadFeeders.bind(this);
    this.loadDetail = this.loadDetail.bind(this);
  }

  componentDidMount() {
    api.listDiscos().then((discos) => this.setState({ discos })).catch(() => {});
    api.listStates().then((states) => this.setState({ states })).catch(() => {});
    api.listVoltageClasses().then((voltageClasses) => this.setState({ voltageClasses })).catch(() => {});
    this.loadFeeders(true);
  }

  // Reload the feeder dropdown's candidates whenever the narrowing filters
  // change; if the currently selected feeder falls out of the new filtered
  // set, fall back to the first candidate (or auto-select on first load,
  // including honouring a feeder handed off from Page 1's drill-down).
  loadFeeders(isInitial) {
    const { disco, band, state, voltageClass, search, meterId } = this.state;
    this.setState({ loadingFeeders: true });
    api.reportingFeeders({ disco, band, state, voltageClass, search })
      .then((data) => {
        const feeders = data.feeders;
        const stillValid = feeders.some((f) => f.meter_id === meterId);
        const nextMeterId = stillValid ? meterId : (feeders[0] ? feeders[0].meter_id : '');
        this.setState({ feeders, loadingFeeders: false, meterId: nextMeterId }, () => {
          if (this.state.meterId) this.loadDetail();
          else this.setState({ detail: null });
        });
      })
      .catch((e) => this.setState({ error: e.message, loadingFeeders: false }));
  }

  loadDetail() {
    const { meterId, from, to, resolution } = this.state;
    if (!meterId) return;
    api.reportingDetail(meterId, from, to, resolution)
      .then((detail) => this.setState({
        detail, error: null,
        // The backend may have clamped the range to fit the selected
        // resolution — sync the date inputs to whatever was actually used
        // so the picker never silently disagrees with the charts below it.
        from: detail.from, to: detail.to,
      }))
      .catch((e) => this.setState({ error: e.message }));
  }

  // Changing resolution can shrink the maximum viewable range — clamp the
  // "from" date locally first so the picker updates immediately, then
  // reload (the backend enforces the same cap regardless).
  onResolutionChange(resolution) {
    const { to } = this.state;
    const maxDays = maxDaysFor(resolution);
    this.setState((prev) => {
      const spanDays = Math.round((new Date(prev.to) - new Date(prev.from)) / 86400000) + 1;
      const from = spanDays > maxDays ? addDays(prev.to, -(maxDays - 1)) : prev.from;
      return { resolution, from };
    }, this.loadDetail);
  }

  onFilterChange(patch) {
    this.setState(patch, this.loadFeeders);
  }

  onDateChange(patch) {
    this.setState(patch, this.loadDetail);
  }

  exportCsv() {
    const { detail } = this.state;
    if (!detail) return;
    downloadCsv(`${detail.feeder.feeder}_electrical_${detail.from}_to_${detail.to}.csv`,
      ['Time', 'V L1', 'V L2', 'V L3', 'I L1', 'I L2', 'I L3', 'Freq', 'PF', 'Active kW', 'Reactive kW', 'Apparent kW'],
      detail.intraday.map((r) => [r.t, r.v1, r.v2, r.v3, r.i1, r.i2, r.i3, r.freq, r.pf, r.p, r.q, r.s]));
    downloadCsv(`${detail.feeder.feeder}_trend_${detail.from}_to_${detail.to}.csv`,
      ['Day', 'Avg Load (kW)', 'Peak Load (kW)', 'Energy (kWh)'],
      detail.trend.map((r) => [r.day, r.avgLoadKW, r.peakLoadKW, r.energyKwh]));
  }

  render() {
    const { feeders, discos, states, voltageClasses, disco, band, state, voltageClass, search,
      meterId, from, to, detail, error, loadingFeeders } = this.state;

    return (
      <div>
        <div className="card">
          <h2>Reporting — Feeder Deep Dive</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            Narrow with the filters below, then pick a feeder for full numbers and graphs
            across the selected From/To date range.
          </p>
          <div className="controls">
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
            <label>Search
              <input value={search} placeholder="feeder / meter ID"
                onChange={(e) => {
                  const v = e.target.value;
                  this.setState({ search: v });
                  clearTimeout(this.searchTimer);
                  this.searchTimer = setTimeout(() => this.onFilterChange({ search: v }), 300);
                }} />
            </label>
          </div>
          <div className="controls">
            <label style={{ minWidth: 320 }}>Feeder ({feeders.length} match{feeders.length === 1 ? '' : 'es'})
              <select value={meterId} onChange={(e) => this.setState({ meterId: e.target.value }, this.loadDetail)}>
                {feeders.length === 0 && <option value="">No feeders match this filter</option>}
                {feeders.map((f) => (
                  <option key={f.meter_id} value={f.meter_id}>
                    {(f.feeder_name || f.meter_id) + ' — ' + (f.disco || 'no Disco') + ' (' + f.connectivity + ')'}
                  </option>
                ))}
              </select>
            </label>
            <label>Resolution
              <select value={this.state.resolution} onChange={(e) => this.onResolutionChange(e.target.value)}>
                {RESOLUTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </label>
            <label>From
              <input type="date" value={from} max={to} onChange={(e) => this.onDateChange({ from: e.target.value })} />
            </label>
            <label>To
              <input type="date" value={to} max={today()} onChange={(e) => this.onDateChange({ to: e.target.value })} />
            </label>
            <button className="btn secondary" disabled={!detail} onClick={() => this.exportCsv()}>
              Download CSV
            </button>
          </div>
          <p className="muted" style={{ marginTop: 0 }}>
            A finer resolution caps the maximum range you can view at once — 1 minute allows up
            to {maxDaysFor('1 minute')} day, 1 hour allows up to {maxDaysFor('1 hour')} days.
            Pick a coarser resolution first if you want to view a wider date range.
          </p>
          {loadingFeeders && <p className="muted">Loading matching feeders…</p>}
          {error && <div className="error">{error}</div>}
        </div>

        {detail && (
          <React.Fragment>
            <div className="card">
              <h2>{detail.feeder.feeder}</h2>
              <p className="muted" style={{ marginTop: 0 }}>
                {detail.feeder.disco || 'No Disco'} · Band {detail.feeder.band || '—'} ·{' '}
                {detail.feeder.state || 'No State'} · {detail.feeder.voltageClass || 'No Voltage Level'} ·{' '}
                <span className={'badge ' + detail.feeder.connectivity}>{detail.feeder.connectivity}</span>
              </p>
              <p className="muted">
                All charts below cover {detail.from} to {detail.to}. Resolution adapts to the
                range so wider spans stay readable: {' '}
                {detail.intradayBucket === '15 minutes' ? '15-minute averages (≤3 days)'
                  : detail.intradayBucket === '1 hour' ? 'hourly averages (≤14 days)'
                  : 'daily averages (>14 days)'}.
              </p>
              <h3 className="sub-h">Latest Snapshot</h3>
              <div className="stat-grid">
                <Tile value={num(detail.snapshot.voltageL1) + ' / ' + num(detail.snapshot.voltageL2) + ' / ' + num(detail.snapshot.voltageL3)} label="Voltage L1/L2/L3 (kV)" />
                <Tile value={num(detail.snapshot.currentL1) + ' / ' + num(detail.snapshot.currentL2) + ' / ' + num(detail.snapshot.currentL3)} label="Current L1/L2/L3 (A)" />
                <Tile value={num(detail.snapshot.frequency, 2)} label="Frequency (Hz)" />
                <Tile value={num(detail.snapshot.powerFactor, 3)} label="Power Factor" />
                <Tile value={num(detail.snapshot.activePower) + ' kW'} label="Active Power" />
                <Tile value={num(detail.snapshot.reactivePower) + ' kW'} label="Reactive Power" />
                <Tile value={num(detail.snapshot.apparentPower) + ' kW'} label="Apparent Power" />
              </div>
            </div>

            <div className="card">
              <h2>Voltage ({detail.from} to {detail.to})</h2>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={detail.intraday.map((r) => ({ ...r, label: intradayLabel(r.t, detail.intradayBucket) }))}
                  margin={{ top: 10, right: 16, left: 8, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} minTickGap={30} />
                  <YAxis unit=" kV" width={72} />
                  <Tooltip /><Legend />
                  <Line isAnimationActive={false} dataKey="v1" name="V L1" stroke="#d64545" dot={false} />
                  <Line isAnimationActive={false} dataKey="v2" name="V L2" stroke="#e8a80c" dot={false} />
                  <Line isAnimationActive={false} dataKey="v3" name="V L3" stroke="#1653a1" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="card">
              <h2>Current ({detail.from} to {detail.to})</h2>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={detail.intraday.map((r) => ({ ...r, label: intradayLabel(r.t, detail.intradayBucket) }))}
                  margin={{ top: 10, right: 16, left: 8, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} minTickGap={30} />
                  <YAxis unit=" A" width={68} />
                  <Tooltip /><Legend />
                  <Line isAnimationActive={false} dataKey="i1" name="I L1" stroke="#d64545" dot={false} />
                  <Line isAnimationActive={false} dataKey="i2" name="I L2" stroke="#e8a80c" dot={false} />
                  <Line isAnimationActive={false} dataKey="i3" name="I L3" stroke="#1653a1" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="card">
              <h2>Active, Reactive &amp; Apparent Power ({detail.from} to {detail.to})</h2>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={detail.intraday.map((r) => ({ ...r, label: intradayLabel(r.t, detail.intradayBucket) }))}
                  margin={{ top: 10, right: 16, left: 8, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} minTickGap={30} />
                  <YAxis unit=" kW" width={78} />
                  <Tooltip /><Legend />
                  <Line isAnimationActive={false} dataKey="p" name="Active" stroke="#2f9e44" strokeWidth={2} dot={false} />
                  <Line isAnimationActive={false} dataKey="q" name="Reactive" stroke="#e8a80c" dot={false} />
                  <Line isAnimationActive={false} dataKey="s" name="Apparent" stroke="#6d5bd0" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="card">
              <h2>Frequency &amp; Power Factor ({detail.from} to {detail.to})</h2>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={detail.intraday.map((r) => ({ ...r, label: intradayLabel(r.t, detail.intradayBucket) }))}
                  margin={{ top: 10, right: 16, left: 8, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} minTickGap={30} />
                  <YAxis yAxisId="hz" domain={[45, 55]} unit=" Hz" width={62} />
                  <YAxis yAxisId="pf" orientation="right" domain={[0, 1]} width={50} />
                  <Tooltip /><Legend />
                  <Line isAnimationActive={false} yAxisId="hz" dataKey="freq" name="Frequency" stroke="#1653a1" dot={false} />
                  <Line isAnimationActive={false} yAxisId="pf" dataKey="pf" name="Power Factor" stroke="#e8452c" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="card">
              <h2>Load Flow ({detail.from} to {detail.to})</h2>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={detail.trend.map((r) => ({ ...r, label: shortDay(r.day) }))}
                  margin={{ top: 10, right: 16, left: 8, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis unit=" kW" width={78} />
                  <Tooltip /><Legend />
                  <Line isAnimationActive={false} dataKey="avgLoadKW" name="Avg Load" stroke="#1653a1" dot />
                  <Line isAnimationActive={false} dataKey="peakLoadKW" name="Peak Load" stroke="#d64545" dot />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="card">
              <h2>Energy ({detail.from} to {detail.to})</h2>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={detail.trend.map((r) => ({ ...r, label: shortDay(r.day) }))}
                  margin={{ top: 10, right: 16, left: 8, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis unit=" kWh" width={82} />
                  <Tooltip />
                  <Line isAnimationActive={false} dataKey="energyKwh" name="Energy" stroke="#2f9e44" strokeWidth={2} dot />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </React.Fragment>
        )}
      </div>
    );
  }
}

export default Reporting;
