import React from 'react';
import api from '../api';

const BANDS = ['A', 'B', 'C', 'D', 'E'];

function FlagBadge({ label, active }) {
  if (!active) return null;
  return <span className="badge bad" style={{ marginRight: 4 }}>{label}</span>;
}

// DAR Anomaly Detection: flags statistically suspicious reporting patterns
// rather than genuine compliance — a feeder sitting at exactly 100% DAR for
// an implausibly long stretch, a sudden jump too large for real telemetry,
// or a value that repeats identically for many days (often a stuck/cached
// figure rather than fresh computation). This is the "auditor" role: Protogy
// verifying data integrity, not just relaying self-reported numbers.
class DarAnomalies extends React.Component {
  constructor(props) {
    super(props);
    this.state = { data: null, error: null, discos: [], disco: 'all', band: 'all', days: 21 };
    this.load = this.load.bind(this);
  }

  componentDidMount() {
    api.listDiscos().then((discos) => this.setState({ discos })).catch(() => {});
    this.load();
  }

  load() {
    const { days, disco, band } = this.state;
    api.darAnomalies(days, disco, band)
      .then((data) => this.setState({ data, error: null }))
      .catch((e) => this.setState({ error: e.message }));
  }

  render() {
    const { data, error, discos, disco, band, days } = this.state;
    if (error) return <div className="error">{error}</div>;
    if (!data) return <div className="card">Loading anomaly scan…</div>;

    const flagged = data.feeders.filter((f) => f.anomalyCount > 0);

    return (
      <div>
        <div className="card">
          <h2>DAR Anomaly Detection</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            Scans the last {data.days} days of DAR per feeder for patterns real telemetry
            rarely produces: {data.thresholds.perfectThreshold}+ consecutive days at exactly
            100%, a day-over-day jump of {data.thresholds.jumpThreshold}+ percentage points, or
            {' '}{data.thresholds.flatlineThreshold}+ consecutive identical values. Thresholds are
            configurable in Settings.
          </p>
          <div className="controls">
            <label>Lookback window
              <select value={days} onChange={(e) => this.setState({ days: +e.target.value }, this.load)}>
                <option value={14}>14 days</option>
                <option value={21}>21 days</option>
                <option value={30}>30 days</option>
                <option value={60}>60 days</option>
              </select>
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
          </div>
          <div className="nerc-grid">
            <div className={'nerc-tile ' + (flagged.length > 0 ? 'bad' : 'good')}>
              <div className="nt-value">{flagged.length}</div>
              <div className="nt-label">Feeders Flagged</div>
            </div>
            <div className="nerc-tile info">
              <div className="nt-value">{data.feeders.filter((f) => f.flags.suspiciouslyPerfect).length}</div>
              <div className="nt-label">Suspiciously Perfect</div>
            </div>
            <div className="nerc-tile info">
              <div className="nt-value">{data.feeders.filter((f) => f.flags.suspiciousJump).length}</div>
              <div className="nt-label">Suspicious Jump</div>
            </div>
            <div className="nerc-tile info">
              <div className="nt-value">{data.feeders.filter((f) => f.flags.flatline).length}</div>
              <div className="nt-label">Flatline</div>
            </div>
          </div>
        </div>

        <div className="card">
          <h2>Flagged Feeders</h2>
          <div className="table-wrap">
            <table className="data compact">
              <thead>
                <tr><th>Feeder</th><th>Disco</th><th>Band</th><th>Days Observed</th>
                  <th>Consecutive 100%</th><th>Max Jump (pp)</th><th>Flatline Run</th><th>Flags</th></tr>
              </thead>
              <tbody>
                {flagged.map((f) => (
                  <tr key={f.meterId}>
                    <td>{f.feeder}</td><td>{f.disco || '—'}</td><td>{f.band || '—'}</td>
                    <td>{f.daysObserved}</td>
                    <td>{f.consecutivePerfectDays}</td>
                    <td>{f.maxJumpPp}</td>
                    <td>{f.flatlineRunDays}</td>
                    <td>
                      <FlagBadge label="Suspiciously Perfect" active={f.flags.suspiciouslyPerfect} />
                      <FlagBadge label="Suspicious Jump" active={f.flags.suspiciousJump} />
                      <FlagBadge label="Flatline" active={f.flags.flatline} />
                    </td>
                  </tr>
                ))}
                {flagged.length === 0 &&
                  <tr><td colSpan="8" className="muted">No anomalies found in this window — nothing to review.</td></tr>}
              </tbody>
            </table>
          </div>
          <p className="muted">A flag here means the reporting PATTERN looks statistically
            unusual, not that fraud is confirmed — treat it as a "worth a manual check" list, not
            an accusation. Genuine strong performance is also possible; use it alongside other
            context (e.g. is this feeder newly commissioned, or on a known-reliable link).</p>
        </div>
      </div>
    );
  }
}

export default DarAnomalies;
