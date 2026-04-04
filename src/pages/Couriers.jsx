import React, { useEffect, useState } from 'react';
import api from '../api';

const STATUS_BADGE = {
  online: 'badge-green',
  offline: 'badge-gray',
  busy: 'badge-yellow'
};

function fmt(n) {
  return new Intl.NumberFormat('uz-UZ').format(Math.round(n || 0)) + " so'm";
}

export default function Couriers() {
  const [couriers, setCouriers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedCourier, setSelectedCourier] = useState(null);
  const [walletData, setWalletData] = useState(null);
  const [showTopup, setShowTopup] = useState(false);
  const [topupAmount, setTopupAmount] = useState('');
  const [topupNote, setTopupNote] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [form, setForm] = useState({ name: '', phone: '', password: '', vehicle_type: 'bike' });
  const [formError, setFormError] = useState('');

  useEffect(() => { load(); }, [page, statusFilter]);

  async function load() {
    setLoading(true);
    try {
      const params = { page, limit: 20 };
      if (statusFilter) params.status = statusFilter;
      const { data } = await api.get('/couriers', { params });
      setCouriers(data.data);
      setTotal(data.total);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function createCourier() {
    setFormError('');
    try {
      await api.post('/couriers', form);
      setShowCreate(false);
      setForm({ name: '', phone: '', password: '', vehicle_type: 'bike' });
      load();
    } catch (err) {
      setFormError(err.response?.data?.error || 'Failed to create courier');
    }
  }

  async function openCourier(courier) {
    setSelectedCourier(courier);
    try {
      const { data } = await api.get(`/couriers/${courier._id}/wallet`);
      setWalletData(data.data);
    } catch (err) {
      console.error(err);
    }
  }

  async function toggleActive(courier, e) {
    e.stopPropagation();
    try {
      await api.patch(`/couriers/${courier._id}`, { is_active: !courier.is_active });
      load();
    } catch (err) {
      console.error(err);
    }
  }

  async function doTopup() {
    try {
      await api.post(`/couriers/${selectedCourier._id}/wallet/topup`, {
        amount: Number(topupAmount),
        note: topupNote
      });
      setShowTopup(false);
      setTopupAmount('');
      setTopupNote('');
      const { data } = await api.get(`/couriers/${selectedCourier._id}/wallet`);
      setWalletData(data.data);
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Top-up failed');
    }
  }

  const TX_CONFIG = {
    order_bonus:     { icon: '💚', label: "Uzoq masofa bonusi"    },
    order_deduction: { icon: '🔴', label: "Qisqa masofa ayirmasi" },
    order_neutral:   { icon: '⬜', label: "Buyurtma (teng)"       },
    platform_fee:    { icon: '🟠', label: "Komissiya"             },
    top_up:          { icon: '💙', label: "Balans to'ldirish"     },
    adjustment:      { icon: '⬜', label: "Tuzatish"              }
  };

  return (
    <div style={{ padding: 24 }}>
      <div className="page-header">
        <h1 className="page-title">Couriers</h1>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>+ Add Courier</button>
      </div>

      <div className="filters">
        <select className="select" value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
          <option value="">All Statuses</option>
          <option value="online">Online</option>
          <option value="offline">Offline</option>
          <option value="busy">Busy</option>
        </select>
        <span style={{ color: '#6b7280', fontSize: 13 }}>{total} total</span>
      </div>

      <div className="card">
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Phone</th>
                <th>Vehicle</th>
                <th>Status</th>
                <th>Balance</th>
                <th>Today's Orders</th>
                <th>Active</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7}><div className="loading"><div className="spinner" /></div></td></tr>
              ) : couriers.map(c => (
                <tr key={c._id} onClick={() => openCourier(c)}>
                  <td style={{ fontWeight: 600 }}>{c.name}</td>
                  <td style={{ fontFamily: 'monospace' }}>{c.phone}</td>
                  <td>{c.vehicle_type}</td>
                  <td><span className={`badge ${STATUS_BADGE[c.status]}`}>{c.status}</span></td>
                  <td style={{ fontWeight: 600 }}>{fmt(c.wallet_balance)}</td>
                  <td>{c.today_orders}</td>
                  <td>
                    <button
                      className={`btn btn-sm ${c.is_active ? 'btn-success' : 'btn-danger'}`}
                      onClick={(e) => toggleActive(c, e)}
                    >
                      {c.is_active ? 'Active' : 'Blocked'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {total > 20 && (
          <div className="pagination">
            <button className="btn btn-sm btn-secondary" disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
            <span style={{ fontSize: 13, color: '#6b7280' }}>Page {page} of {Math.ceil(total / 20)}</span>
            <button className="btn btn-sm btn-secondary" disabled={page * 20 >= total} onClick={() => setPage(p => p + 1)}>Next →</button>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">Add New Courier</h2>
            {formError && <div className="alert alert-error">{formError}</div>}
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Alisher Karimov" />
            </div>
            <div className="form-group">
              <label className="form-label">Phone</label>
              <input className="input" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="998901234567" />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input type="password" className="input" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="Minimum 6 characters" />
            </div>
            <div className="form-group">
              <label className="form-label">Vehicle Type</label>
              <select className="select w-full" value={form.vehicle_type} onChange={e => setForm(f => ({ ...f, vehicle_type: e.target.value }))}>
                <option value="bike">Bike</option>
                <option value="scooter">Scooter</option>
                <option value="car">Car</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={createCourier}>Create Courier</button>
            </div>
          </div>
        </div>
      )}

      {/* Slide Panel */}
      {selectedCourier && (
        <>
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 899 }} onClick={() => setSelectedCourier(null)} />
          <div className="slide-panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700 }}>{selectedCourier.name}</h2>
              <button className="btn btn-sm btn-secondary" onClick={() => setSelectedCourier(null)}>✕</button>
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: '#6b7280' }}>Phone</div>
              <div style={{ fontFamily: 'monospace' }}>{selectedCourier.phone}</div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: '#6b7280' }}>Vehicle</div>
              <div>{selectedCourier.vehicle_type}</div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: '#6b7280' }}>Status</div>
              <span className={`badge ${STATUS_BADGE[selectedCourier.status]}`}>{selectedCourier.status}</span>
            </div>

            {walletData && (
              <>
                {/* Balance */}
                <div className="card" style={{ marginBottom: 16, padding: 16 }}>
                  <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Hisob-kitob balansi</div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: walletData.wallet.balance >= 0 ? '#10b981' : '#ef4444' }}>
                    {walletData.wallet.balance >= 0 ? '+' : ''}{fmt(walletData.wallet.balance)}
                  </div>
                  <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>
                    {walletData.wallet.balance > 0 ? 'Kompaniya kuryer\'ga qarzdor' : walletData.wallet.balance < 0 ? 'Kuryer kompaniyaga qarzdor' : 'Teng'}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12, fontSize: 12 }}>
                    <div>
                      <div style={{ color: '#6b7280' }}>Naqd yig'ilgan</div>
                      <div style={{ fontWeight: 600 }}>{fmt(walletData.wallet.total_cash_collected)}</div>
                    </div>
                    <div>
                      <div style={{ color: '#6b7280' }}>Komissiya</div>
                      <div style={{ fontWeight: 600 }}>{fmt(walletData.wallet.total_platform_fees)}</div>
                    </div>
                    <div>
                      <div style={{ color: '#6b7280' }}>Bonus (qo'shilgan)</div>
                      <div style={{ fontWeight: 600, color: '#10b981' }}>+{fmt(walletData.wallet.total_wallet_added)}</div>
                    </div>
                    <div>
                      <div style={{ color: '#6b7280' }}>Ayirma (chegirilgan)</div>
                      <div style={{ fontWeight: 600, color: '#ef4444' }}>-{fmt(walletData.wallet.total_wallet_deducted)}</div>
                    </div>
                    <div>
                      <div style={{ color: '#6b7280' }}>To'ldirilgan</div>
                      <div style={{ fontWeight: 600, color: '#3b82f6' }}>+{fmt(walletData.wallet.total_topped_up)}</div>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                  <button className="btn btn-success btn-sm" style={{ flex: 1 }} onClick={() => setShowTopup(true)}>💰 Balans to'ldirish</button>
                </div>

                {/* Transactions */}
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 12 }}>Tranzaksiyalar</div>
                  {walletData.transactions.map(tx => {
                    const cfg = TX_CONFIG[tx.type] || { icon: '⬜', label: tx.type };
                    return (
                      <div key={tx._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
                        <div>
                          <span style={{ marginRight: 6 }}>{cfg.icon}</span>
                          <span style={{ fontSize: 13 }}>{tx.note || cfg.label}</span>
                          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{new Date(tx.created_at).toLocaleString()}</div>
                        </div>
                        <div style={{ fontWeight: 600, color: tx.amount > 0 ? '#10b981' : '#ef4444', whiteSpace: 'nowrap' }}>
                          {tx.amount > 0 ? '+' : ''}{fmt(tx.amount)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </>
      )}

      {/* Top-up Modal */}
      {showTopup && (
        <div className="modal-overlay" onClick={() => setShowTopup(false)} style={{ zIndex: 1100 }}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">Top Up Wallet</h2>
            <div className="form-group">
              <label className="form-label">Amount (so'm)</label>
              <input type="number" className="input" value={topupAmount} onChange={e => setTopupAmount(e.target.value)} placeholder="50000" min="1" />
            </div>
            <div className="form-group">
              <label className="form-label">Note</label>
              <input className="input" value={topupNote} onChange={e => setTopupNote(e.target.value)} placeholder="Manual top-up" />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setShowTopup(false)}>Cancel</button>
              <button className="btn btn-success" onClick={doTopup} disabled={!topupAmount}>Top Up</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
