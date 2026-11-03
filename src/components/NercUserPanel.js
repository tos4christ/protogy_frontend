import React from 'react';
import api from '../api';

// NERC Admin's own scoped user panel: create / list / reactivate-deactivate
// / reset password / delete accounts for NERC's own staff. Only ever shown
// to a nerc_admin session (see App.js NAV's requireAccountTypes entry).
//
// Unlike AdminPanel, there is no Account Type selector at all - every
// account this panel creates is a plain 'nerc' staff account, so there is
// nothing to choose. Same reasoning as ScopeFilter.js elsewhere in this
// app: a locked single value beats a dropdown that implies a choice that
// isn't there.
class NercUserPanel extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      users: [], username: '', password: '', fullName: '',
      busy: false, error: null, notice: null,
      resetTarget: null, resetPassword: '', resetBusy: false,
    };
    this.load = this.load.bind(this);
    this.handleCreate = this.handleCreate.bind(this);
    this.handleToggleStatus = this.handleToggleStatus.bind(this);
    this.handleResetPassword = this.handleResetPassword.bind(this);
  }

  componentDidMount() { this.load(); }

  load() {
    api.listOrgUsers()
      .then((users) => this.setState({ users, error: null }))
      .catch((e) => this.setState({ error: e.message }));
  }

  // Typing an existing username pre-fills Full Name - same anti-surprise
  // reasoning as AdminPanel's handleUsernameChange.
  handleUsernameChange(username) {
    const existing = this.state.users.find((u) => u.username === username);
    this.setState({ username, fullName: existing ? (existing.full_name || '') : this.state.fullName });
  }

  handleCreate(e) {
    e.preventDefault();
    const { username, password, fullName } = this.state;
    this.setState({ busy: true, error: null, notice: null });
    api.createOrgUser({ username: username.trim(), password, fullName: fullName.trim() || undefined })
      .then((u) => {
        this.setState({
          busy: false, notice: `User '${u.username}' saved.`,
          username: '', password: '', fullName: '',
        });
        this.load();
      })
      .catch((err) => this.setState({ busy: false, error: err.message }));
  }

  handleToggleStatus(u) {
    const makeActive = !u.is_active;
    const verb = makeActive ? 'Reactivate' : 'Deactivate';
    if (!window.confirm(`${verb} user '${u.username}'?`)) return;
    api.setOrgUserStatus(u.username, makeActive)
      .then(() => {
        this.setState({ notice: `User '${u.username}' ${makeActive ? 'reactivated' : 'deactivated'}.` });
        this.load();
      })
      .catch((e) => this.setState({ error: e.message }));
  }

  handleResetPassword(e) {
    e.preventDefault();
    const { resetTarget, resetPassword } = this.state;
    this.setState({ resetBusy: true, error: null });
    api.resetOrgUserPassword(resetTarget, resetPassword)
      .then(() => this.setState({
        resetBusy: false, resetTarget: null, resetPassword: '',
        notice: `Password reset for '${resetTarget}'.`,
      }))
      .catch((err) => this.setState({ resetBusy: false, error: err.message }));
  }

  handleDelete(username) {
    if (!window.confirm(`Delete user '${username}'? They will no longer be able to sign in.`)) return;
    api.deleteOrgUser(username)
      .then(() => {
        this.setState({ notice: `User '${username}' deleted.` });
        this.load();
      })
      .catch((e) => this.setState({ error: e.message }));
  }

  render() {
    const s = this.state;
    return (
      <div className="card">
        <h2>NERC Users</h2>
        <p className="muted">
          Create and manage accounts for your own NERC staff. These accounts get the
          same national view as yours, with no user-management rights of their own.
        </p>
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
            <button className="btn" type="submit" disabled={s.busy}>
              {s.busy ? 'Saving…' : 'Create / Update User'}
            </button>
          </div>
        </form>
        <p className="muted">Submitting an existing username resets that user's password and full name.</p>

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
            <tr><th>Username</th><th>Full Name</th><th>Status</th><th>Created</th><th>Last Login</th><th></th></tr>
          </thead>
          <tbody>
            {s.users.map((u) => (
              <tr key={u.username}>
                <td style={{ textAlign: 'left' }}>{u.username}</td>
                <td style={{ textAlign: 'left' }}>{u.full_name || '—'}</td>
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
            {s.users.length === 0 && <tr><td colSpan="6" className="muted">No NERC users found yet.</td></tr>}
          </tbody>
        </table>
      </div>
    );
  }
}

export default NercUserPanel;
