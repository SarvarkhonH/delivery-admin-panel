import React, { useEffect, useState, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import api from '../api';
import useSocketStore from '../store/socketStore';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png'
});

const STATUS_BADGE = {
  pending: 'badge-gray', assigned: 'badge-blue', picked_up: 'badge-orange',
  on_way: 'badge-yellow', delivered: 'badge-green', cancelled: 'badge-red'
};

function fmt(n) { return new Intl.NumberFormat('uz-UZ').format(Math.round(n || 0)) + " so'm"; }

// ── Geocode using OpenStreetMap Nominatim (free, no API key) ──────────────────
async function geocodeAddress(query) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5`;
  const res = await fetch(url, { headers: { 'Accept-Language': 'uz,ru,en' } });
  const data = await res.json();
  if (!data.length) throw new Error(`Manzil topilmadi: "${query}"`);
  return data.map(d => ({ lat: parseFloat(d.lat), lng: parseFloat(d.lon), display: d.display_name }));
}

// ── Address field with search + suggestions ───────────────────────────────────
function AddressInput({ label, value, resolved, onTextChange, onSelect, placeholder }) {
  const [searching, setSearching]   = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [error, setError]           = useState('');

  async function search() {
    if (!value.trim()) return;
    setSearching(true);
    setError('');
    setSuggestions([]);
    try {
      const results = await geocodeAddress(value);
      setSuggestions(results);
    } catch (err) {
      setError(err.message);
    } finally {
      setSearching(false);
    }
  }

  function pick(item) {
    onSelect(item.lat, item.lng, item.display);
    setSuggestions([]);
  }

  return (
    <div className="form-group">
      <label className="form-label">{label}</label>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          className="input"
          value={value}
          onChange={e => { onTextChange(e.target.value); }}
          onKeyDown={e => e.key === 'Enter' && search()}
          placeholder={placeholder}
          style={{ flex: 1 }}
        />
        <button
          type="button"
          className="btn btn-secondary"
          onClick={search}
          disabled={searching || !value.trim()}
          style={{ flexShrink: 0 }}
        >
          {searching ? '⏳' : '🔍'}
        </button>
      </div>

      {/* Suggestions dropdown */}
      {suggestions.length > 0 && (
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, marginTop: 4, overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
          {suggestions.map((s, i) => (
            <div
              key={i}
              onClick={() => pick(s)}
              style={{
                padding: '10px 12px', cursor: 'pointer', fontSize: 13,
                borderBottom: i < suggestions.length - 1 ? '1px solid #f3f4f6' : 'none',
                background: 'white'
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#f8f9fa'}
              onMouseLeave={e => e.currentTarget.style.background = 'white'}
            >
              {s.display}
            </div>
          ))}
        </div>
      )}

      {error && <div style={{ fontSize: 12, color: '#ef4444', marginTop: 4 }}>{error}</div>}
      {resolved && (
        <div style={{ fontSize: 12, color: '#10b981', marginTop: 4 }}>
          ✅ {resolved.lat.toFixed(5)}, {resolved.lng.toFixed(5)}
        </div>
      )}
    </div>
  );
}


const EMPTY_FORM = {
  client_phone:     '',
  items:            '',
  food_price:       '',
  dropoff_address:  '',     // client delivery address (text only)
  restaurant_id:    '',     // selected restaurant _id (pickup point)
  courier_id:       ''
};

export default function Orders() {
  const [orders, setOrders]       = useState([]);
  const [total, setTotal]         = useState(0);
  const [page, setPage]           = useState(1);
  const [loading, setLoading]     = useState(true);
  const [filters, setFilters]     = useState({ status: '', courier_id: '', date_from: '', date_to: '' });
  const [couriers, setCouriers]       = useState([]);
  const [restaurants, setRestaurants] = useState([]);
  const [settings, setSettings]       = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [orderTrack, setOrderTrack]       = useState([]);
  const [assigning, setAssigning] = useState(false);
  const { courierLocations } = useSocketStore();
  const [assignCourierId, setAssignCourierId] = useState('');
  const [form, setForm]           = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [creating, setCreating]   = useState(false);

  useEffect(() => {
    load();
    api.get('/couriers?limit=100').then(r => setCouriers(r.data.data)).catch(() => {});
    api.get('/settings/pricing').then(r => setSettings(r.data.data)).catch(() => {});
    api.get('/restaurants').then(r => setRestaurants(r.data.data)).catch(() => {});
  }, [page, filters]);

  // Append real-time courier location to orderTrack when order is on_way
  useEffect(() => {
    if (!selectedOrder || selectedOrder.status !== 'on_way') return;
    const courierId = selectedOrder.courier_id?._id || selectedOrder.courier_id;
    if (!courierId) return;
    const loc = courierLocations[courierId];
    if (!loc) return;
    setOrderTrack(prev => {
      const last = prev[prev.length - 1];
      if (last && last[0] === loc.lat && last[1] === loc.lng) return prev;
      return [...prev, [loc.lat, loc.lng]];
    });
  }, [courierLocations]);

  async function load() {
    setLoading(true);
    try {
      const params = { page, limit: 20, ...filters };
      Object.keys(params).forEach(k => !params[k] && delete params[k]);
      const { data } = await api.get('/orders', { params });
      setOrders(data.data);
      setTotal(data.total);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function openOrder(order) {
    setSelectedOrder(order);
    setAssignCourierId(order.courier_id?._id || order.courier_id || '');
    try {
      const { data } = await api.get(`/orders/${order._id}/track`);
      setOrderTrack(data.data.map(p => [p.lat, p.lng]));
    } catch { setOrderTrack([]); }
  }

  async function createOrder() {
    if (!form.restaurant_id) {
      setFormError('Restoran tanlang');
      return;
    }
    if (!form.client_phone.trim()) {
      setFormError('Mijoz telefon raqami kiritilishi shart');
      return;
    }
    setFormError('');
    setCreating(true);
    try {
      const restaurant = restaurants.find(r => r._id === form.restaurant_id);
      const restaurantLabel = restaurant.name + (restaurant.address ? ', ' + restaurant.address : '');
      const payload = {
        client_phone:    form.client_phone.trim(),
        items:           form.items.trim(),
        food_price:      form.food_price ? Number(form.food_price) : 0,
        // Pickup = restaurant
        pickup_address:  restaurantLabel,
        pickup_lat:      restaurant.lat,
        pickup_lng:      restaurant.lng,
        // Dropoff = client delivery address (lat/lng = restaurant as map fallback)
        dropoff_address: form.dropoff_address.trim() || 'Mijoz manzili (kursyerga aytiladi)',
        dropoff_lat:     restaurant.lat,
        dropoff_lng:     restaurant.lng
      };
      if (form.courier_id) payload.courier_id = form.courier_id;
      await api.post('/orders', payload);
      setShowCreate(false);
      setForm(EMPTY_FORM);
      load();
    } catch (err) {
      setFormError(err.response?.data?.error || 'Buyurtma yaratilmadi');
    } finally {
      setCreating(false);
    }
  }

  async function assignCourier() {
    if (!assignCourierId) return;
    setAssigning(true);
    try {
      const { data } = await api.patch(`/orders/${selectedOrder._id}/assign`, { courier_id: assignCourierId });
      setSelectedOrder(data.data);
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Tayinlash muvaffaqiyatsiz');
    } finally {
      setAssigning(false);
    }
  }

  return (
    <div style={{ padding: 24 }}>
      <div className="page-header">
        <h1 className="page-title">Buyurtmalar</h1>
        <button className="btn btn-primary" onClick={() => { setShowCreate(true); setForm(EMPTY_FORM); setFormError(''); }}>
          + Yangi buyurtma
        </button>
      </div>

      {/* Filters */}
      <div className="filters">
        <select className="select" value={filters.status} onChange={e => { setFilters(f => ({ ...f, status: e.target.value })); setPage(1); }}>
          <option value="">Barcha statuslar</option>
          {['pending', 'assigned', 'picked_up', 'on_way', 'delivered', 'cancelled'].map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select className="select" value={filters.courier_id} onChange={e => { setFilters(f => ({ ...f, courier_id: e.target.value })); setPage(1); }}>
          <option value="">Barcha kuryer</option>
          {couriers.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
        </select>
        <input type="date" className="input" style={{ width: 150 }} value={filters.date_from}
          onChange={e => { setFilters(f => ({ ...f, date_from: e.target.value })); setPage(1); }} />
        <span style={{ color: '#6b7280' }}>—</span>
        <input type="date" className="input" style={{ width: 150 }} value={filters.date_to}
          onChange={e => { setFilters(f => ({ ...f, date_to: e.target.value })); setPage(1); }} />
        <span style={{ color: '#6b7280', fontSize: 13 }}>{total} buyurtma</span>
      </div>

      {/* Table */}
      <div className="card">
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Mijoz telefon</th>
                <th>Taom</th>
                <th>Yetkazish manzili</th>
                <th>Masofa</th>
                <th>Narx</th>
                <th>Kuryer</th>
                <th>Status</th>
                <th>Vaqt</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9}><div className="loading"><div className="spinner" /></div></td></tr>
              ) : orders.map(o => (
                <tr key={o._id} onClick={() => openOrder(o)}>
                  <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{o._id.slice(-6).toUpperCase()}</td>
                  <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{o.client_phone || '—'}</td>
                  <td style={{ fontSize: 12, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {o.items || '—'}
                  </td>
                  <td style={{ fontSize: 12, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {o.dropoff_address}
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {o.distance_km > 0 ? `${o.distance_km} km` : <span style={{ color: '#9ca3af' }}>—</span>}
                  </td>
                  <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                    {o.delivery_fee > 0 ? fmt(o.delivery_fee) : <span style={{ color: '#9ca3af' }}>Taxometr</span>}
                  </td>
                  <td>{o.courier_id?.name || <span style={{ color: '#9ca3af' }}>Tayinlanmagan</span>}</td>
                  <td><span className={`badge ${STATUS_BADGE[o.status]}`}>{o.status}</span></td>
                  <td style={{ fontSize: 11, color: '#6b7280', whiteSpace: 'nowrap' }}>
                    {new Date(o.created_at).toLocaleString()}
                  </td>
                </tr>
              ))}
              {!loading && orders.length === 0 && (
                <tr><td colSpan={9} style={{ textAlign: 'center', color: '#9ca3af', padding: 32 }}>Buyurtmalar yo'q</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {total > 20 && (
          <div className="pagination">
            <button className="btn btn-sm btn-secondary" disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Oldingi</button>
            <span style={{ fontSize: 13, color: '#6b7280' }}>Sahifa {page} / {Math.ceil(total / 20)}</span>
            <button className="btn btn-sm btn-secondary" disabled={page * 20 >= total} onClick={() => setPage(p => p + 1)}>Keyingi →</button>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          CREATE ORDER MODAL
          ═══════════════════════════════════════════════════════════════════ */}
      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal" style={{ maxWidth: 600 }} onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">Yangi buyurtma</h2>

            {formError && <div className="alert alert-error">{formError}</div>}

            {/* Client info */}
            <div style={{ background: '#eff6ff', borderRadius: 12, padding: 16, marginBottom: 16 }}>
              <div style={{ fontWeight: 700, marginBottom: 12, color: '#1e40af' }}>👤 Mijoz ma'lumotlari</div>

              <div className="form-group">
                <label className="form-label">Telefon raqam *</label>
                <input
                  className="input"
                  value={form.client_phone}
                  onChange={e => setForm(f => ({ ...f, client_phone: e.target.value }))}
                  placeholder="+998 90 123 45 67"
                  type="tel"
                />
              </div>
            </div>

            {/* Food info */}
            <div style={{ background: '#fffbeb', borderRadius: 12, padding: 16, marginBottom: 16 }}>
              <div style={{ fontWeight: 700, marginBottom: 12, color: '#92400e' }}>🍔 Buyurtma tarkibi</div>

              <div className="form-group">
                <label className="form-label">Taom nomlari</label>
                <input
                  className="input"
                  value={form.items}
                  onChange={e => setForm(f => ({ ...f, items: e.target.value }))}
                  placeholder="2x Burger, 1x Cola, 1x Fries"
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Taom narxi (so'm) <span style={{ fontWeight: 400, color: '#9ca3af' }}>ixtiyoriy</span></label>
                <input
                  className="input"
                  type="number"
                  min="0"
                  value={form.food_price}
                  onChange={e => setForm(f => ({ ...f, food_price: e.target.value }))}
                  placeholder="45000"
                />
              </div>
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 8 }}>
                💡 Yetkazish narxi yetkazish paytida GPS taxometri asosida hisoblanadi
              </div>
            </div>

            {/* Restaurant selector — dropoff */}
            <div style={{ background: '#fff1f2', borderRadius: 12, padding: 16, marginBottom: 16 }}>
              <div style={{ fontWeight: 700, marginBottom: 12, color: '#b91c1c' }}>🍔 Restoran *</div>
              <select
                className="select w-full"
                value={form.restaurant_id}
                onChange={e => setForm(f => ({ ...f, restaurant_id: e.target.value }))}
              >
                <option value="">— Restoran tanlang —</option>
                {restaurants.map(r => (
                  <option key={r._id} value={r._id}>
                    {r.name}{r.address ? ' · ' + r.address : ''}
                  </option>
                ))}
              </select>
              {form.restaurant_id && (() => {
                const r = restaurants.find(x => x._id === form.restaurant_id);
                return r ? (
                  <div style={{ fontSize: 12, color: '#6b7280', marginTop: 6, fontFamily: 'monospace' }}>
                    📍 {r.lat.toFixed(5)}, {r.lng.toFixed(5)}
                  </div>
                ) : null;
              })()}
              {restaurants.length === 0 && (
                <div style={{ fontSize: 12, color: '#ef4444', marginTop: 6 }}>
                  Restoranlar yo'q — avval <strong>Restoranlar</strong> sahifasida qo'shing
                </div>
              )}
            </div>

            {/* Client delivery address */}
            <div style={{ background: '#eff6ff', borderRadius: 12, padding: 16, marginBottom: 16 }}>
              <div style={{ fontWeight: 700, marginBottom: 12, color: '#1e40af' }}>📍 Yetkazish manzili *</div>
              <input
                className="input"
                value={form.dropoff_address}
                onChange={e => setForm(f => ({ ...f, dropoff_address: e.target.value }))}
                placeholder="Ko'cha, uy raqami, orientir..."
              />
            </div>

            {/* Courier assignment */}
            <div className="form-group" style={{ marginTop: 16 }}>
              <label className="form-label">Kuryer tayinlash <span style={{ fontWeight: 400, color: '#9ca3af' }}>ixtiyoriy</span></label>
              <select
                className="select w-full"
                value={form.courier_id}
                onChange={e => setForm(f => ({ ...f, courier_id: e.target.value }))}
              >
                <option value="">Tayinlanmagan (pending holat)</option>
                {couriers.filter(c => c.is_active && c.status !== 'busy').map(c => (
                  <option key={c._id} value={c._id}>
                    {c.name} · {c.vehicle_type} · {c.status}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
              <button className="btn btn-secondary" onClick={() => setShowCreate(false)}>Bekor qilish</button>
              <button
                className="btn btn-primary"
                onClick={createOrder}
                disabled={creating || !form.restaurant_id || !form.client_phone.trim()}
              >
                {creating ? 'Yaratilmoqda...' : 'Buyurtma yaratish'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          ORDER DETAIL MODAL
          ═══════════════════════════════════════════════════════════════════ */}
      {selectedOrder && (
        <div className="modal-overlay" onClick={() => setSelectedOrder(null)}>
          <div className="modal" style={{ maxWidth: 700 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700 }}>
                #{selectedOrder._id.slice(-8).toUpperCase()}
              </h2>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span className={`badge ${STATUS_BADGE[selectedOrder.status]}`}>{selectedOrder.status}</span>
                <button className="btn btn-sm btn-secondary" onClick={() => setSelectedOrder(null)}>✕</button>
              </div>
            </div>

            {/* Client + Food */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div style={{ background: '#eff6ff', borderRadius: 10, padding: 14 }}>
                <div style={{ fontSize: 11, color: '#3b82f6', fontWeight: 600, marginBottom: 4 }}>📞 MIJOZ</div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{selectedOrder.client_phone || '—'}</div>
                {selectedOrder.client_phone && (
                  <a href={`tel:${selectedOrder.client_phone}`} style={{ fontSize: 12, color: '#3b82f6' }}>Qo'ng'iroq qilish →</a>
                )}
              </div>
              <div style={{ background: '#fffbeb', borderRadius: 10, padding: 14 }}>
                <div style={{ fontSize: 11, color: '#92400e', fontWeight: 600, marginBottom: 4 }}>🍔 BUYURTMA</div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{selectedOrder.items || '—'}</div>
                {selectedOrder.food_price > 0 && (
                  <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
                    Taom narxi: {fmt(selectedOrder.food_price)}
                  </div>
                )}
              </div>
            </div>

            {/* Route */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div style={{ background: '#f0fdf4', borderRadius: 10, padding: 14 }}>
                <div style={{ fontSize: 11, color: '#10b981', fontWeight: 600, marginBottom: 4 }}>🍔 RESTORAN (OLIB KETISH)</div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>
                  {selectedOrder.pickup_address || <span style={{ color: '#9ca3af' }}>—</span>}
                </div>
                {selectedOrder.pickup_lat && (
                  <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
                    {selectedOrder.pickup_lat.toFixed(5)}, {selectedOrder.pickup_lng.toFixed(5)}
                  </div>
                )}
              </div>
              <div style={{ background: '#eff6ff', borderRadius: 10, padding: 14 }}>
                <div style={{ fontSize: 11, color: '#3b82f6', fontWeight: 600, marginBottom: 4 }}>📍 YETKAZISH MANZILI</div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{selectedOrder.dropoff_address}</div>
              </div>
            </div>

            {/* Price breakdown */}
            <div style={{ background: '#f8f9fa', borderRadius: 12, padding: 16, marginBottom: 16 }}>
              <div style={{ fontWeight: 700, marginBottom: 12 }}>
                {selectedOrder.status === 'delivered' ? '💰 Yakuniy hisob' : '⏱️ Taxometr (yetkazishda hisoblanadi)'}
              </div>
              {selectedOrder.delivery_fee > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                  {[
                    { label: 'Masofa', value: `${selectedOrder.distance_km} km` },
                    { label: 'Mijoz to\'ladi (naqd)', value: fmt(selectedOrder.client_price || selectedOrder.pricing_snapshot?.client_price) },
                    { label: 'Yetkazish narxi (taxometr)', value: fmt(selectedOrder.delivery_fee) },
                    { label: 'Platforma komissiyasi', value: fmt(selectedOrder.platform_fee), color: '#8b5cf6' },
                    {
                      label: 'Hamyon o\'zgarishi',
                      value: (selectedOrder.wallet_delta >= 0 ? '+' : '') + fmt(selectedOrder.wallet_delta),
                      color: selectedOrder.wallet_delta >= 0 ? '#10b981' : '#ef4444'
                    },
                    {
                      label: 'Kompaniya foydasi',
                      value: (selectedOrder.company_profit >= 0 ? '+' : '') + fmt(selectedOrder.company_profit),
                      color: selectedOrder.company_profit >= 0 ? '#10b981' : '#ef4444'
                    }
                  ].map(item => (
                    <div key={item.label} style={{ background: 'white', borderRadius: 8, padding: 10 }}>
                      <div style={{ fontSize: 11, color: '#6b7280' }}>{item.label}</div>
                      <div style={{ fontWeight: 700, color: item.color || '#111827' }}>{item.value}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ color: '#9ca3af', fontSize: 13 }}>
                  Narx yetkazish paytida GPS masofasiga qarab hisoblanadi
                </div>
              )}
            </div>

            {/* Assign / Reassign courier */}
            {['pending', 'assigned'].includes(selectedOrder.status) && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                <select className="select" style={{ flex: 1 }}
                  value={assignCourierId} onChange={e => setAssignCourierId(e.target.value)}>
                  <option value="">Kuryer tanlang</option>
                  {couriers.filter(c => c.is_active).map(c => (
                    <option key={c._id} value={c._id}>{c.name} · {c.vehicle_type} · {c.status}</option>
                  ))}
                </select>
                <button className="btn btn-primary" onClick={assignCourier} disabled={assigning || !assignCourierId}>
                  {assigning ? '...' : selectedOrder.status === 'assigned' ? 'Qayta tayinlash' : 'Tayinlash'}
                </button>
              </div>
            )}

            {/* Timestamps */}
            <div style={{ fontSize: 12, color: '#9ca3af', lineHeight: 1.8, marginBottom: 16 }}>
              {[
                ['Yaratildi', selectedOrder.created_at],
                ['Tayinlandi', selectedOrder.assigned_at],
                ['Olib ketildi', selectedOrder.picked_up_at],
                ['Yo\'lda', selectedOrder.on_way_at],
                ['Yetkazildi', selectedOrder.delivered_at],
                ['Bekor qilindi', selectedOrder.cancelled_at]
              ].filter(([, date]) => date).map(([label, date]) => (
                <span key={label} style={{ marginRight: 16 }}>
                  <strong>{label}:</strong> {new Date(date).toLocaleString()}
                </span>
              ))}
            </div>

            {/* Route map — show if there are GPS coords or track points */}
            {(selectedOrder.dropoff_lat || orderTrack.length > 0) && (() => {
              const center = orderTrack.length > 0
                ? orderTrack[orderTrack.length - 1]
                : [selectedOrder.pickup_lat || selectedOrder.dropoff_lat, selectedOrder.pickup_lng || selectedOrder.dropoff_lng];
              const isLive = selectedOrder.status === 'on_way';
              return (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>🗺️ Marshut</span>
                    {isLive && (
                      <span style={{ background: '#ef4444', color: 'white', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 99 }}>
                        🔴 LIVE
                      </span>
                    )}
                    {orderTrack.length > 0 && (
                      <span style={{ fontSize: 12, color: '#6b7280' }}>{orderTrack.length} nuqta</span>
                    )}
                  </div>
                  <div style={{ height: 300, borderRadius: 12, overflow: 'hidden' }}>
                    <MapContainer
                      center={center}
                      zoom={14}
                      style={{ height: '100%' }}
                      zoomControl={true}
                    >
                      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                      {selectedOrder.pickup_lat && (
                        <Marker position={[selectedOrder.pickup_lat, selectedOrder.pickup_lng]} />
                      )}
                      {selectedOrder.dropoff_lat && (
                        <Marker position={[selectedOrder.dropoff_lat, selectedOrder.dropoff_lng]} />
                      )}
                      {orderTrack.length > 1 && (
                        <Polyline positions={orderTrack} color="#3b82f6" weight={4} opacity={0.85} />
                      )}
                      {orderTrack.length > 0 && (
                        <Marker position={orderTrack[orderTrack.length - 1]} />
                      )}
                    </MapContainer>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
