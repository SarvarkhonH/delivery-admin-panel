import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

const STATUS_BADGE = {
  pending: 'badge-gray',
  assigned: 'badge-blue',
  picked_up: 'badge-orange',
  on_way: 'badge-yellow',
  delivered: 'badge-green',
  cancelled: 'badge-red'
};

function fmt(n) {
  return new Intl.NumberFormat('uz-UZ').format(Math.round(n || 0)) + " so'm";
}

// ── Single metric card ────────────────────────────────────────────────────────
function MetricCard({ icon, label, value, color, sub, warn }) {
  return (
    <div className="stat-card" style={{ position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 20 }}>{icon}</span>
        <span className="stat-label" style={{ margin: 0 }}>{label}</span>
      </div>
      <div className="stat-value" style={{ color: color || '#111827', fontSize: 24 }}>{value}</div>
      {sub && (
        <div style={{ fontSize: 12, color: warn ? '#f59e0b' : '#9ca3af', marginTop: 6 }}>{sub}</div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const [summary, setSummary]         = useState(null);
  const [orders, setOrders]           = useState([]);
  const [activeCouriers, setActiveCouriers] = useState(0);
  const [loading, setLoading]         = useState(true);
  const [period, setPeriod]           = useState('today');
  const navigate = useNavigate();

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [period]);

  async function load() {
    try {
      const [sumRes, ordersRes, onlineRes, busyRes] = await Promise.all([
        api.get(`/finance/summary?period=${period}`),
        api.get('/orders?limit=10'),
        api.get('/couriers?status=online'),
        api.get('/couriers?status=busy')
      ]);
      setSummary(sumRes.data.data);
      setOrders(ordersRes.data.data);
      setActiveCouriers((onlineRes.data.total || 0) + (busyRes.data.total || 0));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div className="loading"><div className="spinner" /></div>;

  const s = summary || {};

  const noPlatformFee = (s.total_platform_fees || 0) === 0 && (s.total_orders || 0) > 0;

  const metrics = [
    {
      icon: '📦',
      label: "Buyurtmalar",
      value: s.total_orders || 0,
      color: '#3b82f6',
      sub: period === 'today' ? 'Bugun' : period === 'week' ? '7 kun' : '30 kun'
    },
    {
      icon: '💵',
      label: "Mijoz to'ladi (naqd)",
      value: fmt(s.total_client_price),
      color: '#10b981',
      sub: "Kuryer yig'gan jami naqd"
    },
    {
      icon: '🛵',
      label: "Yetkazish narxi (taxometr)",
      value: fmt(s.total_fees),
      color: '#f59e0b',
      sub: "GPS taxometr natijasi"
    },
    {
      icon: '👥',
      label: "Aktiv kuryer",
      value: activeCouriers,
      color: '#8b5cf6',
      sub: "Online + buyurtmada"
    },
    {
      icon: '🏛️',
      label: "Platforma komissiyasi",
      value: fmt(s.total_platform_fees),
      color: '#6366f1',
      sub: noPlatformFee ? '⚠️ Sozlamalardan yoqing' : undefined,
      warn: noPlatformFee
    },
    {
      icon: s.net_profit > 0 ? '📈' : s.net_profit < 0 ? '📉' : '➖',
      label: "Kompaniya foydasi",
      value: (s.net_profit >= 0 ? '+' : '') + fmt(s.net_profit),
      color: s.net_profit > 0 ? '#10b981' : s.net_profit < 0 ? '#ef4444' : '#9ca3af',
      sub: s.net_profit < 0 ? `Zarar: ${fmt(s.total_subsidies)}` : undefined
    }
  ];

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select
            className="select"
            value={period}
            onChange={e => setPeriod(e.target.value)}
          >
            <option value="today">Bugun</option>
            <option value="week">7 kun</option>
            <option value="month">30 kun</option>
          </select>
          <span style={{ color: '#6b7280', fontSize: 13 }}>{new Date().toLocaleDateString()}</span>
        </div>
      </div>

      {/* Net profit = 0 explanation banner */}
      {noPlatformFee && (
        <div style={{
          background: '#fffbeb',
          border: '1px solid #fde68a',
          borderRadius: 12,
          padding: '12px 16px',
          marginBottom: 20,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          fontSize: 14
        }}>
          <span style={{ fontSize: 22 }}>💡</span>
          <div>
            <strong>Sof foyda 0 so'm</strong> — chunki platforma komissiyasi o'chirilgan.
            {' '}
            <button
              onClick={() => navigate('/settings')}
              style={{
                background: 'none', border: 'none', color: '#d97706',
                fontWeight: 700, cursor: 'pointer', textDecoration: 'underline',
                fontSize: 14, padding: 0
              }}
            >
              Sozlamalarga o'ting →
            </button>
            {' '}va Platform Fee ni Percent yoki Flat qiling.
          </div>
        </div>
      )}

      {/* Money flow diagram when there are orders */}
      {(s.total_orders || 0) > 0 && (
        <div style={{
          background: 'white',
          borderRadius: 12,
          padding: '16px 20px',
          marginBottom: 20,
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
          display: 'flex',
          alignItems: 'center',
          gap: 0,
          overflowX: 'auto'
        }}>
          <div style={{ textAlign: 'center', flexShrink: 0, padding: '0 12px' }}>
            <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>Naqd (mijoz)</div>
            <div style={{ fontWeight: 800, color: '#10b981', fontSize: 18 }}>{fmt(s.total_client_price)}</div>
          </div>
          <div style={{ color: '#d1d5db', fontSize: 20, flexShrink: 0 }}>−</div>
          <div style={{ textAlign: 'center', flexShrink: 0, padding: '0 12px' }}>
            <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>Yetkazish (taxometr)</div>
            <div style={{ fontWeight: 800, color: '#f59e0b', fontSize: 18 }}>{fmt(s.total_fees)}</div>
          </div>
          <div style={{ color: '#d1d5db', fontSize: 20, flexShrink: 0 }}>+</div>
          <div style={{ textAlign: 'center', flexShrink: 0, padding: '0 12px' }}>
            <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>Komissiya</div>
            <div style={{ fontWeight: 800, color: '#6366f1', fontSize: 18 }}>{fmt(s.total_platform_fees)}</div>
            {noPlatformFee && <div style={{ fontSize: 10, color: '#f59e0b' }}>komissiya yo'q</div>}
          </div>
          <div style={{ color: '#d1d5db', fontSize: 20, flexShrink: 0 }}>＝</div>
          <div style={{ textAlign: 'center', flexShrink: 0, padding: '0 12px', background: s.net_profit >= 0 ? '#f0fdf4' : '#fff1f2', borderRadius: 10 }}>
            <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>Kompaniya foydasi</div>
            <div style={{ fontWeight: 800, color: s.net_profit >= 0 ? '#10b981' : '#ef4444', fontSize: 18 }}>
              {s.net_profit >= 0 ? '+' : ''}{fmt(s.net_profit)}
            </div>
          </div>
        </div>
      )}

      {/* Metric cards */}
      <div className="stats-grid">
        {metrics.map(m => (
          <MetricCard key={m.label} {...m} />
        ))}
      </div>

      {/* Recent orders table */}
      <div className="card">
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>So'nggi buyurtmalar</h2>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Mijoz</th>
                <th>Taom</th>
                <th>Yetkazish</th>
                <th>Masofa</th>
                <th>Narx</th>
                <th>Kuryer</th>
                <th>Status</th>
                <th>Vaqt</th>
              </tr>
            </thead>
            <tbody>
              {orders.map(o => (
                <tr key={o._id}>
                  <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{o._id.slice(-6).toUpperCase()}</td>
                  <td style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: 12 }}>{o.client_phone || '—'}</td>
                  <td style={{ maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12 }}>
                    {o.items || <span style={{ color: '#9ca3af' }}>—</span>}
                  </td>
                  <td style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12 }}>
                    {o.dropoff_address}
                  </td>
                  <td style={{ whiteSpace: 'nowrap', fontSize: 12 }}>
                    {o.distance_km > 0 ? `${o.distance_km} km` : <span style={{ color: '#9ca3af' }}>—</span>}
                  </td>
                  <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                    {o.delivery_fee > 0
                      ? fmt(o.delivery_fee)
                      : <span style={{ color: '#9ca3af', fontSize: 11 }}>taxometr</span>}
                  </td>
                  <td style={{ fontSize: 12 }}>{o.courier_id?.name || <span style={{ color: '#9ca3af' }}>—</span>}</td>
                  <td><span className={`badge ${STATUS_BADGE[o.status] || 'badge-gray'}`}>{o.status}</span></td>
                  <td style={{ fontSize: 11, color: '#6b7280' }}>{new Date(o.created_at).toLocaleTimeString()}</td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', color: '#9ca3af', padding: 32 }}>
                    Hali buyurtmalar yo'q
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
