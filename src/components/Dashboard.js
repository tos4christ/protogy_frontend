import React from 'react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip,
  CartesianGrid, Cell, PieChart, Pie, Legend,
} from 'recharts';
import api from '../api';

const darColor = (pct) => (pct >= 95 ? '#2f9e44' : pct >= 80 ? '#e8a80c' : '#d64545');

// Fleet dashboard: stat cards, today's DAR per feeder, online/offline donut.
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
    const { data, error } = this.state;
    if (error) return <div className="error">{error}</div>;
    if (!data) return <div className="card">Loading dashboard…</div>;
    const t = data.totals;
    const chartData = data.feeders.map((f) => ({
      name: f.feeder_name || f.meter_id,
      dar: +f.dar_today,
      connectivity: f.connectivity,
    }));
    const pieData = [
      { name: 'Online', value: t.online, fill: '#2f9e44' },
      { name: 'Offline', value: t.offline, fill: '#d64545' },
      { name: 'Never reported', value: t.never_reported, fill: '#9aa5b1' },
    ].filter((d) => d.value > 0);

    return (
      <React.Fragment>
        <div className="card">
          <h2>Fleet Overview {this.state.disco !== 'all' && <span className="muted">— {this.state.disco}</span>}</h2>
          <div className="controls">
            <label>Disco
              <select value={this.state.disco}
                onChange={(e) => this.setState({ disco: e.target.value }, this.load)}>
                <option value="all">All Discos</option>
                {this.state.discos.map((d) => (
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
          <h2>Today's D.A.R by Feeder</h2>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={chartData} margin={{ bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-40} textAnchor="end" interval={0} height={70} tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 100]} unit="%" />
              <Tooltip formatter={(v) => v + '%'} />
              <Bar isAnimationActive={false} dataKey="dar" name="D.A.R %">
                {chartData.map((d, i) => <Cell key={i} fill={darColor(d.dar)} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <p className="muted">Green ≥ 95% · Amber 80–95% · Red &lt; 80%</p>
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
