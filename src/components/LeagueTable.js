import React from 'react';
import api from '../api';

const today = () => new Date().toISOString().slice(0, 10);
const yesterday = () => { const d = new Date(); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0, 10); };

function TrendArrow({ trend }) {
  if (trend == null) return <span className="muted">—</span>;
  if (trend > 0) return <span style={{ color: '#2f9e44', fontWeight: 700 }}>▲ {trend}pp</span>;
  if (trend < 0) return <span style={{ color: '#d64545', fontWeight: 700 }}>▼ {Math.abs(trend)}pp</span>;
  return <span className="muted">flat</span>;
}

function medal(rank) {
  return rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank;
}

// DisCo League Table: a ranked, public-facing scorecard modeled on Ofgem's
// public supplier rankings — naming and ranking DisCos on SBT compliance
// creates the kind of visible pressure a regulator can point to, which is
// what makes a platform politically useful, not just operationally useful.
class LeagueTable extends React.Component {
  constructor(props) {
    super(props);
    this.state = { data: null, error: null, date: yesterday(), compareDays: 7 };
    this.load = this.load.bind(this);
  }

  componentDidMount() { this.load(); }

  load() {
    const { date, compareDays } = this.state;
    api.leagueTable(date, compareDays)
      .then((data) => this.setState({ data, error: null }))
      .catch((e) => this.setState({ error: e.message }));
  }

  render() {
    const { data, error, date, compareDays } = this.state;
    if (error) return <div className="error">{error}</div>;
    if (!data) return <div className="card">Loading league table…</div>;

    return (
      <div>
        <div className="card">
          <h2>DisCo League Table</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            Every DisCo ranked by share of feeders meeting NERC's SBT Band minimums, with the
            change vs {compareDays} days earlier. Built for sharing outside the platform —
            the kind of public ranking that creates pressure a regulator can point to.
          </p>
          <div className="controls">
            <label>Date
              <input type="date" value={date} max={today()}
                onChange={(e) => this.setState({ date: e.target.value }, this.load)} />
            </label>
            <label>Compare to
              <select value={compareDays}
                onChange={(e) => this.setState({ compareDays: +e.target.value }, this.load)}>
                <option value={1}>1 day earlier</option>
                <option value={7}>7 days earlier</option>
                <option value={30}>30 days earlier</option>
              </select>
            </label>
          </div>
          <div className="table-wrap">
            <table className="data compact">
              <thead>
                <tr><th>Rank</th><th>Disco</th><th>Feeders</th><th>Met (SBT) %</th>
                  <th>Avg Compliance %</th><th>Explanation Due</th><th>Downgrade Risk</th>
                  <th>Trend vs {compareDays}d ago</th></tr>
              </thead>
              <tbody>
                {data.discos.map((d) => (
                  <tr key={d.disco}>
                    <td style={{ fontSize: d.rank <= 3 ? 18 : 13 }}>{medal(d.rank)}</td>
                    <td>{d.disco}</td>
                    <td>{d.feeders}</td>
                    <td style={{ fontWeight: 700, color: d.metPct >= 80 ? '#2f9e44' : d.metPct >= 50 ? '#e8a80c' : '#d64545' }}>
                      {d.metPct != null ? d.metPct + '%' : '—'}
                    </td>
                    <td>{d.avgCompliancePct != null ? d.avgCompliancePct + '%' : '—'}</td>
                    <td>{d.explanationDue || '—'}</td>
                    <td>{d.downgradeRisk || '—'}</td>
                    <td><TrendArrow trend={d.trend} /></td>
                  </tr>
                ))}
                {data.discos.length === 0 &&
                  <tr><td colSpan="8" className="muted">No Bands assigned yet — set a Tariff Band at onboarding.</td></tr>}
              </tbody>
            </table>
          </div>
          <p className="muted">"Met (SBT) %" is the share of that DisCo's feeders meeting their
            Band's minimum daily hours on {date}. Ranking uses a completed day, since a
            day in progress always looks artificially low.</p>
        </div>
      </div>
    );
  }
}

export default LeagueTable;
