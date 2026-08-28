import React from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import api from '../api';

const CONN_COLORS = { online: '#2f9e44', offline: '#d64545', never_reported: '#8a97a5' };
const BAND_COLORS = { A: '#1653a1', B: '#2f9e44', C: '#e8a80c', D: '#d9720a', E: '#d64545' };
const SBT_COLORS = { met: '#2f9e44', notMet: '#d64545', unknown: '#8a97a5' };
const yesterday = () => { const d = new Date(); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0, 10); };

// FEEDER MAP — every feeder with coordinates plotted on the national grid.
// Three colour modes so this single map covers connectivity ops, Band
// planning, and regulatory compliance without needing three separate views:
//  - Connectivity: online / offline / never reported (original behaviour)
//  - Band: NERC tariff Band A-E, at a glance across the whole fleet
//  - SBT Compliance: Met / Not Met against that Band's minimum hours
//    (uses the last completed day, same as the SBT Scorecard)
// Auto-refreshes every 30s in Connectivity mode; SBT mode refreshes less
// often since it's a daily figure.
class MapView extends React.Component {
  constructor(props) {
    super(props);
    this.state = { data: null, sbt: null, disco: 'all', discos: [], error: null, mode: 'connectivity' };
    this.load = this.load.bind(this);
  }

  componentDidMount() {
    api.listDiscos().then((discos) => this.setState({ discos })).catch(() => {});
    this.load();
    this.timer = setInterval(() => { if (!document.hidden) this.load(); }, 30000);
  }
  componentWillUnmount() { clearInterval(this.timer); }

  load() {
    const { disco, mode } = this.state;
    // limit=all — this map must show every feeder, not just one page, even
    // with the pagination the Feeder Status view now uses.
    api.meterStatus('all', disco, 'all', 1, 'all')
      .then((data) => this.setState({ data, error: null }))
      .catch((e) => this.setState({ error: e.message }));
    if (mode === 'sbt' && !this.state.sbt) {
      api.sbtScorecard(yesterday(), disco).then((sbt) => this.setState({ sbt })).catch(() => {});
    }
  }

  setMode(mode) {
    this.setState({ mode }, () => {
      if (mode === 'sbt' && !this.state.sbt) {
        api.sbtScorecard(yesterday(), this.state.disco).then((sbt) => this.setState({ sbt })).catch(() => {});
      }
    });
  }

  colorFor(m, sbtByMeter) {
    const { mode } = this.state;
    if (mode === 'band') return BAND_COLORS[m.tariff_band] || CONN_COLORS.never_reported;
    if (mode === 'sbt') {
      const s = sbtByMeter[m.meter_id];
      if (!s) return SBT_COLORS.unknown;
      return s.met ? SBT_COLORS.met : SBT_COLORS.notMet;
    }
    return CONN_COLORS[m.connectivity] || CONN_COLORS.never_reported;
  }

  render() {
    const { data, sbt, disco, discos, error, mode } = this.state;
    const meters = data ? data.meters : [];
    const placed = meters.filter((m) => m.latitude != null && m.longitude != null);
    const unplaced = meters.length - placed.length;
    const sbtByMeter = {};
    if (sbt) sbt.feeders.forEach((f) => { sbtByMeter[f.meterId] = f; });

    return (
      <div className="card map-card">
        <h2>Feeder Map <span className="live-dot" title="Auto-refreshing"></span></h2>
        <div className="controls">
          <label>Disco
            <select value={disco}
              onChange={(e) => this.setState({ disco: e.target.value, sbt: null }, this.load)}>
              <option value="all">All Discos</option>
              {discos.map((d) => <option key={d.disco} value={d.disco}>{d.disco}</option>)}
            </select>
          </label>
          <label>Colour by
            <select value={mode} onChange={(e) => this.setMode(e.target.value)}>
              <option value="connectivity">Connectivity</option>
              <option value="band">Tariff Band</option>
              <option value="sbt">SBT Compliance ({yesterday()})</option>
            </select>
          </label>
          {mode === 'connectivity' && (
            <span className="map-legend">
              <i style={{ background: CONN_COLORS.online }}></i> Online
              <i style={{ background: CONN_COLORS.offline }}></i> Offline
              <i style={{ background: CONN_COLORS.never_reported }}></i> Never reported
            </span>
          )}
          {mode === 'band' && (
            <span className="map-legend">
              {Object.entries(BAND_COLORS).map(([b, c]) => (
                <React.Fragment key={b}><i style={{ background: c }}></i> Band {b}</React.Fragment>
              ))}
            </span>
          )}
          {mode === 'sbt' && (
            <span className="map-legend">
              <i style={{ background: SBT_COLORS.met }}></i> Met
              <i style={{ background: SBT_COLORS.notMet }}></i> Not Met
              <i style={{ background: SBT_COLORS.unknown }}></i> No Band / no data
            </span>
          )}
        </div>
        {error && <div className="error">{error}</div>}
        <div className="map-wrap">
          <MapContainer center={[9.06, 7.49]} zoom={6} style={{ height: '100%', width: '100%' }}>
            <TileLayer
              attribution='&copy; OpenStreetMap contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            {placed.map((m) => {
              const s = sbtByMeter[m.meter_id];
              return (
                <CircleMarker key={m.meter_id}
                  center={[+m.latitude, +m.longitude]}
                  radius={9}
                  pathOptions={{
                    color: '#ffffff', weight: 2,
                    fillColor: this.colorFor(m, sbtByMeter),
                    fillOpacity: 0.95,
                  }}>
                  <Tooltip direction="top" offset={[0, -6]}>
                    {(m.feeder_name || m.meter_id) + ' — ' + m.connectivity}
                  </Tooltip>
                  <Popup>
                    <b>{m.feeder_name || m.meter_id}</b><br />
                    {m.disco || 'No Disco'} · {m.location || 'No location'}<br />
                    Band: <b>{m.tariff_band || '—'}</b><br />
                    Status: <b style={{ color: CONN_COLORS[m.connectivity] }}>{m.connectivity}</b><br />
                    {mode === 'sbt' && (
                      <span>SBT ({yesterday()}): <b style={{ color: s ? (s.met ? SBT_COLORS.met : SBT_COLORS.notMet) : SBT_COLORS.unknown }}>
                        {s ? (s.met ? 'Met' : `Not Met (${s.shortfallHours}h short)`) : 'No data'}
                      </b><br /></span>
                    )}
                    {m.voltage_l1 != null && (<span>
                      V: {Number(m.voltage_l1).toFixed(1)} / {Number(m.voltage_l2).toFixed(1)} / {Number(m.voltage_l3).toFixed(1)}<br />
                      P: {m.active_power != null ? Number(m.active_power).toFixed(1) : '—'} ·
                      f: {m.frequency != null ? Number(m.frequency).toFixed(2) + ' Hz' : '—'}<br />
                    </span>)}
                    Last reading: {m.last_reading_at ? new Date(m.last_reading_at).toLocaleString() : 'never'}
                  </Popup>
                </CircleMarker>
              );
            })}
          </MapContainer>
        </div>
        <p className="muted">
          {placed.length} feeder(s) on the map.
          {unplaced > 0 && ` ${unplaced} feeder(s) have no coordinates yet — re-onboard them with latitude/longitude to place them.`}
        </p>
      </div>
    );
  }
}

export default MapView;
