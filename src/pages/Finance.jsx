import React, { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import api from '../api';

function fmt(n) { return new Intl.NumberFormat('uz-UZ').format(Math.round(n || 0)) + " so'm"; }

export default function Finance() {
  const [dailyData, setDailyData] = useState([]);
  const [courierStats, setCourierStats] = useState([]);
  const [subsidyOrders, setSubsidyOrders] = useState([]);
  const [summary, setSummary] = useState(null);
  const [period, setPeriod] = useState('month');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, [period]);

  async function load() {
    setLoading(true);
    try {
      const [daily, couriers, sum, subsidies] = await Promise.all([
        api.get('/finance/daily'),
        api.get('/finance/couriers'),
        api.get(`/finance/summary?period=${period}`),
        api.get('/orders?status=delivered&limit=100')
      ]);
      setDailyData(daily.data.data);
      setCourierStats(couriers.data.data);
      setSummary(sum.data.data);
      // Loss orders = company_profit < 0 (delivery cost exceeded what client paid)
      setSubsidyOrders(subsidies.data.data.filter(o => (o.company_profit || 0) < 0));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function exportCSV() {
    const rows = [
      ['Kuryer', 'Buyurtmalar', 'Naqd yig\'ilgan', 'Bonus', 'Ayirma', 'Komissiya', 'Balans'],
      ...courierStats.map(s => [
        s.courier.name,
        s.order_count,
        s.total_cash_collected,
        s.total_wallet_added,
        s.total_wallet_deducted,
        s.total_platform_fees,
        s.balance
      ])
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `finance_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) return <div className="loading"><div className="spinner" /></div>;

  return (
    <div style={{ padding: 24 }}>
      <div className="page-header">
        <h1 className="page-title">Finance</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <select className="select" value={period} onChange={e => setPeriod(e.target.value)}>
            <option value="today">Today</option>
            <option value="week">Last 7 days</option>
            <option value="month">Last 30 days</option>
          </select>
          <button className="btn btn-secondary" onClick={exportCSV}>📥 Export CSV</button>
        </div>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="stats-grid" style={{ marginBottom: 24 }}>
          <div className="stat-card">
            <div className="stat-label">Total Orders</div>
            <div className="stat-value">{summary.total_orders}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Revenue</div>
            <div className="stat-value" style={{ color: '#10b981', fontSize: 20 }}>{fmt(summary.total_fees)}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Courier Payouts</div>
            <div className="stat-value" style={{ color: '#3b82f6', fontSize: 20 }}>{fmt(summary.total_payouts)}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Platform Fees</div>
            <div className="stat-value" style={{ color: '#8b5cf6', fontSize: 20 }}>{fmt(summary.total_platform_fees)}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Subsidies</div>
            <div className="stat-value" style={{ color: '#ef4444', fontSize: 20 }}>{fmt(summary.total_subsidies)}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Net Profit</div>
            <div className="stat-value" style={{ color: summary.net_profit >= 0 ? '#10b981' : '#ef4444', fontSize: 20 }}>
              {fmt(summary.net_profit)}
            </div>
          </div>
        </div>
      )}

      {/* Revenue chart */}
      <div className="card" style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Daily Revenue (Last 30 Days)</h2>
        {dailyData.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#9ca3af', padding: 40 }}>No data yet</div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={dailyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={d => d.slice(5)} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => (v / 1000) + 'K'} />
              <Tooltip formatter={(v) => fmt(v)} />
              <Legend />
              <Bar dataKey="total_fees" name="Revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="total_payouts" name="Payouts" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="total_platform_fees" name="Platform Fees" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Subsidy orders */}
      <div className="card" style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>
          Zarar buyurtmalar ({subsidyOrders.length})
          <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 400, marginLeft: 8 }}>Yetkazish narxi mijoz to'lovidan oshgan buyurtmalar</span>
        </h2>
        {subsidyOrders.length === 0 ? (
          <div style={{ color: '#9ca3af', fontSize: 13, textAlign: 'center', padding: 24 }}>No subsidy orders</div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Olib ketish</th>
                  <th>Yetkazish</th>
                  <th>Taxometr</th>
                  <th>Hamyon (±)</th>
                  <th>Platforma</th>
                  <th>Kuryer</th>
                  <th>Sana</th>
                </tr>
              </thead>
              <tbody>
                {subsidyOrders.map(o => (
                  <tr key={o._id}>
                    <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{o._id.slice(-6).toUpperCase()}</td>
                    <td style={{ fontSize: 12, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.pickup_address}</td>
                    <td style={{ fontSize: 12, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.dropoff_address}</td>
                    <td>{fmt(o.delivery_fee)}</td>
                    <td style={{ color: o.wallet_delta >= 0 ? '#10b981' : '#ef4444', fontWeight: 700 }}>
                      {o.wallet_delta >= 0 ? '+' : ''}{fmt(o.wallet_delta)}
                    </td>
                    <td style={{ color: '#8b5cf6', fontWeight: 700 }}>{fmt(o.platform_fee)}</td>
                    <td>{o.courier_id?.name || '—'}</td>
                    <td style={{ fontSize: 11, color: '#9ca3af' }}>{new Date(o.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Per-courier earnings */}
      <div className="card">
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Per-Courier Earnings</h2>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Courier</th>
                <th>Vehicle</th>
                <th>Orders</th>
                <th>Naqd (jami)</th>
                <th>Bonus/Ayirma</th>
                <th>Komissiya</th>
                <th>Balans</th>
              </tr>
            </thead>
            <tbody>
              {courierStats.map(s => (
                <tr key={s.courier.id}>
                  <td style={{ fontWeight: 600 }}>{s.courier.name}</td>
                  <td>{s.courier.vehicle_type}</td>
                  <td>{s.order_count}</td>
                  <td>{fmt(s.total_cash_collected)}</td>
                  <td style={{ color: (s.total_wallet_added - s.total_wallet_deducted) >= 0 ? '#10b981' : '#ef4444', fontWeight: 700 }}>
                    {(s.total_wallet_added - s.total_wallet_deducted) >= 0 ? '+' : ''}{fmt(s.total_wallet_added - s.total_wallet_deducted)}
                  </td>
                  <td style={{ color: '#8b5cf6' }}>{fmt(s.total_platform_fees)}</td>
                  <td style={{ fontWeight: 700, color: s.balance >= 0 ? '#10b981' : '#ef4444' }}>
                    {s.balance >= 0 ? '+' : ''}{fmt(s.balance)}
                  </td>
                </tr>
              ))}
              {courierStats.length === 0 && (
                <tr><td colSpan={7} style={{ textAlign: 'center', color: '#9ca3af', padding: 24 }}>No couriers</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
