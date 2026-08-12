import React from 'react';
import OnboardMeter from './components/OnboardMeter';
import StatusBoard from './components/StatusBoard';
import MeterExplorer from './components/MeterExplorer';
import Login from './components/Login';
import Clock from './components/Clock';
import Dashboard from './components/Dashboard';
import AdminPanel from './components/AdminPanel';
import api, { setUnauthorizedHandler } from './api';
import CustomerPortal from './components/CustomerPortal';

class App extends React.Component {
  constructor(props) {
    super(props);
    this.state = { session: api.session(), tab: 'dashboard', meters: [], error: null };
    this.loadMeters = this.loadMeters.bind(this);
    this.handleLogin = this.handleLogin.bind(this);
    this.handleLogout = this.handleLogout.bind(this);
  }

  componentDidMount() {
    setUnauthorizedHandler(() => {
      api.logout();
      this.setState({ session: null });
    });
    window.addEventListener('hashchange', () => this.forceUpdate());
    if (this.state.session) this.loadMeters();
  }

  handleLogin(session) {
    this.setState({ session, error: null }, this.loadMeters);
  }

  handleLogout() {
    api.logout();
    this.setState({ session: null, meters: [] });
  }

  loadMeters() {
    api.listMeters()
      .then((meters) => this.setState({ meters, error: null }))
      .catch((e) => this.setState({ error: 'Cannot reach backend: ' + e.message }));
  }

  render() {
    const { session, tab, meters, error } = this.state;
    if (window.location.hash.startsWith('#/customer')) {
      return <CustomerPortal />;
    }
    if (!session) return <Login onLogin={this.handleLogin} />;

    const tabs = [
      ['dashboard', 'Dashboard'],
      ['status', 'Feeder Status'],
      ['explorer', 'Feeder Explorer'],
    ];
    if (session.role === 'admin') { tabs.push(['onboard', 'Onboard Meter']); tabs.push(['admin', 'Admin']); }

    return (
      <div>
        <header className="app-header">
          <img className="brand-logo" alt="Protogy Global Services LTD"
            src="/logo.png"
            onError={(e) => { e.target.onerror = null; e.target.src = '/logo.svg'; }} />
          <Clock />
          <nav className="tabs">
            {tabs.map(([key, label]) => (
              <button key={key}
                className={tab === key ? 'active' : ''}
                onClick={() => this.setState({ tab: key })}>
                {label}
              </button>
            ))}
          </nav>
          <div style={{ marginLeft: 'auto', fontSize: 13 }}>
            {session.username} ({session.role}){' '}
            <button className="btn secondary" style={{ padding: '4px 10px', marginLeft: 8 }}
              onClick={this.handleLogout}>Sign out</button>
          </div>
        </header>
        <main className="page">
          {error && <div className="error">{error}</div>}
          {tab === 'dashboard' && <Dashboard />}
          {tab === 'status' && <StatusBoard />}
          {tab === 'explorer' && <MeterExplorer meters={meters} isAdmin={session.role === 'admin'} onMetersChanged={this.loadMeters} />}
          {tab === 'onboard' && session.role === 'admin' &&
            <OnboardMeter onOnboarded={this.loadMeters} />}
          {tab === 'admin' && session.role === 'admin' && <AdminPanel />}
        </main>
      </div>
    );
  }
}

export default App;
