import React from 'react';
import api from '../api';
import NIGERIAN_DISCOS from '../discos';

// FEATURE 1: administrator onboards a new meter. If the physical meter is
// already streaming (auto_registered), onboarding "claims" it.
class OnboardMeter extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      meterId: '', feederName: '', location: '', intervalSeconds: 15, controllerId: '', disco: '',
      user: '', busy: false, result: null, error: null,
    };
    this.handleChange = this.handleChange.bind(this);
    this.handleSubmit = this.handleSubmit.bind(this);
  }

  handleChange(e) { this.setState({ [e.target.name]: e.target.value }); }

  handleSubmit(e) {
    e.preventDefault();
    const { meterId, feederName, location, intervalSeconds, user, controllerId, disco } = this.state;
    this.setState({ busy: true, error: null, result: null });
    api.onboardMeter({
      meterId: meterId.trim(),
      feederName: feederName.trim(),
      location: location.trim() || null,
      intervalSeconds: +intervalSeconds,
      user: user.trim() || null,
      controllerId: controllerId.trim() || null,
      disco: disco.trim() || null,
    })
      .then((result) => {
        this.setState({ busy: false, result });
        if (this.props.onOnboarded) this.props.onOnboarded();
      })
      .catch((err) => this.setState({ busy: false, error: err.message }));
  }

  render() {
    const s = this.state;
    return (
      <div className="card">
        <h2>Onboard a New Meter</h2>
        <p className="muted">
          Register a field meter so the platform expects its data. The Meter ID
          must match the device certificate CN / MQTT client id. If the meter is
          already streaming, onboarding claims it and activates it.
        </p>
        {s.error && <div className="error">{s.error}</div>}
        {s.result && (
          <div className="card" style={{ background: '#eef8f0' }}>
            Meter <b>{s.result.meter_id}</b> onboarded as feeder{' '}
            <b>{s.result.feeder_name}</b> (status: <span className={'badge ' + s.result.status}>{s.result.status}</span>)
          </div>
        )}
        <form onSubmit={this.handleSubmit}>
          <div className="controls">
            <label>Meter ID (cert CN) *
              <input name="meterId" value={s.meterId} onChange={this.handleChange} required />
            </label>
            <label>Feeder Name *
              <input name="feederName" value={s.feederName} onChange={this.handleChange} required />
            </label>
            <label>Disco *
              <input name="disco" value={s.disco} onChange={this.handleChange} required
                list="disco-options" placeholder="select or type a Disco" />
              <datalist id="disco-options">
                {NIGERIAN_DISCOS.map((d) => <option key={d} value={d} />)}
              </datalist>
            </label>
            <label>Location
              <input name="location" value={s.location} onChange={this.handleChange} />
            </label>
            <label>Reporting Interval (s)
              <input name="intervalSeconds" type="number" min="1"
                value={s.intervalSeconds} onChange={this.handleChange} />
            </label>
            <label>Onboarded By
              <input name="user" value={s.user} onChange={this.handleChange} />
            </label>
            <label>Controller ID (optional)
              <input name="controllerId" value={s.controllerId} onChange={this.handleChange}
                placeholder="e.g. CTRL-STN01 for daisy-chained meters" />
            </label>
            <button className="btn" type="submit" disabled={s.busy}>
              {s.busy ? 'Saving…' : 'Onboard Meter'}
            </button>
          </div>
        </form>
      </div>
    );
  }
}

export default OnboardMeter;
