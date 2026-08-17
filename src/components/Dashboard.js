import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell, LabelList,
  ResponsiveContainer, PieChart, Pie, Legend,
} from 'recharts';
import api from '../api';

const darColor = (pct) => (pct >= 95 ? '#2f9e44' : pct >= 80 ? '#e8a80c' : '#d64545');
const n1 = (v, dp = 1) => (v == null ? '—' : Number(v).toFixed(dp));

// Landing page: fleet stats, live power/frequency summary table (NERC item 3),
// always-labelled scrollable D.A.R chart (NERC item 5), connectivity donut.
class Dashboard extends React.Component {
  constructor(props) {
    super(props);
    this.state = { data: null, error: null, disco: 'all', discos: [] };
    this.load = this.load.bind(this);
  }

  componentDidMount() {
    api.listDiscos().then((discos) => this.setState({ discos })).catch(() => {});
    this.load();
    this.timer = setInterval(() => { if (!document.hidden) this.load(); }, 60000);
  }
  componentWillUnmount() { clearInterval(this.timer); }

  load() {
    api.overview(this.state.disco)
      .then((data) => this.setState({ data, error: null }))
      .catch((e) => this.setState({ error: e.message }));
  }

  render() {
    const { data, error, disco, discos } = this.state;
    if (error) return <div className="error">{error}</div>;
    if (!data) return <div className="card">Loading dashboard…</div>;
    const t = data.totals;
    const chartData = data.feeders.map((f) => ({
      name: f.feeder_name || f.meter_id, dar: +f.dar_today,
    }));
    // NERC item 5: fixed width per bar so the chart scrolls instead of squeezing
    const BAR_W = 64;
    const chartWidth = Math.max(chartData.length * BAR_W, 880);
    const pieData = [
      { name: 'Online', value: t.online, fill: '#2f9e44' },
      { name: 'Offline', value: t.offline, fill: '#d64545' },
      { name: 'Never reported', value: t.never_reported, fill: '#9aa5b1' },
    ].filter((d) => d.value > 0);

    return (
      <React.Fragment>
        <div className="card">
          <h2>Fleet Overview {disco !== 'all' && <span className="muted">— {disco}</span>}</h2>
          <div className="controls">
            <label>Disco
              <select value={disco}
                onChange={(e) => this.setState({ disco: e.target.value }, this.load)}>
                <option value="all">All Discos</option>
                {discos.map((d) => (
                  <option key={d.disco} value={d.disco}>{d.disco} ({d.feeders})</option>
                ))}
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
          <h2>Live Power, Reactive Power &amp; Frequency</h2>
          <div className="table-wrap" style={{ maxHeight: 320 }}>
            <table className="data">
              <thead>
                <tr><th>Feeder</th><th>Disco</th><th>Active Power</th>
                  <th>Reactive Power</th><th>Power Factor</th><th>Frequency (Hz)</th>
                  <th>D.A.R Today</th></tr>
              </thead>
              <tbody>
                {data.feeders.map((f) => (
                  <tr key={f.meter_id}>
                    <td>{f.feeder_name || f.meter_id}</td>
                    <td>{f.disco || '—'}</td>
                    <td>{n1(f.active_power)}</td>
                    <td>{n1(f.reactive_power)}</td>
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
          <div className="chart-scroll">
            <BarChart width={chartWidth} height={330} data={chartData}
              margin={{ bottom: 70, top: 20 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-40} textAnchor="end" interval={0}
                height={80} tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 100]} unit="%" />
              <Tooltip formatter={(v) => v + '%'} />
              <Bar isAnimationActive={false} dataKey="dar" name="D.A.R %">
                <LabelList dataKey="dar" position="top"
                  formatter={(v) => v + '%'} style={{ fontSize: 11, fontWeight: 700, fill: '#223344' }} />
                {chartData.map((d, i) => <Cell key={i} fill={darColor(d.dar)} />)}
              </Bar>
            </BarChart>
          </div>
          <p className="muted">Green ≥ 95% · Amber 80–95% · Red &lt; 80% — scroll sideways for more feeders.</p>
        </div>

        <div className="card">
          <h2>Connectivity</h2>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie isAnimationActive={false} data={pieData} dataKey="value" nameKey="name"
                innerRadius={60} outerRadius={95} label />
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
