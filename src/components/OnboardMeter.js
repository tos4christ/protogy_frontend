import React from 'react';
import api from '../api';
import NIGERIAN_DISCOS from '../discos';

// FEATURE 1: administrator onboards a new meter. If the physical meter is
// already streaming (auto_registered), onboarding "claims" it.
class OnboardMeter extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      meterId: '', feederName: '', location: '', intervalSeconds: 15, controllerId: '', disco: '', latitude: '', longitude: '',
      station: '', motherFeeder: '', category: '', state: '', voltageClass: '', nominalVoltage: '', tariffBand: '',
      feederType: '', regulator: '',
      user: '', busy: false, result: null, error: null,
      lookupBusy: false, lookupMsg: null,
    };
    this.handleChange = this.handleChange.bind(this);
    this.handleSubmit = this.handleSubmit.bind(this);
    this.handleLookup = this.handleLookup.bind(this);
  }

  handleChange(e) { this.setState({ [e.target.name]: e.target.value }); }

  // Pull Band/State/Regulator/Voltage/FeederType from the Commission's NESI
  // feeder registry (migrations/002_feeder_registry.sql) by disco + feeder
  // name, so staff don't have to type these in blind. Reference data only —
  // never overwrites fields the user already typed themselves.
  handleLookup() {
    const { disco, feederName } = this.state;
    if (!disco.trim() || !feederName.trim()) {
      this.setState({ lookupMsg: 'Enter Disco and Feeder Name first.' });
      return;
    }
    this.setState({ lookupBusy: true, lookupMsg: null });
    api.feederRegistryLookup(disco.trim(), feederName.trim())
      .then((r) => {
        this.setState((prev) => ({
          lookupBusy: false,
          lookupMsg: `Matched registry: ${r.feeder} (${r.disco}).`,
          state: prev.state || r.state || '',
          voltageClass: prev.voltageClass || r.voltage_level || '',
          tariffBand: prev.tariffBand || r.band || '',
          feederType: prev.feederType || r.feeder_type || '',
          regulator: prev.regulator || r.regulator || '',
        }));
      })
      .catch((err) => this.setState({
        lookupBusy: false,
        lookupMsg: err.message.includes('no match')
          ? 'No match in the feeder registry for that Disco/Feeder Name — enter details manually.'
          : `Lookup failed: ${err.message}`,
      }));
  }

  handleSubmit(e) {
    e.preventDefault();
    const { meterId, feederName, location, intervalSeconds, user, controllerId, disco, latitude, longitude,
      station, motherFeeder, category, state, voltageClass, nominalVoltage, tariffBand,
      feederType, regulator } = this.state;
    this.setState({ busy: true, error: null, result: null });
    api.onboardMeter({
      meterId: meterId.trim(),
      feederName: feederName.trim(),
      location: location.trim() || null,
      intervalSeconds: +intervalSeconds,
      user: user.trim() || null,
      controllerId: controllerId.trim() || null,
      disco: disco.trim() || null,
      latitude: latitude.trim() || null,
      longitude: longitude.trim() || null,
      station: station.trim() || null,
      motherFeeder: motherFeeder.trim() || null,
      category: category.trim() || null,
      state: state.trim() || null,
      voltageClass: voltageClass.trim() || null,
      nominalVoltage: nominalVoltage.trim() || null,
      tariffBand: tariffBand.trim() || null,
      feederType: feederType.trim() || null,
      regulator: regulator.trim() || null,
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
          <div className="card notice">
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
            <label>Feeder Registry
              <button type="button" className="btn secondary" onClick={this.handleLookup} disabled={s.lookupBusy}>
                {s.lookupBusy ? 'Looking up…' : 'Autofill from Registry'}
              </button>
            </label>
            {s.lookupMsg && <p className="muted" style={{ flex: '1 1 100%', margin: 0 }}>{s.lookupMsg}</p>}
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
            <label>Latitude (for map)
              <input name="latitude" value={s.latitude} onChange={this.handleChange}
                placeholder="e.g. 9.0563" />
            </label>
            <label>Longitude (for map)
              <input name="longitude" value={s.longitude} onChange={this.handleChange}
                placeholder="e.g. 7.4985" />
            </label>
            <label>Station
              <input name="station" value={s.station} onChange={this.handleChange} />
            </label>
            <label>Mother Feeder / Station
              <input name="motherFeeder" value={s.motherFeeder} onChange={this.handleChange} />
            </label>
            <label>Feeder Category
              <input name="category" value={s.category} onChange={this.handleChange}
                list="cat-options" placeholder="Commercial / Industrial / Residential" />
              <datalist id="cat-options">
                <option value="Commercial" /><option value="Industrial" /><option value="Residential" />
              </datalist>
            </label>
            <label>State
              <input name="state" value={s.state} onChange={this.handleChange} placeholder="e.g. FCT" />
            </label>
            <label>Voltage Class
              <input name="voltageClass" value={s.voltageClass} onChange={this.handleChange}
                list="vc-options" placeholder="11Kv Feeder / 33Kv Feeder" />
              <datalist id="vc-options">
                <option value="11Kv Feeder" /><option value="33Kv Feeder" />
              </datalist>
            </label>
            <label>Nominal Voltage (meter units, for compliance band)
              <input name="nominalVoltage" value={s.nominalVoltage} onChange={this.handleChange}
                placeholder="e.g. 11 or 415" />
            </label>
            <label>Tariff Band (NERC A–E)
              <select name="tariffBand" value={s.tariffBand} onChange={this.handleChange}>
                <option value="">— select —</option>
                <option value="A">Band A</option>
                <option value="B">Band B</option>
                <option value="C">Band C</option>
                <option value="D">Band D</option>
                <option value="E">Band E</option>
              </select>
            </label>
            <label>Feeder Type (NERC availability methodology)
              <select name="feederType" value={s.feederType} onChange={this.handleChange}>
                <option value="">— select —</option>
                <option value="Public">Public (load)</option>
                <option value="Commercial">Commercial (load)</option>
                <option value="Dedicated">Dedicated (voltage)</option>
                <option value="Virtual">Virtual (voltage)</option>
                <option value="Express">Express (voltage)</option>
                <option value="Public/Commercial">Public/Commercial (load)</option>
                <option value="Dedicated/Commercial">Dedicated/Commercial (load)</option>
              </select>
            </label>
            <label>Regulator
              <input name="regulator" value={s.regulator} onChange={this.handleChange}
                placeholder="e.g. NERC, LASERC" />
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
