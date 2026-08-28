import React from 'react';
import OnboardMeter from './components/OnboardMeter';
import StatusBoard from './components/StatusBoard';
import MeterExplorer from './components/MeterExplorer';
import Dashboard from './components/Dashboard';
import MapView from './components/MapView';
import NercDashboard from './components/NercDashboard';
import SbtScorecard from './components/SbtScorecard';
import LeagueTable from './components/LeagueTable';
import DarAnomalies from './components/DarAnomalies';
import Settings from './components/Settings';
import AdminPanel from './components/AdminPanel';
import Login from './components/Login';
import Clock from './components/Clock';
import CustomerPortal from './components/CustomerPortal';
import api, { setUnauthorizedHandler } from './api';

const NAV = [
  ['dashboard', 'Dashboard', '▦'],
  ['nerc', 'NERC View', '◈'],
  ['sbt', 'SBT Scorecard', '⚡'],
  ['league', 'DisCo League Table', '🏆'],
  ['anomalies', 'DAR Anomalies', '⚠', 'admin'],
  ['map', 'Eagle Eye', '◎'],
  ['status', 'Feeder Status', '≣'],
  ['explorer', 'Feeder Explorer', '⌕'],
  ['onboard', 'Onboard Meter', '⊕', 'admin'],
  ['admin', 'Administration', '⚙', 'admin'],
  ['settings', 'Settings', '⚒', 'admin'],
];

class App extends React.Component {
  constructor(props) {
    super(props);
    this.state = { session: api.session(), tab: 'dashboard', meters: [], error: null, navCollapsed: false };
    this.loadMeters = this.loadMeters.bind(this);
    this.handleLogin = this.handleLogin.bind(this);
    this.handleLogout = this.handleLogout.bind(this);
  }

  componentDidMount() {
    window.addEventListener('hashchange', () => this.forceUpdate());
    setUnauthorizedHandler(() => {
      api.logout();
      this.setState({ session: null });
    });
    if (this.state.session) this.loadMeters();
  }

  handleLogin(session) { this.setState({ session, error: null }, this.loadMeters); }
  handleLogout() { api.logout(); this.setState({ session: null, meters: [] }); }

  loadMeters() {
    api.listMeters()
      .then((meters) => this.setState({ meters, error: null }))
      .catch((e) => this.setState({ error: 'Cannot reach backend: ' + e.message }));
  }

  render() {
    if (window.location.hash.startsWith('#/customer')) return <CustomerPortal />;

    const { session, tab, meters, error } = this.state;
    if (!session) return <Login onLogin={this.handleLogin} />;

    const items = NAV.filter(([, , , role]) => !role || session.role === 'admin');

    return (
      <div className={"shell" + (this.state.navCollapsed ? " nav-collapsed" : "")}>
        <aside className="sidebar">
          <div className="side-brand">
            <img alt="Protogy" src="/logo.png"
              onError={(e) => { e.target.onerror = null; e.target.src = '/logo.svg'; }} />
          </div>
          <nav className="side-nav">
            {items.map(([key, label, icon]) => (
              <button key={key} className={tab === key ? 'active' : ''}
                onClick={() => this.setState({
                  tab: key,
                  // NERC item 6: auto-collapse the sidebar on Feeder Status
                  navCollapsed: key === 'status' ? true : this.state.navCollapsed,
                })}>
                <span className="ico">{icon}</span>{label}
              </button>
            ))}
          </nav>
          <div className="side-foot">
            <div className="side-user">{session.username}<br />
              <span className="role-chip">{session.role}</span></div>
            <button className="btn secondary" onClick={this.handleLogout}>Sign out</button>
          </div>
        </aside>

        <div className="main">
          <header className="topbar">
            <button className="nav-toggle" title="Show / hide menu"
              onClick={() => this.setState({ navCollapsed: !this.state.navCollapsed })}>☰</button>
            <h1>{(items.find(([k]) => k === tab) || [,''])[1]}</h1>
            <Clock />
          </header>
          <main className="page">
            {error && <div className="error">{error}</div>}
            {tab === 'dashboard' && <Dashboard />}
            {tab === 'nerc' && <NercDashboard />}
            {tab === 'sbt' && <SbtScorecard />}
            {tab === 'league' && <LeagueTable />}
            {tab === 'anomalies' && session.role === 'admin' && <DarAnomalies />}
            {tab === 'map' && <MapView />}
            {tab === 'status' && <StatusBoard />}
            {tab === 'explorer' &&
              <MeterExplorer meters={meters} isAdmin={session.role === 'admin'}
                onMetersChanged={this.loadMeters} />}
            {tab === 'onboard' && session.role === 'admin' &&
              <OnboardMeter onOnboarded={this.loadMeters} />}
            {tab === 'admin' && session.role === 'admin' && <AdminPanel />}
            {tab === 'settings' && session.role === 'admin' && <Settings />}
          </main>
        </div>
      </div>
    );
  }
}

export default App;
