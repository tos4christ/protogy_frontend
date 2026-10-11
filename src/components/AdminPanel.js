import React from 'react';
import api from '../api';

// Account types a Protogy Admin can create, and what each one means in the
// create-account form (shown as help text under the selector).
const ACCOUNT_TYPES = [
  { value: 'protogy_admin', label: 'Protogy Admin',
    help: 'Full access to every DisCo and state, plus user management.' },
  { value: 'protogy_user', label: 'Protogy User',
    help: 'Full view/report/download access to every DisCo and state. No user management.' },
  { value: 'nerc', label: 'NERC (National)',
    help: 'Full view/report/download access to every DisCo and state (national regulator). No user management.' },
  { value: 'state_nerc', label: 'State NERC',
    help: 'View/report/download access limited to the feeders physically located in the selected state(s) - across whichever DisCo serves them. Pick one state, or several for a regional office covering 2-3 states.' },
  { value: 'disco', label: 'DisCo', help: 'View/report/download access limited to this DisCo\'s own feeders only, plus self-service password change.' },
];

// Admin tab: user management (create / list / activate / reset password /
// delete) + system health.
class AdminPanel extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      users: [], health: null, allDiscos: [], allStates: [],
      username: '', password: '', fullName: '', accountType: 'protogy_user',
      disco: '', states: [],
      busy: false, error: null, notice: null,
      resetTarget: null, resetPassword: '', resetBusy: false,
      pmeters: [], simming: [], pmSerial: '', pmTariff: 68, pmBusy: false,
      pmError: null, pmKey: null,
    };
    this.handleRegisterPM = this.handleRegisterPM.bind(this);
    this.load = this.load.bind(this);
    this.handleCreate = this.handleCreate.bind(this);
    this.handleToggleStatus = this.handleToggleStatus.bind(this);
    this.handleResetPassword = this.handleResetPassword.bind(this);
  }

  componentDidMount() {
    this.load();
    api.listDiscos().then((rows) => this.setState({ allDiscos: rows.map((r) => r.disco) })).catch(() => {});
    api.listStates().then((rows) => this.setState({ allStates: rows.map((r) => r.state) })).catch(() => {});
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

  // Typing an EXISTING username pre-fills the form with that account's
  // current type/scope, instead of leaving the "Account Type" selector on
  // its default (Protogy User) - submitting the default by accident on an
  // existing username is exactly what silently demotes an admin account.
  handleUsernameChange(username) {
    const existing = this.state.users.find((u) => u.username === username);
    if (existing) {
      this.setState({
        username,
        fullName: existing.full_name || '',
        accountType: existing.account_type || 'protogy_user',
        disco: existing.disco || '',
        states: Array.isArray(existing.states) ? existing.states : [],
      });
    } else {
      this.setState({ username });
    }
  }

  toggleStateSelected(st) {
    const states = this.state.states.includes(st)
      ? this.state.states.filter((s) => s !== st)
      : [...this.state.states, st];
    this.setState({ states });
  }

  handleCreate(e) {
    e.preventDefault();
    const { username, password, fullName, accountType, disco, states } = this.state;
    if (accountType === 'disco' && !disco) {
      return this.setState({ error: 'Select the DisCo this account belongs to.' });
    }
    if (accountType === 'state_nerc' && states.length === 0) {
      return this.setState({ error: 'Select at least one state for this State NERC account.' });
    }
    this.setState({ busy: true, error: null, notice: null });
    api.createUser({
      username: username.trim(),
      password,
      accountType,
      disco: accountType === 'disco' ? disco : undefined,
      states: accountType === 'state_nerc' ? states : undefined,
      fullName: fullName.trim() || undefined,
    })
      .then((u) => {
        this.setState({ busy: false, notice: `User '${u.username}' (${u.accountType}) saved.`,
                        username: '', password: '', fullName: '', disco: '', states: [] });
        this.loadUsers();
      })
      .catch((err) => this.setState({ busy: false, error: err.message }));
  }

  handleToggleStatus(u) {
    const makeActive = !u.is_active;
    const verb = makeActive ? 'Reactivate' : 'Deactivate';
    if (!window.confirm(`${verb} user '${u.username}'?`)) return;
    api.setUserStatus(u.username, makeActive)
      .then(() => { this.setState({ notice: `User '${u.username}' ${makeActive ? 'reactivated' : 'deactivated'}.` }); this.loadUsers(); })
      .catch((e) => this.setState({ error: e.message }));
  }

  handleResetPassword(e) {
    e.preventDefault();
    const { resetTarget, resetPassword } = this.state;
    this.setState({ resetBusy: true, error: null });
    api.resetUserPassword(resetTarget, resetPassword)
      .then(() => this.setState({ resetBusy: false, resetTarget: null, resetPassword: '',
        notice: `Password reset for '${resetTarget}'.` }))
      .catch((err) => this.setState({ resetBusy: false, error: err.message }));
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
          {s.notice && <div className="card notice">{s.notice}</div>}

          <form onSubmit={this.handleCreate}>
            <div className="controls">
              <label>Username
                <input value={s.username} required
                  onChange={(e) => this.handleUsernameChange(e.target.value)} />
              </label>
              <label>Full name
                <input value={s.fullName}
                  onChange={(e) => this.setState({ fullName: e.target.value })} />
              </label>
              <label>Password
                <input type="password" value={s.password} required minLength={8}
                  onChange={(e) => this.setState({ password: e.target.value })} />
              </label>
              <label>Account Type
                <select value={s.accountType}
                  onChange={(e) => this.setState({ accountType: e.target.value, disco: '', states: [] })}>
                  {ACCOUNT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </label>

              {s.accountType === 'disco' && (
                <label>DisCo
                  <select value={s.disco} required
                    onChange={(e) => this.setState({ disco: e.target.value })}>
                    <option value="">— select —</option>
                    {s.allDiscos.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </label>
              )}

              <button className="btn" type="submit" disabled={s.busy}>
                {s.busy ? 'Saving…' : 'Create / Update User'}
              </button>
            </div>

            {s.accountType === 'state_nerc' && (
              <div style={{ marginTop: 8 }}>
                <div className="muted" style={{ marginBottom: 4 }}>
                  State(s) covered — select one for a single-state commission, or several for a
                  regional office covering 2-3 states:
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px' }}>
                  {s.allStates.map((st) => (
                    <label key={st} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 400 }}>
                      <input type="checkbox" checked={s.states.includes(st)}
                        onChange={() => this.toggleStateSelected(st)} />
                      {st}
                    </label>
                  ))}
                  {s.allStates.length === 0 && <span className="muted">No states found yet — onboard a feeder first.</span>}
                </div>
              </div>
            )}

            <p className="muted" style={{ marginTop: 8 }}>
              {ACCOUNT_TYPES.find((t) => t.value === s.accountType)?.help}
            </p>
          </form>
          <p className="muted">Submitting an existing username resets that user's password, account type and scope.</p>

          {s.resetTarget && (
            <div className="card" style={{ background: '#fff4e5' }}>
              <form onSubmit={this.handleResetPassword}>
                <div className="controls">
                  <b>Reset password for '{s.resetTarget}'</b>
                  <label>New password
                    <input type="password" value={s.resetPassword} required minLength={8}
                      onChange={(e) => this.setState({ resetPassword: e.target.value })} />
                  </label>
                  <button className="btn" type="submit" disabled={s.resetBusy}>
                    {s.resetBusy ? 'Saving…' : 'Set Password'}
                  </button>
                  <button type="button" className="btn secondary"
                    onClick={() => this.setState({ resetTarget: null, resetPassword: '' })}>Cancel</button>
                </div>
              </form>
            </div>
          )}

          <table className="data">
            <thead>
              <tr><th>Username</th><th>Full Name</th><th>Account Type</th><th>Scope</th>
                <th>Status</th><th>Created</th><th>Last Login</th><th></th></tr>
            </thead>
            <tbody>
              {s.users.map((u) => (
                <tr key={u.username}>
                  <td style={{ textAlign: 'left' }}>{u.username}</td>
                  <td style={{ textAlign: 'left' }}>{u.full_name || '—'}</td>
                  <td>
                    <span className={'badge ' + (u.account_type === 'protogy_admin' ? 'online' : 'never_reported')}>
                      {ACCOUNT_TYPES.find((t) => t.value === u.account_type)?.label || u.account_type || u.role}
                    </span>
                  </td>
                  <td style={{ textAlign: 'left' }}>
                    {u.account_type === 'disco' ? (u.disco || '—')
                      : u.account_type === 'state_nerc' ? (Array.isArray(u.states) ? u.states.join(', ') : '—')
                      : 'All DisCos / states'}
                  </td>
                  <td>
                    <span className={'badge ' + (u.is_active === false ? 'offline' : 'online')}>
                      {u.is_active === false ? 'inactive' : 'active'}
                    </span>
                  </td>
                  <td>{u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}</td>
                  <td>{u.last_login_at ? new Date(u.last_login_at).toLocaleString() : 'never'}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button className="btn secondary" style={{ padding: '4px 8px', fontSize: 11 }}
                      onClick={() => this.setState({ resetTarget: u.username, resetPassword: '' })}>
                      Reset Pwd
                    </button>{' '}
                    <button className="btn secondary" style={{ padding: '4px 8px', fontSize: 11 }}
                      onClick={() => this.handleToggleStatus(u)}>
                      {u.is_active === false ? 'Reactivate' : 'Deactivate'}
                    </button>{' '}
                    <button className="btn secondary" style={{ padding: '4px 8px', fontSize: 11 }}
                      onClick={() => this.handleDelete(u.username)}>Delete</button>
                  </td>
                </tr>
              ))}
              {s.users.length === 0 && <tr><td colSpan="8" className="muted">No users found.</td></tr>}
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
