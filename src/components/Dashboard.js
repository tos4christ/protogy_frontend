import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell, LabelList,
  ResponsiveContainer, PieChart, Pie, Legend,
} from 'recharts';
import api from '../api';

const darColor = (pct) => (pct >= 95 ? '#2f9e44' : pct >= 80 ? '#e8a80c' : '#d64545');
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
      page: 1, limit: 50, groupByBand: false,
    };
    this.load = this.load.bind(this);
  }

  componentDidMount() {
    api.listDiscos().then((discos) => this.setState({ discos })).catch(() => {});
    this.load();
    this.timer = setInterval(() => { if (!document.hidden) this.load(); }, 60000);
  }
  componentWillUnmount() { clearInterval(this.timer); }

  load() {
    const { disco, band, page, limit } = this.state;
    api.overview(disco, band, page, limit)
      .then((data) => this.setState({ data, error: null }))
      .catch((e) => this.setState({ error: e.message }));
  }

  setFilter(patch) {
    // Any filter change resets to page 1 — a stale page number on a
    // narrower/wider result set would otherwise show the wrong slice.
    this.setState({ ...patch, page: 1 }, this.load);
  }

  render() {
    const { data, error, disco, band, discos, page, limit, groupByBand } = this.state;
    if (error) return <div className="error">{error}</div>;
    if (!data) return <div className="card">Loading dashboard…</div>;
    const t = data.totals;
    const totalPages = data.totalPages || 1;

    // Compact SCADA-style bars: fixed, narrow width per bar; the page (not
    // the whole fleet) determines chart width, so it never has to squeeze
    // or scroll through thousands of bars at once.
    const chartData = data.feeders.map((f) => ({
      name: f.feeder_name || f.meter_id, dar: +f.dar_today, band: f.tariff_band || '—',
    }));
    const BAR_W = 34;
    const chartWidth = Math.max(chartData.length * BAR_W, 700);

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
        <div className="card">
          <h2>Fleet Overview
            {disco !== 'all' && <span className="muted"> — {disco}</span>}
            {band !== 'all' && <span className="muted"> · Band {band}</span>}
          </h2>
          <div className="controls">
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
          <div className="stat-grid">
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

        <div className="card">
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
          <div className="controls">
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
          <div className="chart-scroll">
            <BarChart width={chartWidth} height={280} data={chartData}
              margin={{ bottom: 60, top: 20 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-40} textAnchor="end" interval={0}
                height={70} tick={{ fontSize: 10 }} />
              <YAxis domain={[0, 100]} unit="%" />
              <Tooltip formatter={(v) => [v + '%', 'D.A.R']}
                labelFormatter={(l, p) => (p && p[0] ? `${l} (Band ${p[0].payload.band})` : l)} />
              <Bar isAnimationActive={false} dataKey="dar" name="D.A.R %">
                <LabelList dataKey="dar" position="top"
                  formatter={(v) => v + '%'} style={{ fontSize: 10, fontWeight: 700, fill: '#223344' }} />
                {chartData.map((d, i) => <Cell key={i} fill={darColor(d.dar)} />)}
              </Bar>
            </BarChart>
          </div>
          <p className="muted">Green ≥ 95% · Amber 80–95% · Red &lt; 80% — paginated so the chart stays
            compact with large feeder counts; scroll sideways within a page if needed.</p>
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
      </React.Fragment>
    );
  }
}

export default Dashboard;
