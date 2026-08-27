import React from 'react';
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis,
  Tooltip, CartesianGrid, Legend, Cell,
} from 'recharts';
import api from '../api';

function hms(totalSeconds) {
  const s = Math.max(0, Math.round(+totalSeconds || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h}h ${m}m ${s % 60}s`;
}
function today() { return new Date().toISOString().slice(0, 10); }
function daysAgo(n) { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); }
const darColor = (pct) => (pct >= 95 ? '#2f9e44' : pct >= 80 ? '#e8a80c' : '#d64545');

function DarBar({ pct }) {
  const cls = pct >= 95 ? '' : pct >= 80 ? 'warn' : 'bad';
  return <span className="dar-bar"><div className={cls} style={{ width: Math.min(100, pct) + '%' }} /></span>;
}

// Everything about one selected feeder: data, DAR, charts, uptime, gaps,
// details (with admin disable/enable/delete), CSV download.
class MeterExplorer extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      meterId: '', view: 'charts', disco: 'all',
      date: today(), from: daysAgo(6), to: today(),
      page: 1, limit: 100, order: 'asc',
      result: null, busy: false, error: null, notice: null,
    };
    this.load = this.load.bind(this);
    this.handleToggleStatus = this.handleToggleStatus.bind(this);
    this.handleDelete = this.handleDelete.bind(this);
  }

  componentDidMount() {
    if (this.props.meters.length > 0) this.setState({ meterId: this.props.meters[0].meter_id });
  }

  componentDidUpdate(prevProps) {
    if (prevProps.meters !== this.props.meters && !this.state.meterId && this.props.meters.length > 0) {
      this.setState({ meterId: this.props.meters[0].meter_id });
    }
  }

  set(patch, reload) { this.setState(patch, reload ? this.load : undefined); }

  load() {
    const { meterId, view, date, from, to, page, limit, order } = this.state;
    if (!meterId) return;
    this.setState({ busy: true, error: null, notice: null });
    let p;
    if (view === 'data') p = api.readings(meterId, date, page, limit, order);
    else if (view === 'dar') p = api.darRange(meterId, from, to);
    else if (view === 'charts') {
      // Snapshot views (intraday DAR, electrical series) use the END of the
      // From/To range as their date, so there's one clear date range for
      // this view instead of a redundant separate "today" field (NERC
      // review II, item viii).
      p = Promise.all([
        api.darRange(meterId, from, to),
        api.darIntraday(meterId, to),
        api.series(meterId, to),
      ]).then(([trend, intraday, series]) => ({ trend, intraday, series }));
    } else if (view === 'uptime') p = api.uptime(meterId, date);
    else if (view === 'gaps') p = api.gaps(meterId, date);
    else if (view === 'details') p = api.meterDetails(meterId);
    else return;
    p.then((result) => this.setState({ result, busy: false }))
      .catch((e) => this.setState({ error: e.message, busy: false, result: null }));
  }

  // ---- admin actions -------------------------------------------------------
  handleToggleStatus() {
    const r = this.state.result;
    const next = r.status === 'inactive' ? 'active' : 'inactive';
    const verb = next === 'inactive' ? 'temporarily disable' : 're-enable';
    if (!window.confirm(`Are you sure you want to ${verb} ${r.meter_id}?`)) return;
    api.setMeterStatus(r.meter_id, next)
      .then(() => { this.setState({ notice: `${r.meter_id} is now ${next}.` }); this.load(); this.props.onMetersChanged(); })
      .catch((e) => this.setState({ error: e.message }));
  }

  handleDelete() {
    const r = this.state.result;
    const purge = window.confirm(
      `Delete feeder ${r.meter_id}?\n\nOK  = decommission (hide it, KEEP all historical data)\nCancel = abort`);
    if (!purge) return;
    let hard = false;
    if (window.confirm('Also PERMANENTLY erase all its readings and events?\n\nOK = erase everything\nCancel = keep history (decommission only)')) {
      hard = true;
      const typed = window.prompt(`This cannot be undone. Type the meter id (${r.meter_id}) to confirm:`);
      if (typed !== r.meter_id) { this.setState({ notice: 'Deletion aborted.' }); return; }
    }
    api.deleteMeter(r.meter_id, hard)
      .then((res) => {
        this.setState({
          notice: hard
            ? `${r.meter_id} purged (${res.readingsDeleted} readings erased).`
            : `${r.meter_id} decommissioned - history retained.`,
          result: null, meterId: '',
        });
        this.props.onMetersChanged();
      })
      .catch((e) => this.setState({ error: e.message }));
  }

  // ---- renderers -----------------------------------------------------------
  renderControls() {
    const s = this.state;
    const discos = Array.from(new Set(this.props.meters.map((m) => m.disco).filter(Boolean))).sort();
    const meters = this.props.meters.filter((m) => s.disco === 'all' || m.disco === s.disco);
    const needsDate = ['data', 'uptime', 'gaps'].includes(s.view);
    const needsRange = ['dar', 'download', 'charts'].includes(s.view);
    return (
      <div className="controls">
        <label>Disco
          <select value={s.disco}
            onChange={(e) => {
              const d = e.target.value;
              const list = this.props.meters.filter((m) => d === 'all' || m.disco === d);
              this.setState({ disco: d, result: null,
                meterId: list.length > 0 ? list[0].meter_id : '' });
            }}>
            <option value="all">All Discos</option>
            {discos.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </label>
        <label>Feeder
          <select value={s.meterId}
            onChange={(e) => this.set({ meterId: e.target.value, page: 1, result: null })}>
            {meters.map((m) => (
              <option key={m.meter_id} value={m.meter_id}>
                {(m.feeder_name || m.meter_id) + ' (' + m.meter_id + ')' + (m.status === 'inactive' ? ' [disabled]' : '')}
              </option>
            ))}
          </select>
        </label>
        <label>View
          <select value={s.view}
            onChange={(e) => this.set({ view: e.target.value, page: 1, result: null })}>
            <option value="charts">Charts (DAR trend + electrical)</option>
            <option value="data">Meter Data (paginated)</option>
            <option value="dar">D.A.R table (range of days)</option>
            <option value="uptime">Uptime / Downtime</option>
            <option value="gaps">Data Gaps</option>
            <option value="details">Feeder Details / Manage</option>
            <option value="download">Download CSV</option>
          </select>
        </label>
        {needsDate && (
          <label>Date
            <input type="date" value={s.date} onChange={(e) => this.set({ date: e.target.value, page: 1 })} />
          </label>
        )}
        {needsRange && (
          <React.Fragment>
            <label>From
              <input type="date" value={s.from} onChange={(e) => this.set({ from: e.target.value })} />
            </label>
            <label>To{s.view === 'charts' ? ' (also the snapshot date)' : ''}
              <input type="date" value={s.to} onChange={(e) => this.set({ to: e.target.value })} />
            </label>
          </React.Fragment>
        )}
        {s.view === 'data' && (
          <label>Order
            <select value={s.order} onChange={(e) => this.set({ order: e.target.value })}>
              <option value="asc">Oldest first</option>
              <option value="desc">Newest first</option>
            </select>
          </label>
        )}
        {s.view !== 'download' ? (
          <button className="btn" onClick={this.load} disabled={s.busy || !s.meterId}>
            {s.busy ? 'Loading…' : 'Load'}
          </button>
        ) : (
          <a className="btn" style={{ textDecoration: 'none' }}
            href={api.downloadUrl(s.meterId, s.from, s.to)} download>Download CSV</a>
        )}
      </div>
    );
  }

  renderCharts() {
    const r = this.state.result;
    if (!r) return null;
    const trendData = r.trend.days.map((d) => ({
      day: String(d.day).slice(5, 10), dar: +d.dar_pct, buffered: +d.buffered_count,
    }));
    const intradayData = r.intraday.buckets.map((b) => ({
      t: new Date(b.bucket).toTimeString().slice(0, 5), dar: +b.dar_pct,
    }));
    const seriesData = r.series.points.map((p) => ({
      t: new Date(p.bucket).toTimeString().slice(0, 5),
      v1: +p.v1, v2: +p.v2, v3: +p.v3,
      i1: +p.i1, i2: +p.i2, i3: +p.i3,
      p: +p.p, freq: +p.freq,
    }));
    return (
      <React.Fragment>
        <div className="card">
          <h2>D.A.R Trend ({r.trend.from} → {r.trend.to}) — avg {r.trend.averageDarPct}%</h2>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" /><YAxis domain={[0, 100]} unit="%" />
              <Tooltip /><Legend />
              <Line isAnimationActive={false} type="monotone" dataKey="dar" name="D.A.R %" stroke="#0b6ba8" strokeWidth={2} dot />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h2>Intra-day D.A.R — {r.intraday.date} (15-min buckets)</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={intradayData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="t" tick={{ fontSize: 10 }} /><YAxis domain={[0, 100]} unit="%" />
              <Tooltip formatter={(v) => v + '%'} />
              <Bar isAnimationActive={false} dataKey="dar" name="D.A.R %">
                {intradayData.map((d, i) => <Cell key={i} fill={darColor(d.dar)} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h2>Voltage (V) — {r.series.date}</h2>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={seriesData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="t" tick={{ fontSize: 10 }} /><YAxis domain={['auto', 'auto']} />
              <Tooltip /><Legend />
              <Line isAnimationActive={false} dataKey="v1" name="L1" stroke="#d64545" dot={false} />
              <Line isAnimationActive={false} dataKey="v2" name="L2" stroke="#e8a80c" dot={false} />
              <Line isAnimationActive={false} dataKey="v3" name="L3" stroke="#0b6ba8" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h2>Current (A) &amp; Active Power ({r.series.powerUnit || 'kW'})</h2>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={seriesData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="t" tick={{ fontSize: 10 }} />
              <YAxis yAxisId="i" /><YAxis yAxisId="p" orientation="right" />
              <Tooltip /><Legend />
              <Line isAnimationActive={false} yAxisId="i" dataKey="i1" name="I L1 (A)" stroke="#d64545" dot={false} />
              <Line isAnimationActive={false} yAxisId="i" dataKey="i2" name="I L2 (A)" stroke="#e8a80c" dot={false} />
              <Line isAnimationActive={false} yAxisId="i" dataKey="i3" name="I L3 (A)" stroke="#0b6ba8" dot={false} />
              <Line isAnimationActive={false} yAxisId="p" dataKey="p" name={`Active Power (${r.series.powerUnit || 'kW'})`} stroke="#2f9e44" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </React.Fragment>
    );
  }

  renderData() {
    const r = this.state.result;
    if (!r) return null;
    const cols = ['meter_ts', 'voltage_l1', 'voltage_l2', 'voltage_l3',
      'current_l1', 'current_l2', 'current_l3', 'frequency', 'power_factor',
      'active_power', 'reactive_power', 'apparent_power', 'active_energy', 'status', 'latency_s'];
    return (
      <React.Fragment>
        <p className="muted">{r.totalRows} readings on {r.date} — page {r.page} of {r.totalPages}</p>
        <div className="table-wrap">
          <table className="data">
            <thead><tr>{cols.map((c) => <th key={c}>{c}</th>)}</tr></thead>
            <tbody>
              {r.rows.map((row, i) => (
                <tr key={i}>
                  {cols.map((c) => (
                    <td key={c}>
                      {c === 'meter_ts' ? new Date(row[c]).toLocaleTimeString()
                        : row[c] == null ? '—' : String(row[c])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="pager">
          <button className="btn secondary" disabled={r.page <= 1}
            onClick={() => this.set({ page: r.page - 1 }, true)}>Prev</button>
          <span>Page {r.page} / {r.totalPages}</span>
          <button className="btn secondary" disabled={r.page >= r.totalPages}
            onClick={() => this.set({ page: r.page + 1 }, true)}>Next</button>
          <label className="muted">Rows:
            <select value={this.state.limit}
              onChange={(e) => this.set({ limit: +e.target.value, page: 1 }, true)}>
              {[50, 100, 250, 500, 1000].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
        </div>
      </React.Fragment>
    );
  }

  renderDar() {
    const r = this.state.result;
    if (!r) return null;
    return (
      <React.Fragment>
        <div className="stat-grid" style={{ marginBottom: 14 }}>
          <div className="stat"><div className="v">{r.averageDarPct}%</div><div className="l">Average D.A.R ({r.from} → {r.to})</div></div>
          <div className="stat"><div className="v">{r.days.length}</div><div className="l">Days with data</div></div>
        </div>
        <table className="data">
          <thead>
            <tr><th>Day</th><th>Received</th><th>Expected</th><th>D.A.R %</th><th></th>
              <th>Buffered (late)</th><th>Avg Latency (s)</th></tr>
          </thead>
          <tbody>
            {r.days.map((d) => (
              <tr key={d.day}>
                <td>{String(d.day).slice(0, 10)}</td>
                <td>{d.received_count}</td><td>{d.expected_count}</td>
                <td>{d.dar_pct}%</td><td><DarBar pct={+d.dar_pct} /></td>
                <td>{d.buffered_count}</td><td>{d.avg_latency_s}</td>
              </tr>
            ))}
            {r.days.length === 0 && <tr><td colSpan="7" className="muted">No data in this range.</td></tr>}
          </tbody>
        </table>
      </React.Fragment>
    );
  }

  renderUptime() {
    const r = this.state.result;
    if (!r) return null;
    return (
      <React.Fragment>
        <div className="stat-grid">
          <div className="stat"><div className="v">{hms(r.inServiceS)}</div><div className="l">IN SERVICE (voltage + current)</div></div>
          <div className="stat"><div className="v">{hms(r.outOfServiceS)}</div><div className="l">OUT OF SERVICE (voltage, no current)</div></div>
          <div className="stat"><div className="v">{hms(r.noSupplyS)}</div><div className="l">NO SUPPLY (no voltage)</div></div>
          <div className="stat"><div className="v">{hms(r.unaccountedS)}</div><div className="l">UNACCOUNTED (data gaps)</div></div>
          <div className="stat"><div className="v">{r.darPct}%</div><div className="l">D.A.R for {r.date}</div></div>
        </div>
        <p className="muted" style={{ marginTop: 12 }}>
          {r.samples} samples @ {r.expectedIntervalS}s. Thresholds: voltage &gt; {r.thresholds.voltage} V,
          current &gt; {r.thresholds.current} A.
        </p>
      </React.Fragment>
    );
  }

  renderGaps() {
    const r = this.state.result;
    if (!r) return null;
    return (
      <React.Fragment>
        <div className="stat-grid" style={{ marginBottom: 14 }}>
          <div className="stat"><div className="v">{r.gapCount}</div><div className="l">Gaps on {r.date}</div></div>
          <div className="stat"><div className="v">{hms(r.totalGapS)}</div><div className="l">Total time with no data</div></div>
        </div>
        <table className="data">
          <thead><tr><th>#</th><th>From</th><th>To</th><th>Duration</th></tr></thead>
          <tbody>
            {r.gaps.map((g, i) => (
              <tr key={i}>
                <td>{i + 1}</td>
                <td>{new Date(g.gap_start).toLocaleString()}</td>
                <td>{new Date(g.gap_end).toLocaleString()}</td>
                <td>{hms(g.duration_s)}</td>
              </tr>
            ))}
            {r.gaps.length === 0 && (
              <tr><td colSpan="4" className="muted">No gaps — 100% acquisition for this day.</td></tr>
            )}
          </tbody>
        </table>
      </React.Fragment>
    );
  }

  renderDetails() {
    const r = this.state.result;
    if (!r) return null;
    const rows = [
      ['Meter ID', r.meter_id], ['Feeder Name', r.feeder_name], ['Disco', r.disco],
      ['Tariff Band', r.tariff_band],
      ['Controller', r.controller_id], ['Location', r.location],
      ['Status', r.status], ['Expected Interval', r.expected_interval_s + ' s'],
      ['Onboarded By', r.onboarded_by],
      ['Onboarded At', r.onboarded_at && new Date(r.onboarded_at).toLocaleString()],
      ['Cert Serial', r.cert_serial],
      ['Cert Expires', r.cert_expires_at && new Date(r.cert_expires_at).toLocaleString()],
      ['Connectivity', r.live && r.live.connectivity],
      ['Last Reading', r.live && r.live.last_reading_at && new Date(r.live.last_reading_at).toLocaleString()],
      ['Readings (24h)', r.last24h && r.last24h.readings_24h],
      ['Avg Latency (24h)', r.last24h && r.last24h.avg_latency_s != null ? r.last24h.avg_latency_s + ' s' : null],
      ['Metadata', JSON.stringify(r.metadata)],
    ];
    return (
      <React.Fragment>
        <table className="data">
          <tbody>
            {rows.map(([k, v]) => (
              <tr key={k}>
                <td style={{ textAlign: 'left', fontWeight: 600, width: 220 }}>{k}</td>
                <td style={{ textAlign: 'left' }}>{v == null || v === '' ? '—' : String(v)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {this.props.isAdmin && (
          <div className="controls" style={{ marginTop: 16 }}>
            <button className="btn secondary" onClick={this.handleToggleStatus}>
              {r.status === 'inactive' ? 'Re-enable Meter' : 'Disable Temporarily'}
            </button>
            <button className="btn" style={{ background: '#b02a37' }} onClick={this.handleDelete}>
              Delete Feeder…
            </button>
          </div>
        )}
      </React.Fragment>
    );
  }

  render() {
    const { view, error, notice, meterId } = this.state;
    return (
      <div>
        <div className="card">
          <h2>Feeder Explorer</h2>
          {this.props.meters.length === 0 && (
            <p className="muted">No meters onboarded yet — use the Onboard Meter tab,
              or start a device streaming and it will appear automatically.</p>
          )}
          {this.renderControls()}
          {error && <div className="error">{error}</div>}
          {notice && <div className="card" style={{ background: '#eef8f0' }}>{notice}</div>}
          {meterId && view === 'data' && this.renderData()}
          {meterId && view === 'dar' && this.renderDar()}
          {meterId && view === 'uptime' && this.renderUptime()}
          {meterId && view === 'gaps' && this.renderGaps()}
          {meterId && view === 'details' && this.renderDetails()}
          {view === 'download' && (
            <p className="muted">Choose the date range above and click Download CSV.</p>
          )}
        </div>
        {meterId && view === 'charts' && this.state.result && this.renderCharts()}
      </div>
    );
  }
}

export default MeterExplorer;
