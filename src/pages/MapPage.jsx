import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import api from '../api';
import useSocketStore from '../store/socketStore';

// Fix default icons
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
  const [selectedCourier, setSelectedCourier] = useState(null);
  const [trackPoints, setTrackPoints] = useState([]);
  const { courierLocations, courierStatuses } = useSocketStore();

  useEffect(() => {
    loadLive();
    const interval = setInterval(loadLive, 10000);
    return () => clearInterval(interval);
  }, []);

  async function loadLive() {
    try {
      const { data } = await api.get('/track/live');
      setLiveCouriers(data.data);
    } catch (err) {
      console.error(err);
    }
  }

  async function selectCourier(courier) {
    setSelectedCourier(courier);
    if (courier.active_order) {
      try {
        const { data } = await api.get(`/orders/${courier.active_order._id}/track`);
        setTrackPoints(data.data.map(p => [p.lat, p.lng]));
      } catch {
        setTrackPoints([]);
      }
    } else {
      setTrackPoints([]);
    }
  }

  // Merge live positions with socket updates
  const mergedCouriers = liveCouriers.map(c => {
    const socketLoc = courierLocations[c.courier._id];
    const socketStatus = courierStatuses[c.courier._id];
    return {
      ...c,
      last_position: socketLoc ? { lat: socketLoc.lat, lng: socketLoc.lng } : c.last_position,
      courier: { ...c.courier, status: socketStatus || c.courier.status }
    };
  });

  const center = [41.2995, 69.2401]; // Tashkent

  return (
    <div style={{ display: 'flex', height: '100%', flexDirection: 'column' }}>
      <div style={{ padding: '12px 24px', background: 'white', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: 16 }}>
        <h1 style={{ fontSize: 18, fontWeight: 700 }}>Live Map</h1>
        <span style={{ fontSize: 13, color: '#6b7280' }}>
          {mergedCouriers.filter(c => c.last_position).length} couriers on map
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 16, fontSize: 13 }}>
          <span>🟢 Online</span>
          <span>🟡 Busy</span>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex' }}>
        <MapContainer center={center} zoom={12} style={{ flex: 1 }}>
          <TileLayer
            attribution='&copy; OpenStreetMap contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {mergedCouriers.map(c => {
            if (!c.last_position) return null;
            const icon = c.courier.status === 'busy' ? yellowIcon : greenIcon;
            return (
              <Marker
                key={c.courier._id}
                position={[c.last_position.lat, c.last_position.lng]}
                icon={icon}
                eventHandlers={{ click: () => selectCourier(c) }}
              >
                <Popup>
                  <strong>{c.courier.name}</strong><br />
                  {c.courier.vehicle_type} · {c.courier.status}<br />
                  {c.active_order && <span>Order: {c.active_order.status}</span>}
                </Popup>
              </Marker>
            );
          })}

          {trackPoints.length > 1 && (
            <Polyline positions={trackPoints} color="#3b82f6" weight={3} />
          )}
        </MapContainer>

        {/* Sidebar */}
        <div style={{ width: 260, background: 'white', borderLeft: '1px solid #e5e7eb', overflow: 'auto' }}>
          <div style={{ padding: 16, borderBottom: '1px solid #e5e7eb', fontWeight: 600, fontSize: 13 }}>
            Active Couriers ({mergedCouriers.length})
          </div>
          {mergedCouriers.map(c => (
            <div
              key={c.courier._id}
              onClick={() => selectCourier(c)}
              style={{
                padding: '12px 16px',
                borderBottom: '1px solid #f3f4f6',
                cursor: 'pointer',
                background: selectedCourier?.courier._id === c.courier._id ? '#eff6ff' : 'white'
              }}
            >
              <div style={{ fontWeight: 600, fontSize: 13 }}>{c.courier.name}</div>
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                {c.courier.vehicle_type} ·{' '}
                <span style={{ color: c.courier.status === 'online' ? '#10b981' : '#f59e0b' }}>
                  {c.courier.status}
                </span>
              </div>
              {c.active_order && (
                <div style={{ fontSize: 11, color: '#3b82f6', marginTop: 4 }}>
                  📦 {c.active_order.status}
                </div>
              )}
              {!c.last_position && (
                <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>No GPS data</div>
              )}
            </div>
          ))}
          {mergedCouriers.length === 0 && (
            <div style={{ padding: 24, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
              No active couriers
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
