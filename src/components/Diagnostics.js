import React from 'react';
import api from '../api';

const yesterday = () => { const d = new Date(); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0, 10); };
const today = () => new Date().toISOString().slice(0, 10);
const PAGE_SIZES = [25, 50, 100, 250];

function Tile({ value, label, color }) {
  return (
    <div className="stat">
      <div className="v" style={color ? { color } : undefined}>{value}</div>
      <div className="l">{label}</div>
    </div>
  );
}
function Flag({ active, label }) {
  if (!active) return null;
  return <span className="badge bad" style={{ marginRight: 4, marginBottom: 4, display: 'inline-block' }}>{label}</span>;
}

// DIAGNOSTICS — "what went wrong, and where."
// Consolidates every data-integrity and equipment-health signal the
// platform collects: connectivity, data-quality flags (from the SBT
// Scorecard's pattern), data gaps (Feeder Explorer's per-feeder Gaps view,
// generalised fleet-wide), communication quality (latency/buffering data
// that's always been collected but never shown anywhere), missing
// onboarding configuration, and possible duplicate meters — plus Power
// Quality Analytics embedded as a full section using its existing
// endpoint. Visible to every signed-in user (including regulator
// accounts), not just Administrators.
class Diagnostics extends React.Component {
  constructor(props) {
    super(props);
    const dd = props.drillDown || {};
    this.state = {
      data: null, error: null,
      discos: [], states: [], voltageClasses: [],
      date: yesterday(), disco: dd.disco || 'all', band: dd.band || 'all',
      state: dd.state || 'all', voltageClass: dd.voltageClass || 'all', search: '',
      page: 1, limit: 50,
      pq: null,
    };
    this.load = this.load.bind(this);
    this.loadPq = this.loadPq.bind(this);
  }

  componentDidMount() {
    api.listDiscos().then((discos) => this.setState({ discos })).catch(() => {});
    api.listStates().then((states) => this.setState({ states })).catch(() => {});
    api.listVoltageClasses().then((voltageClasses) => this.setState({ voltageClasses })).catch(() => {});
    this.load();
    this.loadPq();
  }

  load() {
    const { date, disco, band, state, voltageClass, search, page, limit } = this.state;
    api.diagnostics({ date, disco, band, state, voltageClass, search, page, limit })
      .then((data) => this.setState({ data, error: null }))
      .catch((e) => this.setState({ error: e.message }));
  }

  loadPq() {
    const { disco, band } = this.state;
    api.powerQuality(disco, band)
      .then((pq) => this.setState({ pq }))
      .catch(() => {});
  }

  onFilterChange(patch) {
    this.setState({ ...patch, page: 1 }, () => { this.load(); this.loadPq(); });
  }

  drillInto(disco, meterId) {
    if (this.props.onDrillDown) {
      this.props.onDrillDown({ disco, meterId, band: this.state.band,
        state: this.state.state, voltageClass: this.state.voltageClass });
    }
  }

  render() {
    const { data, error, discos, states, voltageClasses, date, disco, band, state, voltageClass,
      search, page, limit, pq } = this.state;
    if (error) return <div className="error">{error}</div>;
    if (!data) return <div className="card">Loading diagnostics…</div>;
    const totalPages = data.totalPages || 1;
    const c = data.counts;

    return (
      <div>
        <div className="card">
          <h2>Diagnostics <span className="live-dot" title="Data-integrity overview"></span></h2>
          <p className="muted" style={{ marginTop: 0 }}>
            Every data-integrity and equipment-health signal the platform tracks, in one place
            — connectivity, data quality, communication health, configuration gaps, and power
            quality issues.
          </p>
          <div className="controls">
            <label>Date
              <input type="date" value={date} max={today()}
                onChange={(e) => this.onFilterChange({ date: e.target.value })} />
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
          </div>

          <div className="stat-grid">
            <Tile value={c.offline} label="Offline" color="#d64545" />
            <Tile value={c.neverReported} label="Never Reported" color="#d64545" />
            <Tile value={c.noData} label="No Data Today" color="#d64545" />
            <Tile value={c.noCurrentSensor} label="No Current Sensor" color="#e8a80c" />
            <Tile value={c.dataGaps} label="Data Gaps" color="#e8a80c" />
            <Tile value={c.highLatency} label="High Latency" color="#e8a80c" />
            <Tile value={c.heavyBuffering} label="Heavy Buffering" color="#e8a80c" />
            <Tile value={c.poorPowerFactor} label="Poor Power Factor" color="#e8a80c" />
            <Tile value={c.phaseImbalance} label="Phase Imbalance" color="#e8a80c" />
          </div>
        </div>

        <div className="card">
          <h2>Feeder Diagnostics</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            Sorted by most flags first. Click a row to open that feeder in Reporting.
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
                <tr><th>Feeder</th><th>Disco</th><th>Band</th><th>Connectivity</th>
                  <th>Empty Buckets</th><th>Avg Latency (s)</th><th>Buffered</th><th>Flags</th></tr>
              </thead>
              <tbody>
                {data.feederRows.map((f) => (
                  <tr key={f.meterId} onClick={() => this.drillInto(f.disco, f.meterId)} style={{ cursor: 'pointer' }}
                    title="Open this feeder in Reporting">
                    <td>{f.feeder}</td>
                    <td>{f.disco || '—'}</td>
                    <td>{f.band || '—'}</td>
                    <td><span className={'badge ' + f.connectivity}>{f.connectivity}</span></td>
                    <td>{f.emptyBuckets} / 96</td>
                    <td>{f.avgLatencyS != null ? f.avgLatencyS : '—'}</td>
                    <td>{f.bufferedCount}</td>
                    <td>
                      <Flag active={f.neverReported} label="Never Reported" />
                      <Flag active={f.noData} label="No Data" />
                      <Flag active={f.noCurrentSensor} label="No Current Sensor" />
                      <Flag active={f.dataGaps} label="Data Gaps" />
                      <Flag active={f.highLatency} label="High Latency" />
                      <Flag active={f.heavyBuffering} label="Heavy Buffering" />
                      <Flag active={f.poorPowerFactor} label="Poor PF" />
                      <Flag active={f.phaseImbalance} label="Phase Imbalance" />
                      {f.issueCount === 0 && <span className="muted">No issues</span>}
                    </td>
                  </tr>
                ))}
                {data.feederRows.length === 0 &&
                  <tr><td colSpan="8" className="muted">No feeders match this filter.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <h2>Missing Configuration</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            Feeders missing Band, Disco, State, or Voltage Level — this silently breaks
            Band-based features (SBT Scorecard, League Table, Performance Categorization) and
            map placement for the feeders affected. Fix via Onboard Meter.
          </p>
          <div className="table-wrap">
            <table className="data compact">
              <thead><tr><th>Feeder</th><th>Missing</th></tr></thead>
              <tbody>
                {data.missingConfig.map((f) => (
                  <tr key={f.meterId}>
                    <td>{f.feeder}</td>
                    <td>
                      <Flag active={f.missingBand} label="Band" />
                      <Flag active={f.missingDisco} label="Disco" />
                      <Flag active={f.missingState} label="State" />
                      <Flag active={f.missingVoltageClass} label="Voltage Level" />
                    </td>
                  </tr>
                ))}
                {data.missingConfig.length === 0 &&
                  <tr><td colSpan="2" className="muted">Every feeder has complete configuration.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <h2>Possible Duplicate Meters</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            Feeders sharing the same name under different Meter IDs — often means one was
            re-onboarded with a slightly mismatched ID, leaving a duplicate empty record while
            the original keeps working. Review and merge via Onboard Meter.
          </p>
          <div className="table-wrap">
            <table className="data compact">
              <thead><tr><th>Feeder Name</th><th>Meter IDs</th></tr></thead>
              <tbody>
                {data.duplicateGroups.map((g) => (
                  <tr key={g.feederName}>
                    <td>{g.feederName}</td>
                    <td>{g.meterIds.join(', ')}</td>
                  </tr>
                ))}
                {data.duplicateGroups.length === 0 &&
                  <tr><td colSpan="2" className="muted">No duplicate feeder names found.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <h2>Power Quality Issues</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            Live power factor and phase current imbalance issues — also shown on the Dashboard
            for day-to-day monitoring; repeated here as part of the full diagnostic picture.
          </p>
          {pq ? (
            <React.Fragment>
              <h3 className="sub-h">Worst Power Factor</h3>
              <div className="table-wrap">
                <table className="data compact">
                  <thead><tr><th>Feeder</th><th>Disco</th><th>Band</th><th>Power Factor</th></tr></thead>
                  <tbody>
                    {pq.pf.poor.map((f) => (
                      <tr key={f.meterId} onClick={() => this.drillInto(f.disco, f.meterId)} style={{ cursor: 'pointer' }}>
                        <td>{f.feeder}</td><td>{f.disco || '—'}</td><td>{f.band || '—'}</td>
                        <td style={{ color: '#d64545', fontWeight: 700 }}>{f.powerFactor}</td>
                      </tr>
                    ))}
                    {pq.pf.poor.length === 0 &&
                      <tr><td colSpan="4" className="muted">No feeders below the poor-PF threshold.</td></tr>}
                  </tbody>
                </table>
              </div>
              <h3 className="sub-h">Worst Phase Current Imbalance</h3>
              <div className="table-wrap">
                <table className="data compact">
                  <thead><tr><th>Feeder</th><th>Disco</th><th>Band</th><th>Imbalance</th></tr></thead>
                  <tbody>
                    {pq.imbalance.worst.map((f) => (
                      <tr key={f.meterId} onClick={() => this.drillInto(f.disco, f.meterId)} style={{ cursor: 'pointer' }}>
                        <td>{f.feeder}</td><td>{f.disco || '—'}</td><td>{f.band || '—'}</td>
                        <td style={{ color: '#d64545', fontWeight: 700 }}>{f.imbalancePct}%</td>
                      </tr>
                    ))}
                    {pq.imbalance.worst.length === 0 &&
                      <tr><td colSpan="4" className="muted">No feeders above the imbalance threshold.</td></tr>}
                  </tbody>
                </table>
              </div>
            </React.Fragment>
          ) : <p className="muted">Loading…</p>}
        </div>
      </div>
    );
  }
}

export default Diagnostics;
