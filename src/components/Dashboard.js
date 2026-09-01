import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell, LabelList,
  ResponsiveContainer, PieChart, Pie, Legend,
} from 'recharts';
import api from '../api';
import GuidedTour, { TourRestartButton } from './GuidedTour';
import { dashboardTour } from '../tours';

const darColor = (pct) => (pct >= 95 ? '#2f9e44' : pct >= 80 ? '#e8a80c' : '#d64545');
const pfColor = (pf) => (pf >= 0.95 ? '#2f9e44' : pf >= 0.85 ? '#e8a80c' : '#d64545');
const imbalanceColor = (pct) => (pct < 10 ? '#2f9e44' : pct < 25 ? '#e8a80c' : '#d64545');
const n1 = (v, dp = 1) => (v == null ? '—' : Number(v).toFixed(dp));
const PAGE_SIZES = [25, 50, 100, 250];

// Landing page: fleet stats, per-Band grouped analysis, live power/frequency
// summary table (NERC item 3), a paginated D.A.R chart that stays compact
// even with thousands of feeders (page + limit instead of one giant
// scrolling chart — NERC item 5), and a connectivity donut.
class Dashboard extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      data: null, error: null, disco: 'all', band: 'all', discos: [],
      page: 1, limit: 50, groupByBand: false, zoom: 60,
      pq: null, pqError: null,
    };
    this.load = this.load.bind(this);
    this.loadPq = this.loadPq.bind(this);
    this.tourRef = React.createRef();
  }

  componentDidMount() {
    api.listDiscos().then((discos) => this.setState({ discos })).catch(() => {});
    this.load();
    this.loadPq();
    this.timer = setInterval(() => { if (!document.hidden) { this.load(); this.loadPq(); } }, 30000);
  }
  componentWillUnmount() { clearInterval(this.timer); }

  load() {
    const { disco, band, page, limit } = this.state;
    api.overview(disco, band, page, limit)
      .then((data) => this.setState({ data, error: null }))
      .catch((e) => this.setState({ error: e.message }));
  }

  loadPq() {
    const { disco, band } = this.state;
    api.powerQuality(disco, band)
      .then((pq) => this.setState({ pq, pqError: null }))
      .catch((e) => this.setState({ pqError: e.message }));
  }

  setFilter(patch) {
    // Any filter change resets to page 1 — a stale page number on a
    // narrower/wider result set would otherwise show the wrong slice.
    this.setState({ ...patch, page: 1 }, () => { this.load(); this.loadPq(); });
  }

  render() {
    const { data, error, disco, band, discos, page, limit, groupByBand, zoom } = this.state;
    if (error) return <div className="error">{error}</div>;
    if (!data) return <div className="card">Loading dashboard…</div>;
    const t = data.totals;
    const totalPages = data.totalPages || 1;

    // Compact SCADA-style bars: width per bar is a user-controlled zoom
    // level (px), not squeezed to fit the card — the chart scrolls
    // sideways instead, and labels get more room to breathe as you zoom in.
    const chartData = data.feeders.map((f) => ({
      name: f.feeder_name || f.meter_id, dar: +f.dar_today, band: f.tariff_band || '—',
    }));
    const chartWidth = Math.max(chartData.length * zoom, 700);

    const bandChartData = (data.bandSummary || []).map((b) => ({
      name: 'Band ' + b.band, dar: b.avgDarToday, feeders: b.feeders,
    }));

    const pieData = [
      { name: 'Online', value: t.online, fill: '#2f9e44' },
      { name: 'Offline', value: t.offline, fill: '#d64545' },
      { name: 'Never reported', value: t.never_reported, fill: '#9aa5b1' },
    ].filter((d) => d.value > 0);

    return (
      <React.Fragment>
        <GuidedTour ref={this.tourRef} tourId="dashboard" steps={dashboardTour} autoStart />
        <div className="card">
          <h2>Fleet Overview
            {disco !== 'all' && <span className="muted"> — {disco}</span>}
            {band !== 'all' && <span className="muted"> · Band {band}</span>}
            <TourRestartButton onClick={() => this.tourRef.current.start()} label="" />
          </h2>
          <div className="controls" data-tour="dash-filters">
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
                {['A', 'B', 'C', 'D', 'E'].map((b) => <option key={b} value={b}>Band {b}</option>)}
              </select>
            </label>
          </div>
          <div className="stat-grid" data-tour="dash-tiles">
            <div className="stat"><div className="v">{t.feeders}</div><div className="l">Feeders onboarded</div></div>
            <div className="stat"><div className="v" style={{ color: '#2f9e44' }}>{t.online}</div><div className="l">Online now</div></div>
            <div className="stat"><div className="v" style={{ color: '#d64545' }}>{t.offline}</div><div className="l">Offline</div></div>
            <div className="stat"><div className="v">{t.fleetAvgDarToday}%</div><div className="l">Fleet avg D.A.R (today)</div></div>
          </div>
        </div>

        <div className="card">
          <div className="controls" style={{ marginBottom: groupByBand ? 8 : 0 }}>
            <h2 style={{ margin: 0 }}>Analysis by Band</h2>
            <button className={'btn ' + (groupByBand ? '' : 'secondary')} style={{ marginLeft: 'auto' }}
              data-tour="dash-band-toggle"
              onClick={() => this.setState({ groupByBand: !groupByBand })}>
              {groupByBand ? 'Grouped by Band' : 'Group by Band'}
            </button>
          </div>
          {groupByBand && (
            <React.Fragment>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={bandChartData} margin={{ top: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis domain={[0, 100]} unit="%" />
                  <Tooltip formatter={(v, n) => (n === 'dar' ? v + '%' : v)} />
                  <Bar isAnimationActive={false} dataKey="dar" name="Avg D.A.R %">
                    <LabelList dataKey="dar" position="top"
                      formatter={(v) => v + '%'} style={{ fontSize: 11, fontWeight: 700, fill: '#223344' }} />
                    {bandChartData.map((d, i) => <Cell key={i} fill={darColor(d.dar)} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="table-wrap">
                <table className="data compact">
                  <thead>
                    <tr><th>Band</th><th>Feeders</th><th>Online</th><th>Offline</th><th>Avg D.A.R (today)</th></tr>
                  </thead>
                  <tbody>
                    {(data.bandSummary || []).map((b) => (
                      <tr key={b.band}>
                        <td>{b.band}</td><td>{b.feeders}</td><td>{b.online}</td><td>{b.offline}</td>
                        <td style={{ color: darColor(b.avgDarToday), fontWeight: 700 }}>{b.avgDarToday}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </React.Fragment>
          )}
        </div>

        <div className="card" data-tour="dash-live-power">
          <h2>Live Power, Reactive Power &amp; Frequency</h2>
          <div className="table-wrap" style={{ maxHeight: 320 }}>
            <table className="data compact">
              <thead>
                <tr><th>Feeder</th><th>Disco</th><th>Band</th><th>Active Power</th>
                  <th>Reactive Power</th><th>Power Factor (ratio)</th><th>Frequency (Hz)</th>
                  <th>D.A.R Today</th></tr>
              </thead>
              <tbody>
                {data.feeders.map((f) => (
                  <tr key={f.meter_id}>
                    <td>{f.feeder_name || f.meter_id}</td>
                    <td>{f.disco || '—'}</td>
                    <td>{f.tariff_band || '—'}</td>
                    <td>{n1(f.active_power)} {f.power_unit || ''}</td>
                    <td>{n1(f.reactive_power)} {f.power_unit || ''}</td>
                    <td>{n1(f.power_factor, 3)}</td>
                    <td>{n1(f.frequency, 2)}</td>
                    <td style={{ color: darColor(+f.dar_today), fontWeight: 700 }}>{f.dar_today}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <h2>Today's D.A.R by Feeder</h2>
          <div className="controls" data-tour="dash-dar-controls">
            <span className="muted">
              Showing {chartData.length ? (page - 1) * limit + 1 : 0}–{(page - 1) * limit + chartData.length} of {data.total}
            </span>
            <label style={{ marginLeft: 'auto' }}>Per page
              <select value={limit} onChange={(e) => this.setFilter({ limit: +e.target.value })}>
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
            <label>Zoom
              <button className="btn secondary" style={{ padding: '2px 10px' }}
                onClick={() => this.setState({ zoom: Math.max(30, zoom - 15) })}>−</button>
              <input type="range" min="30" max="180" step="5" value={zoom}
                style={{ verticalAlign: 'middle', margin: '0 8px' }}
                onChange={(e) => this.setState({ zoom: +e.target.value })} />
              <button className="btn secondary" style={{ padding: '2px 10px' }}
                onClick={() => this.setState({ zoom: Math.min(180, zoom + 15) })}>+</button>
            </label>
            <span className="muted">{zoom}px per bar</span>
            <button className="btn secondary" style={{ marginLeft: 'auto' }}
              onClick={() => this.setState({ zoom: 60 })}>Reset zoom</button>
          </div>
          <div className="chart-scroll">
            <BarChart width={chartWidth} height={300} data={chartData}
              margin={{ bottom: 70, top: 24 }}
              barCategoryGap={Math.max(4, Math.round(zoom * 0.15))}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-40} textAnchor="end" interval={0}
                height={80} tick={{ fontSize: Math.min(12, Math.max(9, Math.round(zoom / 7))) }} />
              <YAxis domain={[0, 100]} unit="%" />
              <Tooltip formatter={(v) => [v + '%', 'D.A.R']}
                labelFormatter={(l, p) => (p && p[0] ? `${l} (Band ${p[0].payload.band})` : l)} />
              <Bar isAnimationActive={false} dataKey="dar" name="D.A.R %"
                barSize={Math.max(14, zoom - 14)}>
                <LabelList dataKey="dar" position="top"
                  formatter={(v) => v + '%'}
                  style={{ fontSize: Math.min(12, Math.max(9, Math.round(zoom / 7))), fontWeight: 700, fill: '#223344' }} />
                {chartData.map((d, i) => <Cell key={i} fill={darColor(d.dar)} />)}
              </Bar>
            </BarChart>
          </div>
          <p className="muted">Green ≥ 95% · Amber 80–95% · Red &lt; 80% — use the zoom slider to
            widen bars, then scroll sideways within the page.</p>
        </div>

        <div className="card">
          <h2>Connectivity</h2>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie isAnimationActive={false} data={pieData} dataKey="value" nameKey="name"
                innerRadius={55} outerRadius={85} label />
              <Legend />
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {this.renderPowerQuality()}
      </React.Fragment>
    );
  }

  renderPowerQuality() {
    const { pq, pqError } = this.state;
    if (pqError) return <div className="card" data-tour="dash-pq"><div className="error">{pqError}</div></div>;
    if (!pq) return <div className="card" data-tour="dash-pq">Loading power quality analytics…</div>;

    const pfChartData = pq.pf.buckets.map((b) => ({ name: b.range, count: b.count }));
    const bucketColors = ['#d64545', '#e8a80c', '#8fc93a', '#2f9e44'];

    return (
      <div className="card" data-tour="dash-pq">
        <h2>Power Quality Analytics <span className="live-dot" title="Live, refreshes every 30s"></span></h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Computed live from each online feeder's latest reading ({pq.feedersAnalyzed} feeders
          analyzed). Distinct from connectivity or DAR — a feeder can be perfectly "online" and
          still be running an inefficient or unbalanced load.
        </p>
        <div className="stat-grid">
          <div className="stat">
            <div className="v" style={{ color: pq.pf.avgPf != null ? pfColor(pq.pf.avgPf) : undefined }}>
              {pq.pf.avgPf != null ? pq.pf.avgPf : '—'}
            </div>
            <div className="l">Fleet avg power factor</div>
          </div>
          <div className="stat">
            <div className="v" style={{ color: '#d64545' }}>{pq.pf.poor.length}</div>
            <div className="l">Feeders with poor PF (&lt; {pq.pfThreshold})</div>
          </div>
          <div className="stat">
            <div className="v" style={{ color: pq.imbalance.avgImbalancePct != null ? imbalanceColor(pq.imbalance.avgImbalancePct) : undefined }}>
              {pq.imbalance.avgImbalancePct != null ? pq.imbalance.avgImbalancePct + '%' : '—'}
            </div>
            <div className="l">Fleet avg phase imbalance</div>
          </div>
          <div className="stat">
            <div className="v" style={{ color: '#d64545' }}>{pq.imbalance.worst.length}</div>
            <div className="l">Feeders unbalanced (≥ {pq.imbalanceThreshold}%)</div>
          </div>
        </div>

        <h3 style={{ marginTop: 20 }}>Power Factor Distribution (live)</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={pfChartData} margin={{ top: 20 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Bar isAnimationActive={false} dataKey="count" name="Feeders">
              <LabelList dataKey="count" position="top" style={{ fontSize: 11, fontWeight: 700, fill: '#223344' }} />
              {pfChartData.map((_, i) => <Cell key={i} fill={bucketColors[i] || '#1653a1'} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        <div className="controls" style={{ marginTop: 16 }}>
          <h3 style={{ margin: 0 }}>Worst Power Factor</h3>
        </div>
        <div className="table-wrap">
          <table className="data compact">
            <thead>
              <tr><th>Feeder</th><th>Disco</th><th>Band</th><th>Power Factor</th></tr>
            </thead>
            <tbody>
              {pq.pf.poor.map((f) => (
                <tr key={f.meterId}>
                  <td>{f.feeder}</td><td>{f.disco || '—'}</td><td>{f.band || '—'}</td>
                  <td style={{ color: pfColor(f.powerFactor), fontWeight: 700 }}>{f.powerFactor}</td>
                </tr>
              ))}
              {pq.pf.poor.length === 0 &&
                <tr><td colSpan="4" className="muted">No feeders below the poor-PF threshold right now.</td></tr>}
            </tbody>
          </table>
        </div>

        <h3 style={{ marginTop: 20 }}>Worst Phase Current Imbalance</h3>
        <div className="table-wrap">
          <table className="data compact">
            <thead>
              <tr><th>Feeder</th><th>Disco</th><th>Band</th><th>I L1 (A)</th><th>I L2 (A)</th><th>I L3 (A)</th><th>Imbalance</th></tr>
            </thead>
            <tbody>
              {pq.imbalance.worst.map((f) => (
                <tr key={f.meterId}>
                  <td>{f.feeder}</td><td>{f.disco || '—'}</td><td>{f.band || '—'}</td>
                  <td>{f.current_l1.toFixed(1)}</td><td>{f.current_l2.toFixed(1)}</td><td>{f.current_l3.toFixed(1)}</td>
                  <td style={{ color: imbalanceColor(f.imbalancePct), fontWeight: 700 }}>{f.imbalancePct}%</td>
                </tr>
              ))}
              {pq.imbalance.worst.length === 0 &&
                <tr><td colSpan="7" className="muted">No feeders above the imbalance threshold right now.</td></tr>}
            </tbody>
          </table>
        </div>
        <p className="muted">Phase imbalance is the most-loaded phase's deviation from the
          3-phase average, as a percentage. Sustained imbalance above ~10% typically indicates
          an unevenly distributed single-phase load or a wiring/connection fault, and can
          accelerate transformer heating over time. Thresholds are configurable in Settings.</p>
      </div>
    );
  }
}

export default Dashboard;
