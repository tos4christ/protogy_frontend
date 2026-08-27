import React from 'react';
import api from '../api';

const LABELS = {
  dar_compliance_pct: 'DAR compliance threshold (%) — feeder day is COMPLIANT at/above this',
  compliance_met_pct: 'Compliance "Met" threshold (%) — current uptime/24h at/above this',
  voltage_tolerance_pct: 'Voltage tolerance (±% of nominal) for voltage compliance',
  current_flow_threshold: 'Current flowing threshold (Amps)',
  voltage_present_threshold: 'Voltage present threshold (Volts)',
};
const SBT_HOURS_LABELS = {
  sbt_hours_band_a: 'Band A minimum daily supply hours',
  sbt_hours_band_b: 'Band B minimum daily supply hours',
  sbt_hours_band_c: 'Band C minimum daily supply hours',
  sbt_hours_band_d: 'Band D minimum daily supply hours',
  sbt_hours_band_e: 'Band E minimum daily supply hours',
};
const SBT_TARIFF_LABELS = {
  sbt_tariff_band_a: 'Band A tariff estimate (₦/kWh)',
  sbt_tariff_band_b: 'Band B tariff estimate (₦/kWh)',
  sbt_tariff_band_c: 'Band C tariff estimate (₦/kWh)',
  sbt_tariff_band_d: 'Band D tariff estimate (₦/kWh)',
  sbt_tariff_band_e: 'Band E tariff estimate (₦/kWh)',
};
const SBT_RULE_LABELS = {
  sbt_explanation_days: 'Consecutive shortfall days before "explanation due" flag',
  sbt_downgrade_days: 'Consecutive shortfall days before "downgrade risk" flag',
};

// Platform settings (admin): thresholds used by the NERC view and reports.
class Settings extends React.Component {
  constructor(props) {
    super(props);
    this.state = { values: null, busy: false, error: null, notice: null };
    this.save = this.save.bind(this);
  }
  componentDidMount() {
    api.getSettings()
      .then((values) => this.setState({ values }))
      .catch((e) => this.setState({ error: e.message }));
  }
  save(e) {
    e.preventDefault();
    this.setState({ busy: true, error: null, notice: null });
    api.saveSettings(this.state.values)
      .then((values) => this.setState({ values, busy: false, notice: 'Settings saved — applied immediately to the NERC view and future reports.' }))
      .catch((err) => this.setState({ busy: false, error: err.message }));
  }
  render() {
    const { values, busy, error, notice } = this.state;
    return (
      <div className="card" style={{ maxWidth: 720 }}>
        <h2>Platform Settings</h2>
        <p className="muted">These thresholds drive the NERC dashboard tiles, the executive
          summary, and the Met/Not Met status in Excel reports.</p>
        {error && <div className="error">{error}</div>}
        {notice && <div className="card" style={{ background: '#eef8f0' }}>{notice}</div>}
        {values && (
          <form onSubmit={this.save}>
            <div className="controls" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
              {Object.keys(LABELS).map((k) => (
                <label key={k}>{LABELS[k]}
                  <input type="number" step="0.1" value={values[k] ?? ''}
                    onChange={(e) => this.setState({
                      values: { ...values, [k]: e.target.value } })} />
                </label>
              ))}

              <h3 className="sub-h">SBT Compliance Scorecard — minimum hours per Band</h3>
              <p className="muted" style={{ marginTop: 0 }}>Per NERC's Service-Based Tariff order
                (effective 3 Apr 2024). Update only if NERC revises these.</p>
              {Object.keys(SBT_HOURS_LABELS).map((k) => (
                <label key={k}>{SBT_HOURS_LABELS[k]}
                  <input type="number" step="1" min="0" max="24" value={values[k] ?? ''}
                    onChange={(e) => this.setState({
                      values: { ...values, [k]: e.target.value } })} />
                </label>
              ))}

              <h3 className="sub-h">SBT Compliance Scorecard — tariff estimates</h3>
              <p className="muted" style={{ marginTop: 0 }}>Used only to estimate revenue exposure
                from a supply shortfall. Rates vary by DisCo and change under NERC's monthly
                review — treat as a planning estimate, not an official figure, and keep it in
                sync with your DisCo's current tariff order.</p>
              {Object.keys(SBT_TARIFF_LABELS).map((k) => (
                <label key={k}>{SBT_TARIFF_LABELS[k]}
                  <input type="number" step="0.5" min="0" value={values[k] ?? ''}
                    onChange={(e) => this.setState({
                      values: { ...values, [k]: e.target.value } })} />
                </label>
              ))}

              <h3 className="sub-h">SBT Compliance Scorecard — early-warning thresholds</h3>
              {Object.keys(SBT_RULE_LABELS).map((k) => (
                <label key={k}>{SBT_RULE_LABELS[k]}
                  <input type="number" step="1" min="1" value={values[k] ?? ''}
                    onChange={(e) => this.setState({
                      values: { ...values, [k]: e.target.value } })} />
                </label>
              ))}

              <button className="btn" type="submit" disabled={busy}>
                {busy ? 'Saving…' : 'Save Settings'}
              </button>
            </div>
          </form>
        )}
        <p className="muted">Note: gap detection / raw ingestion thresholds and per-meter
          nominal voltage are set at onboarding; certificate and server parameters remain
          managed by Integridex.</p>
      </div>
    );
  }
}

export default Settings;
