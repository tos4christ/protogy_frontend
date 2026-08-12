import React from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import api from '../api';

const COLORS = { online: '#2f9e44', offline: '#d64545', never_reported: '#8a97a5' };

// FEEDER MAP — every feeder with coordinates plotted on the national grid,
// coloured by live connectivity. Auto-refreshes every 30s.
class MapView extends React.Component {
  constructor(props) {
    super(props);
    this.state = { data: null, disco: 'all', discos: [], error: null };
    this.load = this.load.bind(this);
  }

  componentDidMount() {
    api.listDiscos().then((discos) => this.setState({ discos })).catch(() => {});
    this.load();
    this.timer = setInterval(() => { if (!document.hidden) this.load(); }, 30000);
  }
  componentWillUnmount() { clearInterval(this.timer); }

  load() {
    api.meterStatus('all', this.state.disco)
      .then((data) => this.setState({ data, error: null }))
      .catch((e) => this.setState({ error: e.message }));
  }

  render() {
    const { data, disco, discos, error } = this.state;
    const meters = data ? data.meters : [];
    const placed = meters.filter((m) => m.latitude != null && m.longitude != null);
    const unplaced = meters.length - placed.length;
    return (
      <div className="card map-card">
        <h2>Feeder Map <span className="live-dot" title="Auto-refreshing"></span></h2>
        <div className="controls">
          <label>Disco
            <select value={disco}
              onChange={(e) => this.setState({ disco: e.target.value }, this.load)}>
              <option value="all">All Discos</option>
              {discos.map((d) => <option key={d.disco} value={d.disco}>{d.disco}</option>)}
            </select>
          </label>
          <span className="map-legend">
            <i style={{ background: COLORS.online }}></i> Online
            <i style={{ background: COLORS.offline }}></i> Offline
            <i style={{ background: COLORS.never_reported }}></i> Never reported
          </span>
        </div>
        {error && <div className="error">{error}</div>}
        <div className="map-wrap">
          <MapContainer center={[9.06, 7.49]} zoom={6} style={{ height: '100%', width: '100%' }}>
            <TileLayer
              attribution='&copy; OpenStreetMap contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            {placed.map((m) => (
              <CircleMarker key={m.meter_id}
                center={[+m.latitude, +m.longitude]}
                radius={9}
                pathOptions={{
                  color: '#ffffff', weight: 2,
                  fillColor: COLORS[m.connectivity] || COLORS.never_reported,
                  fillOpacity: 0.95,
                }}>
                <Tooltip direction="top" offset={[0, -6]}>
                  {(m.feeder_name || m.meter_id) + ' — ' + m.connectivity}
                </Tooltip>
                <Popup>
                  <b>{m.feeder_name || m.meter_id}</b><br />
                  {m.disco || 'No Disco'} · {m.location || 'No location'}<br />
                  Status: <b style={{ color: COLORS[m.connectivity] }}>{m.connectivity}</b><br />
                  {m.voltage_l1 != null && (<span>
                    V: {Number(m.voltage_l1).toFixed(1)} / {Number(m.voltage_l2).toFixed(1)} / {Number(m.voltage_l3).toFixed(1)}<br />
                    P: {m.active_power != null ? Number(m.active_power).toFixed(1) : '—'} ·
                    f: {m.frequency != null ? Number(m.frequency).toFixed(2) + ' Hz' : '—'}<br />
                  </span>)}
                  Last reading: {m.last_reading_at ? new Date(m.last_reading_at).toLocaleString() : 'never'}
                </Popup>
              </CircleMarker>
            ))}
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
