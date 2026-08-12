import React from 'react';
import api from '../api';

// Admin tab: user management (create / list / delete) + system health.
class AdminPanel extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      users: [], health: null,
      username: '', password: '', role: 'user',
      busy: false, error: null, notice: null,
      pmeters: [], simming: [], pmSerial: '', pmTariff: 68, pmBusy: false,
      pmError: null, pmKey: null,
    };
    this.handleRegisterPM = this.handleRegisterPM.bind(this);
    this.load = this.load.bind(this);
    this.handleCreate = this.handleCreate.bind(this);
  }

  componentDidMount() {
    this.load();
    this.timer = setInterval(() => this.loadHealth(), 30000);
  }

  componentWillUnmount() { clearInterval(this.timer); }

  load() { this.loadUsers(); this.loadHealth(); this.loadPrepaid(); }

  loadPrepaid() {
    api.amiListMeters()
      .then((pmeters) => this.setState({ pmeters }))
      .catch((e) => this.setState({ pmError: e.message }));
    api.amiSimList()
      .then((r) => this.setState({ simming: r.simulating || [] }))
      .catch(() => {});
  }

  async pmAction(fn, refreshDelay) {
    try {
      await fn();
      this.setState({ pmError: null });
      this.loadPrepaid();
      if (refreshDelay) setTimeout(() => this.loadPrepaid(), refreshDelay);
    } catch (e) { this.setState({ pmError: e.message }); }
  }

  handleRegisterPM(e) {
    e.preventDefault();
    this.setState({ pmBusy: true, pmError: null, pmKey: null });
    api.amiRegisterMeter(this.state.pmSerial.trim(), +this.state.pmTariff)
      .then((r) => {
        this.setState({ pmBusy: false, pmSerial: '',
          pmKey: r.apiKey ? { serial: r.meter_serial, key: r.apiKey } : null,
          pmError: r.apiKey ? null : 'Meter already existed — tariff updated, API key unchanged.' });
        this.loadPrepaid();
      })
      .catch((err) => this.setState({ pmBusy: false, pmError: err.message }));
  }

  loadUsers() {
    api.listUsers()
      .then((users) => this.setState({ users, error: null }))
      .catch((e) => this.setState({ error: e.message }));
  }

  loadHealth() {
    api.health()
      .then((health) => this.setState({ health }))
      .catch(() => this.setState({ health: { ok: false, db: 'unreachable' } }));
  }

  handleCreate(e) {
    e.preventDefault();
    const { username, password, role } = this.state;
    this.setState({ busy: true, error: null, notice: null });
    api.createUser(username.trim(), password, role)
      .then((u) => {
        this.setState({ busy: false, notice: `User '${u.username}' (${u.role}) saved.`,
                        username: '', password: '' });
        this.loadUsers();
      })
      .catch((err) => this.setState({ busy: false, error: err.message }));
  }

  handleDelete(username) {
    if (!window.confirm(`Delete user '${username}'? They will no longer be able to sign in.`)) return;
    api.deleteUser(username)
      .then(() => { this.setState({ notice: `User '${username}' deleted.` }); this.loadUsers(); })
      .catch((e) => this.setState({ error: e.message }));
  }

  render() {
    const s = this.state;
    const h = s.health;
    return (
      <React.Fragment>
        <div className="card">
          <h2>System Health</h2>
          {h ? (
            <div className="stat-grid">
              <div className="stat">
                <div className="v" style={{ color: h.ok ? '#2f9e44' : '#d64545' }}>
                  {h.ok ? 'HEALTHY' : 'DOWN'}
                </div>
                <div className="l">API + Database ({h.db})</div>
              </div>
              {h.ingest && (
                <React.Fragment>
                  <div className="stat"><div className="v">{h.ingest.received}</div>
                    <div className="l">MQTT messages received</div></div>
                  <div className="stat"><div className="v">{h.ingest.inserted}</div>
                    <div className="l">Rows inserted</div></div>
                  <div className="stat"><div className="v">{h.ingest.badPayloads}</div>
                    <div className="l">Bad payloads rejected</div></div>
                  <div className="stat">
                    <div className="v">{h.ingest.lastFlush ? new Date(h.ingest.lastFlush).toLocaleTimeString() : '—'}</div>
                    <div className="l">Last DB flush</div></div>
                </React.Fragment>
              )}
            </div>
          ) : <p className="muted">Loading…</p>}
          <p className="muted">Counters reset when the backend restarts. Refreshes every 30s.</p>
        </div>

        <div className="card">
          <h2>Users</h2>
          {s.error && <div className="error">{s.error}</div>}
          {s.notice && <div className="card" style={{ background: '#eef8f0' }}>{s.notice}</div>}

          <form onSubmit={this.handleCreate}>
            <div className="controls">
              <label>Username
                <input value={s.username} required
                  onChange={(e) => this.setState({ username: e.target.value })} />
              </label>
              <label>Password
                <input type="password" value={s.password} required minLength={8}
                  onChange={(e) => this.setState({ password: e.target.value })} />
              </label>
              <label>Role
                <select value={s.role} onChange={(e) => this.setState({ role: e.target.value })}>
                  <option value="user">user (view only)</option>
                  <option value="admin">admin (full control)</option>
                </select>
              </label>
              <button className="btn" type="submit" disabled={s.busy}>
                {s.busy ? 'Saving…' : 'Create / Update User'}
              </button>
            </div>
          </form>
          <p className="muted">Submitting an existing username resets that user's password and role.</p>

          <table className="data">
            <thead>
              <tr><th>Username</th><th>Role</th><th>Created</th><th>Last Login</th><th></th></tr>
            </thead>
            <tbody>
              {s.users.map((u) => (
                <tr key={u.username}>
                  <td style={{ textAlign: 'left' }}>{u.username}</td>
                  <td><span className={'badge ' + (u.role === 'admin' ? 'online' : 'never_reported')}>{u.role}</span></td>
                  <td>{u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}</td>
                  <td>{u.last_login_at ? new Date(u.last_login_at).toLocaleString() : 'never'}</td>
                  <td>
                    <button className="btn secondary" style={{ padding: '4px 10px' }}
                      onClick={() => this.handleDelete(u.username)}>Delete</button>
                  </td>
                </tr>
              ))}
              {s.users.length === 0 && <tr><td colSpan="5" className="muted">No users found.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="card">
          <h2>Prepaid Meters (AMI)</h2>
          <p className="muted">
            Register each prepaid meter BEFORE its customer creates an account.
            Customers then self-register on the portal with their phone number
            and this meter serial.
          </p>
          {this.state.pmError && <div className="error">{this.state.pmError}</div>}
          {this.state.pmKey && (
            <div className="card" style={{ background: '#fff4e5' }}>
              <b>Meter {this.state.pmKey.serial} registered.</b><br />
              Device API key (copy NOW — it is never shown again):<br />
              <span className="vend-token">{this.state.pmKey.key}</span>
              <p className="muted">This key is programmed into the meter so it can
                report to the server. Do not share it with the customer.</p>
            </div>
          )}
          <form onSubmit={this.handleRegisterPM}>
            <div className="controls">
              <label>Meter Serial
                <input value={this.state.pmSerial} required
                  onChange={(e) => this.setState({ pmSerial: e.target.value })} />
              </label>
              <label>Tariff (₦ / kWh)
                <input type="number" min="1" step="0.01" value={this.state.pmTariff}
                  onChange={(e) => this.setState({ pmTariff: e.target.value })} />
              </label>
              <button className="btn" type="submit" disabled={this.state.pmBusy}>
                {this.state.pmBusy ? 'Registering…' : 'Register / Update Meter'}
              </button>
            </div>
          </form>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr><th>Serial</th><th>Customer</th><th>Phone</th><th>Tariff ₦/kWh</th>
                  <th>Balance kWh</th><th>Status</th><th>Last Seen</th><th>Controls</th></tr>
              </thead>
              <tbody>
                {this.state.pmeters.map((m) => {
                  const simOn = (this.state.simming || []).includes(m.meter_serial);
                  return (
                  <tr key={m.meter_serial}>
                    <td style={{ textAlign: 'left' }}>{m.meter_serial}</td>
                    <td style={{ textAlign: 'left' }}>{m.full_name || '— not claimed —'}</td>
                    <td>{m.phone || '—'}</td>
                    <td>{m.tariff_naira_kwh}</td>
                    <td>{m.balance_kwh}</td>
                    <td><span className={'badge ' + (m.status === 'active' ? 'online' : 'offline')}>{m.status}</span>
                      {simOn && <span className="badge auto_registered" style={{ marginLeft: 4 }}>SIM</span>}</td>
                    <td>{m.last_seen_at ? new Date(m.last_seen_at).toLocaleString() : 'never'}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button className="btn secondary" style={{ padding: '3px 8px', fontSize: 11 }}
                        onClick={() => this.pmAction(() =>
                          api.amiSetMeterStatus(m.meter_serial,
                            m.status === 'active' ? 'disconnected' : 'active'))}>
                        {m.status === 'active' ? 'Disconnect' : 'Activate'}
                      </button>{' '}
                      <button className="btn secondary" style={{ padding: '3px 8px', fontSize: 11 }}
                        disabled={m.status !== 'active'}
                        onClick={() => this.pmAction(() =>
                          api.amiSimulate(m.meter_serial, simOn ? 'stop' : 'start'), 1500)}>
                        {simOn ? 'Stop Sim' : 'Start Sim'}
                      </button>{' '}
                      <button className="btn secondary" style={{ padding: '3px 8px', fontSize: 11 }}
                        disabled={m.status !== 'active'}
                        onClick={() => this.pmAction(() =>
                          api.amiSimulate(m.meter_serial, 'once'), 800)}>
                        Send Reading
                      </button>
                    </td>
                  </tr>
                  );
                })}
                {this.state.pmeters.length === 0 &&
                  <tr><td colSpan="8" className="muted">No prepaid meters registered yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </React.Fragment>
    );
  }
}

export default AdminPanel;
