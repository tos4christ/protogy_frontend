import React from 'react';
import OnboardMeter from './components/OnboardMeter';
import StatusBoard from './components/StatusBoard';
import MeterExplorer from './components/MeterExplorer';
import Dashboard from './components/Dashboard';
import MapView from './components/MapView';
import NercDashboard from './components/NercDashboard';
import ExecutiveSummary from './components/ExecutiveSummary';
import DarHistory from './components/DarHistory';
import Reporting from './components/Reporting';
import PerformanceCategorization from './components/PerformanceCategorization';
import Diagnostics from './components/Diagnostics';
import SbtScorecard from './components/SbtScorecard';
import LeagueTable from './components/LeagueTable';
import Settings from './components/Settings';
import AdminPanel from './components/AdminPanel';
import Login from './components/Login';
import Clock from './components/Clock';
import CustomerPortal from './components/CustomerPortal';
import api, { setUnauthorizedHandler } from './api';

const THEME_KEY = 'protogy_theme';
function getInitialTheme() {
  const stored = localStorage.getItem(THEME_KEY);
  if (stored === 'light' || stored === 'dark') return stored;
  // No explicit choice yet — respect the OS/browser preference.
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark' : 'light';
}
function ThemeToggle({ theme, onToggle }) {
  return (
    <button className="theme-toggle" onClick={onToggle}
      title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
      {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
    </button>
  );
}

const NAV = [
  ['dashboard', 'Dashboard', '▦'],
  ['exec', 'Executive Summary', '▣'],
  ['dar-history', 'Historical DAR', '▤'],
  ['reporting', 'Reporting', '▥'],
  ['categorization', 'Performance Categorization', '▧'],
  ['diagnostics', 'Diagnostics', '⚠'],
  ['nerc', 'NERC View', '◈'],
  ['sbt', 'SBT Scorecard', '⚡'],
  ['league', 'DisCo League Table', '🏆'],
  ['map', 'Eagle Eye', '◎', 'admin'],
  ['status', 'Feeder Status', '≣'],
  ['explorer', 'Feeder Explorer', '⌕'],
  ['onboard', 'Onboard Meter', '⊕', 'admin'],
  ['admin', 'Administration', '⚙', 'admin'],
  ['settings', 'Settings', '⚒', 'admin'],
];

// The app's tab and any drill-down context live in the URL hash, not just
// in-memory state — that's what makes a page refresh land back on the same
// screen (with the same drilled-down feeder), and what makes the browser's
// own Back/Forward buttons work correctly for in-app navigation. Format:
// "#/<tab>" or "#/<tab>?key=value&key2=value2" for drill-down params.
function parseHash() {
  const m = (window.location.hash || '').match(/^#\/([a-zA-Z0-9_-]+)(?:\?(.*))?$/);
  if (!m) return { tab: 'dashboard', drillDown: null };
  const params = {};
  if (m[2]) new URLSearchParams(m[2]).forEach((v, k) => { params[k] = v; });
  return { tab: m[1], drillDown: Object.keys(params).length ? params : null };
}
function buildHash(tab, drillDown) {
  let h = '#/' + tab;
  if (drillDown) {
    const qs = new URLSearchParams();
    Object.entries(drillDown).forEach(([k, v]) => { if (v != null && v !== '') qs.set(k, v); });
    const qsStr = qs.toString();
    if (qsStr) h += '?' + qsStr;
  }
  return h;
}
// Guards against a stale/bookmarked hash pointing to a tab that doesn't
// exist, or an admin-only tab opened by a non-admin session.
function isValidTab(tab, session) {
  const item = NAV.find(([k]) => k === tab);
  if (!item) return false;
  const role = item[3];
  return !role || (session && session.role === role);
}

class App extends React.Component {
  constructor(props) {
    super(props);
    const session = api.session();
    const initial = parseHash();
    this.state = {
      session, tab: isValidTab(initial.tab, session) ? initial.tab : 'dashboard',
      drillDown: initial.drillDown,
      meters: [], error: null,
      navCollapsed: initial.tab === 'status', theme: getInitialTheme(), hasNavigatedAway: false,
    };
    this.loadMeters = this.loadMeters.bind(this);
    this.handleLogin = this.handleLogin.bind(this);
    this.handleLogout = this.handleLogout.bind(this);
    this.toggleTheme = this.toggleTheme.bind(this);
    this.handleDrillDown = this.handleDrillDown.bind(this);
    this.navigate = this.navigate.bind(this);
    this.onHashChange = this.onHashChange.bind(this);
  }

  // The single place that changes screens — always updates both the URL
  // hash (so refresh and browser Back/Forward work) and the in-memory
  // state (for an instant UI update without waiting on the hashchange
  // event to round-trip).
  navigate(tab, drillDown = null) {
    this.setState({ tab, drillDown, hasNavigatedAway: true, navCollapsed: tab === 'status' });
    window.location.hash = buildHash(tab, drillDown);
  }

  // Page 1/2/4/Diagnostics -> Page 3 (Reporting) drill-down handoff.
  handleDrillDown(target) {
    this.navigate('reporting', target);
  }

  onHashChange() {
    if (window.location.hash.startsWith('#/customer')) return;
    const { tab, drillDown } = parseHash();
    const resolvedTab = isValidTab(tab, this.state.session) ? tab : 'dashboard';
    this.setState({ tab: resolvedTab, drillDown, navCollapsed: resolvedTab === 'status' });
  }

  componentDidMount() {
    window.addEventListener('hashchange', this.onHashChange);
    setUnauthorizedHandler(() => {
      api.logout();
      this.setState({ session: null });
    });
    if (this.state.session) this.loadMeters();
    document.documentElement.setAttribute('data-theme', this.state.theme);
  }

  componentWillUnmount() {
    window.removeEventListener('hashchange', this.onHashChange);
  }

  toggleTheme() {
    const theme = this.state.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem(THEME_KEY, theme);
    document.documentElement.setAttribute('data-theme', theme);
    this.setState({ theme });
  }

  handleLogin(session) { this.setState({ session, error: null }, this.loadMeters); }
  handleLogout() {
    api.logout();
    this.setState({ session: null, meters: [], tab: 'dashboard', drillDown: null, hasNavigatedAway: false });
    window.location.hash = '';
  }

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
                onClick={() => this.navigate(key)}>
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
            {this.state.hasNavigatedAway && (
              <button className="btn secondary" style={{ marginRight: 12 }}
                title="Go back to the previous page" onClick={() => window.history.back()}>
                ‹ Back
              </button>
            )}
            <h1>{(items.find(([k]) => k === tab) || [,''])[1]}</h1>
            <div className="topbar-right">
              <ThemeToggle theme={this.state.theme} onToggle={this.toggleTheme} />
              <Clock />
              <span className="topbar-user" title={`Signed in as ${session.username} (${session.role})`}>
                {session.username}
              </span>
              <button className="btn secondary" onClick={this.handleLogout}>Sign out</button>
            </div>
          </header>
          <main className="page">
            {error && <div className="error">{error}</div>}
            {tab === 'dashboard' && <Dashboard />}
            {tab === 'exec' && <ExecutiveSummary onDrillDown={this.handleDrillDown} />}
            {tab === 'dar-history' && <DarHistory />}
            {tab === 'reporting' && <Reporting drillDown={this.state.drillDown} />}
            {tab === 'categorization' && <PerformanceCategorization drillDown={this.state.drillDown} onDrillDown={this.handleDrillDown} />}
            {tab === 'nerc' && <NercDashboard initialDisco={this.state.drillDown && this.state.drillDown.disco} />}
            {tab === 'sbt' && <SbtScorecard />}
            {tab === 'league' && <LeagueTable />}
            {tab === 'diagnostics' && <Diagnostics drillDown={this.state.drillDown} onDrillDown={this.handleDrillDown} />}
            {tab === 'map' && session.role === 'admin' && <MapView />}
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
