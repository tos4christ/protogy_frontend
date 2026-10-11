import React from 'react';
import api from '../api';

const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = (n) => { const d = new Date(); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };
const LIMITS = [100, 200, 500, 1000];

// Mirrors audit.js's ACTIONS on the backend — kept here (not fetched) since
// it's a fixed, documented set, same as ACCOUNT_TYPES in AdminPanel.js.
const ACTIONS = [
  'login_success', 'login_failed', 'logout',
  'user_created', 'user_updated', 'user_deactivated', 'user_reactivated', 'user_deleted',
  'password_reset', 'role_changed',
  'data_access', 'report_generated', 'data_download',
];
const FAILURE_ACTIONS = new Set(['login_failed', 'user_deactivated', 'user_deleted']);
const SUCCESS_ACTIONS = new Set(['login_success', 'user_created', 'user_reactivated', 'password_reset']);
function badgeTone(action) {
  if (FAILURE_ACTIONS.has(action)) return 'offline';
  if (SUCCESS_ACTIONS.has(action)) return 'online';
  return 'never_reported';
}

function formatDetail(detail) {
  if (detail == null) return '—';
  try {
    const s = typeof detail === 'string' ? detail : JSON.stringify(detail);
    return s.length > 80 ? s.slice(0, 77) + '…' : s;
  } catch (e) { return String(detail); }
}

// NERC item 6: login/logout, failed logins, account create/modify/
// deactivate, data access, report generation, data download/export, role
// changes, admin activity — all already written to audit_log by audit.js
// at the point each of those actions happens. This page is just the first
// place to read that trail back, filter it, and export it.
class AuditLog extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      rows: null, error: null,
      username: '', action: 'all', from: daysAgo(29), to: today(), limit: 200,
    };
    this.load = this.load.bind(this);
  }

  componentDidMount() { this.load(); }

  load() {
    const { username, action, from, to, limit } = this.state;
    api.auditLog({ username, action, from, to, limit })
      .then((rows) => this.setState({ rows, error: null }))
      .catch((e) => this.setState({ error: e.message }));
  }

  onFilterChange(patch) {
    this.setState(patch, this.load);
  }

  render() {
    const { rows, error, username, action, from, to, limit } = this.state;
    const filters = { username, action, from, to };

    return (
      <div>
        <div className="card">
          <h2>Audit Log</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            Login/logout (incl. failed attempts), account create/update/deactivate/delete,
            password resets, and data access/report/download activity — per NERC item 6.
          </p>
          {error && <div className="error">{error}</div>}
          <div className="controls">
            <label>Username
              <input value={username} placeholder="e.g. aedc_user"
                onChange={(e) => {
                  const v = e.target.value;
                  this.setState({ username: v });
                  clearTimeout(this.searchTimer);
                  this.searchTimer = setTimeout(() => this.onFilterChange({ username: v }), 300);
                }} />
            </label>
            <label>Action
              <select value={action} onChange={(e) => this.onFilterChange({ action: e.target.value })}>
                <option value="all">All Actions</option>
                {ACTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </label>
            <label>From
              <input type="date" value={from} max={to}
                onChange={(e) => this.onFilterChange({ from: e.target.value })} />
            </label>
            <label>To
              <input type="date" value={to} max={today()}
                onChange={(e) => this.onFilterChange({ to: e.target.value })} />
            </label>
            <label>Show
              <select value={limit} onChange={(e) => this.onFilterChange({ limit: +e.target.value })}>
                {LIMITS.map((n) => <option key={n} value={n}>{n} rows</option>)}
              </select>
            </label>
            <a className="btn" style={{ marginLeft: 'auto' }}
              href={api.auditLogDownloadUrl(filters)} download>
              ⤓ Download CSV (full range, no row cap)
            </a>
          </div>

          {!rows ? (
            <p className="muted">Loading audit trail…</p>
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>At</th><th>Username</th><th>Account Type</th><th>Action</th>
                    <th>Target</th><th>Detail</th><th>IP</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td>{new Date(r.at).toLocaleString()}</td>
                      <td>{r.username || '—'}</td>
                      <td>{r.account_type || '—'}</td>
                      <td><span className={'badge ' + badgeTone(r.action)}>{r.action}</span></td>
                      <td>{r.target || '—'}</td>
                      <td title={typeof r.detail === 'object' ? JSON.stringify(r.detail) : (r.detail || '')}>
                        {formatDetail(r.detail)}
                      </td>
                      <td>{r.ip || '—'}</td>
                    </tr>
                  ))}
                  {rows.length === 0 &&
                    <tr><td colSpan="7" className="muted">No audit entries match this filter.</td></tr>}
                </tbody>
              </table>
            </div>
          )}
          {rows && rows.length >= limit && (
            <p className="muted">Showing the {limit} most recent matching entries — narrow the
              filters above, or use Download CSV for the complete range with no row cap.</p>
          )}
        </div>
      </div>
    );
  }
}

export default AuditLog;
