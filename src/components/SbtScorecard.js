import React from 'react';
import api from '../api';

const today = () => new Date().toISOString().slice(0, 10);
const ngn = (v) => (v == null ? '—' : '₦' + Number(v).toLocaleString());
const BANDS = ['A', 'B', 'C', 'D', 'E'];

function Tile({ value, label, tone }) {
  return (
    <div className={'nerc-tile ' + tone}>
      <div className="nt-value">{value}</div>
      <div className="nt-label">{label}</div>
    </div>
  );
}

// SBT (Service-Based Tariff) Compliance Scorecard: for every feeder, actual
// supply hours today vs its Band's NERC-mandated minimum, how many
// consecutive days it's been short, and NERC's own early-warning flags
// (explanation due / downgrade risk) computed automatically instead of by
// manual DisCo self-reporting. Revenue-at-risk is estimated from the
// feeder's own measured average load, never a guessed customer count.
class SbtScorecard extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      data: null, error: null, discos: [], disco: 'all', band: 'all', date: today(),
    };
    this.load = this.load.bind(this);
  }

  componentDidMount() {
    api.listDiscos().then((discos) => this.setState({ discos })).catch(() => {});
    this.load();
    this.timer = setInterval(() => { if (!document.hidden) this.load(); }, 120000);
  }
  componentWillUnmount() { clearInterval(this.timer); }

  load() {
    const { date, disco, band } = this.state;
    api.sbtScorecard(date, disco, band)
      .then((data) => this.setState({ data, error: null }))
      .catch((e) => this.setState({ error: e.message }));
  }

  render() {
    const { data, error, discos, disco, band, date } = this.state;
    if (error) return <div className="error">{error}</div>;
    if (!data) return <div className="card">Loading SBT scorecard…</div>;

    const feeders = data.feeders;
    const totalMet = feeders.filter((f) => f.met).length;
    const totalNotMet = feeders.filter((f) => f.met === false).length;
    const explanationDue = feeders.filter((f) => f.explanationDue).length;
    const downgradeRisk = feeders.filter((f) => f.downgradeRisk).length;
    const totalRevenueAtRisk = feeders.some((f) => f.revenueAtRiskNgn != null)
      ? feeders.reduce((a, f) => a + (f.revenueAtRiskNgn || 0), 0) : null;

    return (
      <div>
        <div className="card">
          <h2>SBT Compliance Scorecard</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            Every feeder's actual supply hours today vs its Band's NERC-mandated minimum
            (Band A ≥ {data.minHours.A}h, B ≥ {data.minHours.B}h, C ≥ {data.minHours.C}h,
            D ≥ {data.minHours.D}h, E ≥ {data.minHours.E}h), with NERC's own early-warning
            flags computed automatically from telemetry instead of manual reporting.
          </p>
          <div className="controls">
            <label>Date
              <input type="date" value={date}
                onChange={(e) => this.setState({ date: e.target.value }, this.load)} />
            </label>
            <label>Disco
              <select value={disco}
                onChange={(e) => this.setState({ disco: e.target.value }, this.load)}>
                <option value="all">All Discos</option>
                {discos.map((d) => <option key={d.disco} value={d.disco}>{d.disco}</option>)}
              </select>
            </label>
            <label>Band
              <select value={band}
                onChange={(e) => this.setState({ band: e.target.value }, this.load)}>
                <option value="all">All Bands</option>
                {BANDS.map((b) => <option key={b} value={b}>Band {b}</option>)}
              </select>
            </label>
            <a className="btn" style={{ marginLeft: 'auto' }}
              href={api.nercReportUrl('sbt-scorecard', `date=${date}`, disco, band)} download>
              Download Excel
            </a>
          </div>
          <div className="nerc-grid">
            <Tile tone="good" value={totalMet} label="Feeders Met (SBT)" />
            <Tile tone="bad" value={totalNotMet} label="Feeders Not Met" />
            <Tile tone="info" value={explanationDue} label="Explanation Due (NERC rule)" />
            <Tile tone="bad" value={downgradeRisk} label="Downgrade Risk (NERC rule)" />
            <Tile tone="power" value={ngn(totalRevenueAtRisk)} label="Est. Revenue at Risk (today)" />
          </div>
        </div>

        <div className="card">
          <h2>By Disco</h2>
          <div className="table-wrap">
            <table className="data compact">
              <thead>
                <tr><th>Disco</th><th>Feeders</th><th>Met</th><th>Not Met</th>
                  <th>Explanation Due</th><th>Downgrade Risk</th><th>Revenue at Risk</th></tr>
              </thead>
              <tbody>
                {data.discos.map((d) => (
                  <tr key={d.disco}>
                    <td>{d.disco}</td><td>{d.feeders}</td>
                    <td style={{ color: '#2f9e44', fontWeight: 700 }}>{d.met}</td>
                    <td style={{ color: '#d64545', fontWeight: 700 }}>{d.notMet}</td>
                    <td>{d.explanationDue || '—'}</td>
                    <td>{d.downgradeRisk || '—'}</td>
                    <td>{ngn(d.revenueAtRiskNgn)}</td>
                  </tr>
                ))}
                {data.discos.length === 0 &&
                  <tr><td colSpan="7" className="muted">No Bands assigned yet — set a Tariff Band at onboarding.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <h2>By Feeder</h2>
          <div className="table-wrap">
            <table className="data compact">
              <thead>
                <tr><th>Feeder</th><th>Disco</th><th>Band</th><th>Min Hrs</th><th>Actual Hrs</th>
                  <th>Shortfall</th><th>Status</th><th>Consecutive Days Short</th>
                  <th>Flags</th><th>Avg Load (kW)</th><th>Revenue at Risk</th><th>Readings Today</th></tr>
              </thead>
              <tbody>
                {feeders.map((f) => (
                  <tr key={f.meterId}>
                    <td>{f.feeder}</td><td>{f.disco || '—'}</td><td>{f.band}</td>
                    <td>{f.minHours}</td><td>{f.actualHours}</td>
                    <td>{f.shortfallHours > 0 ? f.shortfallHours : '—'}</td>
                    <td><span className={'badge ' + (f.met ? 'good' : 'bad')}>{f.met ? 'Met' : 'Not Met'}</span></td>
                    <td>{f.consecutiveShortfallDays || '—'}</td>
                    <td>
                      {f.explanationDue && <span className="badge bad" style={{ marginRight: 4 }}>Explanation Due</span>}
                      {f.downgradeRisk && <span className="badge bad">Downgrade Risk</span>}
                      {!f.explanationDue && !f.downgradeRisk && '—'}
                    </td>
                    <td>{f.avgLoadKW != null ? f.avgLoadKW : '—'}</td>
                    <td>{ngn(f.revenueAtRiskNgn)}</td>
                    <td>
                      {f.readingsToday === 0
                        ? <span className="badge bad" title="Zero readings today under this meter_id — likely a duplicate/mismatched meter_id, not a real compliance failure. See the meter_id check in Settings help.">No data ⚠</span>
                        : f.readingsToday}
                    </td>
                  </tr>
                ))}
                {feeders.length === 0 &&
                  <tr><td colSpan="12" className="muted">No feeders match this filter.</td></tr>}
              </tbody>
            </table>
          </div>
          <p className="muted">Revenue at risk is estimated from each feeder's own measured average
            load today × shortfall hours × the Band tariff set in Settings — never a guessed
            customer count. Treat it as a planning estimate.</p>
          <p className="muted">"No data ⚠" means zero telemetry reached this exact meter_id today —
            that's a data problem (often a duplicate/mismatched meter_id from re-onboarding),
            not a real compliance failure. Check <code>meters</code> for a duplicate row with the
            same feeder name.</p>
        </div>
      </div>
    );
  }
}

export default SbtScorecard;
