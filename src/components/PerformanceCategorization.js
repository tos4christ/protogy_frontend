import React from 'react';
import api from '../api';

const PAGE_SIZES = [25, 50, 100, 250];
const thisMonthDefault = () => {
  const d = new Date();
  if (d.getUTCDate() <= 21) d.setUTCMonth(d.getUTCMonth() - 1);
  return d.toISOString().slice(0, 7);
};
const CATEGORY_COLOR = {
  'Compliant': '#2f9e44',
  'Marked for Compensation': '#e8a80c',
  'Marked for Compensation and Downgrade': '#d64545',
};

function Tile({ value, label, color }) {
  return (
    <div className="stat">
      <div className="v" style={color ? { color } : undefined}>{value}</div>
      <div className="l">{label}</div>
    </div>
  );
}

// PERFORMANCE CATEGORIZATION (NERC monthly report).
// Every feeder classified into one of three tiers based on Availability
// (hours supplied ÷ hours required for its Band) over the 1st-21st of the
// selected month specifically — not the full calendar month.
class PerformanceCategorization extends React.Component {
  constructor(props) {
    super(props);
    const dd = props.drillDown || {};
    this.state = {
      data: null, error: null,
      discos: [], states: [], voltageClasses: [],
      month: thisMonthDefault(),
      disco: dd.disco || 'all', band: dd.band || 'all',
      state: dd.state || 'all', voltageClass: dd.voltageClass || 'all', search: '',
      page: 1, limit: 50,
    };
    this.load = this.load.bind(this);
  }

  componentDidMount() {
    api.listDiscos().then((discos) => this.setState({ discos })).catch(() => {});
    api.listStates().then((states) => this.setState({ states })).catch(() => {});
    api.listVoltageClasses().then((voltageClasses) => this.setState({ voltageClasses })).catch(() => {});
    this.load();
  }

  load() {
    const { month, disco, band, state, voltageClass, search, page, limit } = this.state;
    api.performanceCategorization({ month, disco, band, state, voltageClass, search, page, limit })
      .then((data) => this.setState({ data, error: null }))
      .catch((e) => this.setState({ error: e.message }));
  }

  onFilterChange(patch) {
    this.setState({ ...patch, page: 1 }, this.load);
  }

  drillInto(disco, meterId) {
    if (this.props.onDrillDown) {
      this.props.onDrillDown({ disco, meterId, band: this.state.band,
        state: this.state.state, voltageClass: this.state.voltageClass });
    }
  }

  render() {
    const { data, error, discos, states, voltageClasses,
      month, disco, band, state, voltageClass, search, page, limit } = this.state;
    if (error) return <div className="error">{error}</div>;
    if (!data) return <div className="card">Loading performance categorization…</div>;
    const totalPages = data.totalPages || 1;
    const total3 = data.counts.Compliant + data.counts['Marked for Compensation']
      + data.counts['Marked for Compensation and Downgrade'];

    return (
      <div>
        <div className="card">
          <h2>Performance Categorization</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            Every feeder classified for {data.monthStart} to {data.monthEnd} (the 1st–21st of
            the month specifically, per NERC's reporting cycle) based on Availability = hours
            supplied ÷ hours required for its Band.
          </p>
          <div className="controls">
            <label>Month
              <input type="month" value={month}
                onChange={(e) => this.onFilterChange({ month: e.target.value })} />
            </label>
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
            <a className="btn" style={{ marginLeft: 'auto' }}
              href={api.nercReportUrl('performance-categorization', `month=${month}`, disco, band, state, voltageClass)}
              download>
              Download Excel
            </a>
          </div>

          <div className="stat-grid">
            <Tile value={total3} label="Feeders categorized" />
            <Tile value={data.counts.Compliant} label="Compliant" color={CATEGORY_COLOR.Compliant} />
            <Tile value={data.counts['Marked for Compensation']} label="Marked for Compensation" color={CATEGORY_COLOR['Marked for Compensation']} />
            <Tile value={data.counts['Marked for Compensation and Downgrade']} label="Marked for Compensation and Downgrade" color={CATEGORY_COLOR['Marked for Compensation and Downgrade']} />
          </div>
        </div>

        <div className="card">
          <h2>By Disco</h2>
          <div className="table-wrap">
            <table className="data compact">
              <thead>
                <tr><th>Disco</th><th>Feeders</th><th>Compliant</th>
                  <th>Marked for Compensation</th><th>Marked for Compensation and Downgrade</th></tr>
              </thead>
              <tbody>
                {data.discos.map((d) => (
                  <tr key={d.disco}>
                    <td>{d.disco}</td><td>{d.feeders}</td>
                    <td style={{ color: CATEGORY_COLOR.Compliant, fontWeight: 700 }}>{d.compliant}</td>
                    <td style={{ color: CATEGORY_COLOR['Marked for Compensation'], fontWeight: 700 }}>{d.compensation}</td>
                    <td style={{ color: CATEGORY_COLOR['Marked for Compensation and Downgrade'], fontWeight: 700 }}>{d.compensationDowngrade}</td>
                  </tr>
                ))}
                {data.discos.length === 0 &&
                  <tr><td colSpan="5" className="muted">No feeders match this filter.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <h2>By Feeder</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            Sorted worst-availability-first. Click a row to open that feeder in Reporting.
          </p>
          <div className="controls">
            <label>Search
              <input value={search} placeholder="feeder / meter ID"
                onChange={(e) => {
                  const v = e.target.value;
                  this.setState({ search: v });
                  clearTimeout(this.searchTimer);
                  this.searchTimer = setTimeout(() => this.onFilterChange({ search: v }), 300);
                }} />
            </label>
            <span className="muted" style={{ marginLeft: 'auto' }}>Showing {data.feederRows.length} of {data.total}</span>
            <label>Per page
              <select value={limit} onChange={(e) => this.onFilterChange({ limit: +e.target.value })}>
                {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            <button className="btn secondary" disabled={page <= 1}
              onClick={() => this.setState({ page: page - 1 }, this.load)}>‹ Prev</button>
            <span className="muted">Page {page} of {totalPages}</span>
            <button className="btn secondary" disabled={page >= totalPages}
              onClick={() => this.setState({ page: page + 1 }, this.load)}>Next ›</button>
          </div>
          <div className="table-wrap">
            <table className="data compact">
              <thead>
                <tr><th>Feeder</th><th>Disco</th><th>Band</th><th>State</th><th>Voltage Level</th>
                  <th>Required Hrs</th><th>Actual Hrs</th><th>Availability</th><th>Category</th></tr>
              </thead>
              <tbody>
                {data.feederRows.map((f) => (
                  <tr key={f.meterId} onClick={() => this.drillInto(f.disco, f.meterId)} style={{ cursor: 'pointer' }}
                    title="Open this feeder in Reporting">
                    <td>{f.feeder}</td>
                    <td>{f.disco || '—'}</td>
                    <td>{f.band || '—'}</td>
                    <td>{f.state || '—'}</td>
                    <td>{f.voltageClass || '—'}</td>
                    <td>{f.requiredHours != null ? f.requiredHours : '—'}</td>
                    <td>{f.actualHours}</td>
                    <td style={{ color: f.category ? CATEGORY_COLOR[f.category] : undefined, fontWeight: 700 }}>
                      {f.availabilityPct != null ? f.availabilityPct + '%' : '—'}
                    </td>
                    <td>
                      {f.category && (
                        <span className="badge" style={{ background: CATEGORY_COLOR[f.category], color: '#fff' }}>
                          {f.category}
                        </span>
                      )}
                      {!f.category && '—'}
                    </td>
                  </tr>
                ))}
                {data.feederRows.length === 0 &&
                  <tr><td colSpan="9" className="muted">No feeders match this filter.</td></tr>}
              </tbody>
            </table>
          </div>
          <p className="muted">Availability = hours actually supplied ÷ hours required for the
            feeder's NERC Band, summed over the 1st–21st of {data.month}. Thresholds
            ({data.compliantPct}% / {data.downgradePct}%) are configurable in Settings —
            confirm them against NERC's actual published cutoffs.</p>
        </div>
      </div>
    );
  }
}

export default PerformanceCategorization;
