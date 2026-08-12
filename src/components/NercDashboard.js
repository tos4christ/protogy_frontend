import React from 'react';
import api from '../api';

const today = () => new Date().toISOString().slice(0, 10);

function Tile({ value, label, tone, sub }) {
  return (
    <div className={'nerc-tile ' + tone}>
      <div className="nt-value">{value}</div>
      <div className="nt-label">{label}</div>
      {sub && <div className="nt-sub">{sub}</div>}
    </div>
  );
}

// NERC regulator view: 12 compliance tiles, per-Disco executive table,
// and the three downloadable Excel reports in the regulator's format.
class NercDashboard extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      s: null, table: null, discos: [], disco: 'all',
      date: today(), month: new Date().toISOString().slice(0, 7),
      from: today(), to: today(), error: null,
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
    api.nercSummary(this.state.disco)
      .then((s) => this.setState({ s, error: null }))
      .catch((e) => this.setState({ error: e.message }));
    api.nercTable(this.state.date)
      .then((table) => this.setState({ table }))
      .catch(() => {});
  }

  render() {
    const { s, table, discos, disco, date, month, from, to, error } = this.state;
    return (
      <div>
        {error && <div className="error">{error}</div>}
        <div className="card">
          <div className="controls">
            <label>Disco
              <select value={disco}
                onChange={(e) => this.setState({ disco: e.target.value }, this.load)}>
                <option value="all">All Discos</option>
                {discos.map((d) => <option key={d.disco} value={d.disco}>{d.disco}</option>)}
              </select>
            </label>
            {s && <span className="muted" style={{ marginLeft: 'auto' }}>
              DAR compliance ≥ {s.thresholds.dar_compliance_pct}% · voltage band ±{s.thresholds.voltage_tolerance_pct}%
              &nbsp;(change in Settings)</span>}
          </div>
          {s && (
            <div className="nerc-grid">
              <Tile tone="good" value={s.currentOnlineFeeders} label="Current Online Feeders"
                sub={`of ${s.totalFeeders}`} />
              <Tile tone="good" value={s.compliantFeeders} label="Compliant Feeders (today)" />
              <Tile tone="good" value={s.voltageOnlineFeeders} label="Voltage Online Feeders" />
              <Tile tone="good" value={s.voltageCompliantFeeders} label="Voltage Compliant Feeders" />
              <Tile tone="bad" value={s.currentOfflineFeeders} label="Current Offline Feeders" />
              <Tile tone="bad" value={s.nonCompliantFeeders} label="Non-Compliant Feeders (today)" />
              <Tile tone="bad" value={s.voltageOfflineFeeders} label="Voltage Offline Feeders" />
              <Tile tone="bad" value={s.voltageNonCompliantFeeders} label="Voltage Non-Compliant Feeders" />
              <Tile tone="power" value={s.totalInstantaneousPowerMW + ' MW'} label="Total Instantaneous Power" />
              <Tile tone="power" value={Number(s.totalConsumptionTodayKWh).toLocaleString() + ' kWh'}
                label="Total Consumption (today)" />
              <Tile tone="info" value={s.twoDayNonCompliance} label="2-Day Non-Compliance" />
              <Tile tone="info" value={s.sevenDayMAcompliant} label="7-Day MA Compliant (DAR)" />
            </div>
          )}
        </div>

        <div className="card">
          <h2>Executive Summary by Disco</h2>
          <div className="controls">
            <label>Date
              <input type="date" value={date}
                onChange={(e) => this.setState({ date: e.target.value }, this.load)} />
            </label>
          </div>
          {table && (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr><th>Disco</th><th>Feeders</th>
                    <th>Compliant (%) {table.date}</th>
                    <th>Compliant (%) prev day</th>
                    <th>2-Day Non-Compliance</th><th>7-Day MA (%)</th></tr>
                </thead>
                <tbody>
                  {table.rows.map((r) => (
                    <tr key={r.disco}>
                      <td>{r.disco}</td><td>{r.feeders}</td>
                      <td>{r.compliant_pct_d1 != null ? r.compliant_pct_d1 + '%' : '—'}</td>
                      <td>{r.compliant_pct_d0 != null ? r.compliant_pct_d0 + '%' : '—'}</td>
                      <td>{r.two_day_nc}</td>
                      <td>{r.seven_day_ma != null ? r.seven_day_ma + '%' : '—'}</td>
                    </tr>
                  ))}
                  {table.rows.length === 0 &&
                    <tr><td colSpan="6" className="muted">No Discos with data yet.</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card">
          <h2>Regulator Reports (Excel)</h2>
          <div className="controls">
            <label>Report date
              <input type="date" value={date}
                onChange={(e) => this.setState({ date: e.target.value })} />
            </label>
            <a className="btn" href={api.nercReportUrl('daily-compliant', `date=${date}`)} download>
              Daily Compliant Feeders
            </a>
          </div>
          <div className="controls">
            <label>From
              <input type="date" value={from} onChange={(e) => this.setState({ from: e.target.value })} />
            </label>
            <label>To
              <input type="date" value={to} onChange={(e) => this.setState({ to: e.target.value })} />
            </label>
            <a className="btn" href={api.nercReportUrl('data-acquisition', `from=${from}&to=${to}`)} download>
              Data Acquisition Report
            </a>
          </div>
          <div className="controls">
            <label>Month
              <input type="month" value={month} onChange={(e) => this.setState({ month: e.target.value })} />
            </label>
            <a className="btn" href={api.nercReportUrl('month-to-date', `month=${month}`)} download>
              Month To Date Report
            </a>
          </div>
          <p className="muted">Reports match the NERC template columns (uptime hours, DAR %, MW,
            kWh, Met/Not Met). Fill Station / Category / State / Voltage Class at onboarding for
            complete rows.</p>
        </div>
      </div>
    );
  }
}

export default NercDashboard;
