import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import api from '../api';
import useSocketStore from '../store/socketStore';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png'
});

const greenIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
});
const yellowIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-yellow.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
});

export default function MapPage() {
  const [liveCouriers, setLiveCouriers] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  // Ref stores the growing track per courier: { courier_id: [[lat,lng],...] }
  const tracksRef = useRef({});
  const [tracks, setTracks] = useState({});
  const { courierLocations, courierStatuses } = useSocketStore();

  // Load initial list every 15s
  useEffect(() => {
    loadLive();
    const interval = setInterval(loadLive, 15000);
    return () => clearInterval(interval);
  }, []);

  async function loadLive() {
    try {
      const { data } = await api.get('/track/live');
      setLiveCouriers(data.data);
      // Seed positions for couriers not yet tracked
      data.data.forEach(c => {
        const id = c.courier._id;
        if (!tracksRef.current[id] && c.last_position) {
          tracksRef.current[id] = [[c.last_position.lat, c.last_position.lng]];
        }
      });
      setTracks({ ...tracksRef.current });
    } catch (err) {
      console.error(err);
    }
  }

  // Every socket location update: append to that courier's track
  useEffect(() => {
    let changed = false;
    Object.entries(courierLocations).forEach(([courierId, loc]) => {
      const existing = tracksRef.current[courierId] || [];
      const last = existing[existing.length - 1];
      if (last && last[0] === loc.lat && last[1] === loc.lng) return;
      tracksRef.current[courierId] = [...existing, [loc.lat, loc.lng]];
      changed = true;
    });
    if (changed) setTracks({ ...tracksRef.current });
  }, [courierLocations]);

  // When a courier is selected, load full historical track from DB to seed
  async function selectCourier(c) {
    const id = c.courier._id;
    setSelectedId(id);
    if (c.active_order) {
      try {
        const { data } = await api.get(`/orders/${c.active_order._id}/track`);
        const dbPoints = data.data.map(p => [p.lat, p.lng]);
        if (dbPoints.length > 0) {
          tracksRef.current[id] = dbPoints;
          setTracks({ ...tracksRef.current });
        }
      } catch {}
    }
  }

  // Merge live courier list with latest socket positions and statuses
  const mergedCouriers = liveCouriers.map(c => ({
    ...c,
    last_position: courierLocations[c.courier._id]
      ? { lat: courierLocations[c.courier._id].lat, lng: courierLocations[c.courier._id].lng }
      : c.last_position,
    courier: { ...c.courier, status: courierStatuses[c.courier._id] || c.courier.status }
  }));

  const center = [39.041546563420525, 65.58529558381123]; // Tashkent

  return (
    <div style={{ display: 'flex', height: '100%', flexDirection: 'column' }}>
      <div style={{ padding: '12px 24px', background: 'white', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: 16 }}>
        <h1 style={{ fontSize: 18, fontWeight: 700 }}>Live Map</h1>
        <span style={{ fontSize: 13, color: '#6b7280' }}>
          {mergedCouriers.filter(c => c.last_position).length} kuryerlar xaritada
        </span>
        <span style={{ background: '#ef444422', color: '#ef4444', fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 99 }}>
          🔴 LIVE
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 16, fontSize: 13 }}>
          <span>🟢 Online</span>
          <span>🟡 Band</span>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex' }}>
        <MapContainer center={center} zoom={12} style={{ flex: 1 }}>
          <TileLayer
            attribution='&copy; OpenStreetMap contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {/* All courier markers with live positions */}
          {mergedCouriers.map(c => {
            if (!c.last_position) return null;
            const isSelected = selectedId === c.courier._id;
            const icon = c.courier.status === 'busy' ? yellowIcon : greenIcon;
            const track = tracks[c.courier._id] || [];
            return (
              <React.Fragment key={c.courier._id}>
                {/* Route polyline for selected courier */}
                {isSelected && track.length > 1 && (
                  <Polyline positions={track} color="#3b82f6" weight={4} opacity={0.85} />
                )}
                <Marker
                  position={[c.last_position.lat, c.last_position.lng]}
                  icon={icon}
                  eventHandlers={{ click: () => selectCourier(c) }}
                >
                  <Popup>
                    <strong>{c.courier.name}</strong><br />
                    {c.courier.vehicle_type} · <span style={{ color: c.courier.status === 'busy' ? '#f59e0b' : '#10b981' }}>{c.courier.status}</span><br />
                    {c.active_order && <span>📦 {c.active_order.status}<br />{c.active_order.dropoff_address || ''}</span>}
                    {track.length > 0 && <span><br />📍 {track.length} GPS nuqta</span>}
                  </Popup>
                </Marker>
              </React.Fragment>
            );
          })}
        </MapContainer>

        {/* Sidebar */}
        <div style={{ width: 270, background: 'white', borderLeft: '1px solid #e5e7eb', overflow: 'auto' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb', fontWeight: 600, fontSize: 13 }}>
            Faol kuryerlar ({mergedCouriers.length})
          </div>
          {mergedCouriers.map(c => {
            const isSelected = selectedId === c.courier._id;
            const track = tracks[c.courier._id] || [];
            const isBusy = c.courier.status === 'busy';
            return (
              <div
                key={c.courier._id}
                onClick={() => selectCourier(c)}
                style={{
                  padding: '12px 16px',
                  borderBottom: '1px solid #f3f4f6',
                  cursor: 'pointer',
                  background: isSelected ? '#eff6ff' : 'white',
                  borderLeft: isSelected ? '3px solid #3b82f6' : '3px solid transparent'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{c.courier.name}</div>
                  {isBusy && (
                    <span style={{ background: '#fef3c7', color: '#92400e', fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 99 }}>
                      BAND
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                  {c.courier.vehicle_type} ·{' '}
                  <span style={{ color: isBusy ? '#f59e0b' : '#10b981' }}>{c.courier.status}</span>
                </div>
                {c.active_order && (
                  <div style={{ fontSize: 11, color: '#3b82f6', marginTop: 4 }}>
                    📦 {c.active_order.status}
                    {c.active_order.dropoff_address && (
                      <div style={{ color: '#6b7280', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        → {c.active_order.dropoff_address}
                      </div>
                    )}
                  </div>
                )}
                {track.length > 0 && (
                  <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 4 }}>
                    📍 {track.length} GPS nuqta
                  </div>
                )}
                {!c.last_position && (
                  <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>GPS ma'lumoti yo'q</div>
                )}
              </div>
            );
          })}
          {mergedCouriers.length === 0 && (
            <div style={{ padding: 24, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
              Faol kuryerlar yo'q
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
