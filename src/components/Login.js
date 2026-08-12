import React from 'react';
import api from '../api';

class Login extends React.Component {
  constructor(props) {
    super(props);
    this.state = { username: '', password: '', busy: false, error: null };
    this.handleSubmit = this.handleSubmit.bind(this);
  }

  handleSubmit(e) {
    e.preventDefault();
    this.setState({ busy: true, error: null });
    api.login(this.state.username.trim(), this.state.password)
      .then((session) => this.props.onLogin(session))
      .catch((err) => this.setState({ busy: false, error: err.message }));
  }

  render() {
    const s = this.state;
    return (
      <div className="card" style={{ maxWidth: 380, margin: '80px auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 12 }}>
          <img alt="Protogy Global Services LTD" style={{ maxWidth: 220 }}
            src="/logo.png"
            onError={(e) => { e.target.onerror = null; e.target.src = '/logo.svg'; }} />
        </div>
        <h2 style={{ textAlign: 'center' }}>AMI Platform Sign In</h2>
        {s.error && <div className="error">{s.error}</div>}
        <form onSubmit={this.handleSubmit}>
          <div className="controls" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
            <label>Username
              <input value={s.username} autoFocus
                onChange={(e) => this.setState({ username: e.target.value })} required />
            </label>
            <label>Password
              <input type="password" value={s.password}
                onChange={(e) => this.setState({ password: e.target.value })} required />
            </label>
            <button className="btn" type="submit" disabled={s.busy}>
              {s.busy ? 'Signing in…' : 'Sign In'}
            </button>
            <a className="muted" href="#/customer" style={{ textAlign: 'center' }}>
              Prepaid meter customer? Sign in here →
            </a>
          </div>
        </form>
      </div>
    );
  }
}

export default Login;
