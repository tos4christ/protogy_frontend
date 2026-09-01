import React from 'react';
import api from '../api';
import GuidedTour, { TourRestartButton } from './GuidedTour';
import { nercTour } from '../tours';

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
      s: null, table: null, discos: [], disco: 'all', band: 'all',
      date: today(), month: new Date().toISOString().slice(0, 7),
      from: today(), to: today(), error: null,
      feeders: null,
    };
    this.load = this.load.bind(this);
    this.tourRef = React.createRef();
  }

  componentDidMount() {
    api.listDiscos().then((discos) => this.setState({ discos })).catch(() => {});
    this.load();
    this.timer = setInterval(() => { if (!document.hidden) this.load(); }, 60000);
  }
  componentWillUnmount() { clearInterval(this.timer); }

  // Single load path: tiles, the executive-summary table, and the feeder
  // drill-down all read the same `disco` + `band` selection, so the DAR
  // shown always matches the filters on screen — e.g. "DAR for Band A in
  // Disco X" — and never disagrees with the reports below (NERC review II,
  // items ix/x/xiii; Band filtering added after the initial review).
  load() {
    const { disco, band, date } = this.state;
    api.nercSummary(disco, band)
      .then((s) => this.setState({ s, error: null }))
      .catch((e) => this.setState({ error: e.message }));
    api.nercTable(date, disco, band)
      .then((table) => this.setState({ table }))
      .catch(() => {});
    // Feeder-level drill-down only makes sense once narrowed by Disco and/or
    // Band — it's what "logically connects" the executive summary row above
    // it to the per-feeder rows in the regulator reports below (item xiii).
    if (disco !== 'all' || band !== 'all') {
      api.nercCompliance(date, disco, band)
        .then((c) => this.setState({ feeders: c.feeders }))
        .catch(() => this.setState({ feeders: null }));
    } else {
      this.setState({ feeders: null });
    }
  }

  render() {
    const { s, table, discos, disco, band, date, month, from, to, error } = this.state;
    return (
      <div>
        <GuidedTour ref={this.tourRef} tourId="nerc" steps={nercTour} autoStart />
        {error && <div className="error">{error}</div>}
        <div className="card">
          <div className="controls" data-tour="nerc-filters">
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
                {['A', 'B', 'C', 'D', 'E'].map((b) => <option key={b} value={b}>Band {b}</option>)}
              </select>
            </label>
            <TourRestartButton onClick={() => this.tourRef.current.start()} label="" />
            {s && <span className="muted" style={{ marginLeft: 8 }}>
              DAR compliance ≥ {s.thresholds.dar_compliance_pct}% · voltage band ±{s.thresholds.voltage_tolerance_pct}%
              &nbsp;(change in Settings)</span>}
          </div>
          {s && (
            <div className="nerc-grid" data-tour="nerc-tiles">
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

        <div className="card" data-tour="nerc-summary-table">
          <h2>Executive Summary by Disco</h2>
          <div className="controls">
            <label>Date
              <input type="date" value={date}
                onChange={(e) => this.setState({ date: e.target.value }, this.load)} />
            </label>
            <span className="muted" style={{ marginLeft: 'auto' }}>
              Showing: <b>{disco === 'all' ? 'All DisCos' : disco}</b>
              {band !== 'all' && <> · Band <b>{band}</b></>}
            </span>
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

        {(disco !== 'all' || band !== 'all') && (
          <div className="card">
            <h2>Feeder Drill-Down — {disco === 'all' ? 'All DisCos' : disco}
              {band !== 'all' ? `, Band ${band}` : ''}</h2>
            {this.state.feeders ? (
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr><th>Feeder</th><th>Band</th><th>DAR (%)</th><th>Current Uptime (Hrs)</th>
                      <th>Voltage Uptime (Hrs)</th><th>Compliance (%)</th><th>Status</th></tr>
                  </thead>
                  <tbody>
                    {this.state.feeders.map((f) => (
                      <tr key={f.meterId}>
                        <td>{f.feeder}</td>
                        <td>{f.tariffBand || '—'}</td>
                        <td>{f.darPct}%</td>
                        <td>{f.currentUptimeH} Hrs</td>
                        <td>{f.voltageUptimeH} Hrs</td>
                        <td>{f.compliancePct}%</td>
                        <td><span className={'badge ' + (f.status === 'Met' ? 'good' : 'bad')}>{f.status}</span></td>
                      </tr>
                    ))}
                    {this.state.feeders.length === 0 &&
                      <tr><td colSpan="7" className="muted">No feeders match this filter yet.</td></tr>}
                  </tbody>
                </table>
              </div>
            ) : <p className="muted">Loading feeders…</p>}
          </div>
        )}

        <div className="card" data-tour="nerc-reports">
          <h2>Regulator Reports (Excel)</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            Reports export for: <b>{disco === 'all' ? 'All DisCos' : disco}</b>
            {band !== 'all' && <> · Band <b>{band}</b></>} — matching the Disco/Band
            selected above. Change them there to export a narrower slice, e.g. DAR for a
            single Band within a single Disco.
          </p>
          <div className="controls">
            <label>Report date
              <input type="date" value={date}
                onChange={(e) => this.setState({ date: e.target.value })} />
            </label>
            <a className="btn" href={api.nercReportUrl('daily-compliant', `date=${date}`, disco, band)} download>
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
            <a className="btn" href={api.nercReportUrl('data-acquisition', `from=${from}&to=${to}`, disco, band)} download>
              Data Acquisition Report
            </a>
          </div>
          <div className="controls">
            <label>Month
              <input type="month" value={month} onChange={(e) => this.setState({ month: e.target.value })} />
            </label>
            <a className="btn" href={api.nercReportUrl('month-to-date', `month=${month}`, disco, band)} download>
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
