import React, { useEffect, useState } from 'react';
import api from '../api';

const EMPTY = { name: '', address: '', lat: '', lng: '', phone: '' };

export default function Restaurants() {
  const [list, setList]         = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing]   = useState(null);   // restaurant object or null
  const [form, setForm]         = useState(EMPTY);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const { data } = await api.get('/restaurants?active=all');
      setList(data.data);
    } catch { }
    finally { setLoading(false); }
  }

  function openAdd() {
    setEditing(null);
    setForm(EMPTY);
    setError('');
    setShowForm(true);
  }

  function openEdit(r) {
    setEditing(r);
    setForm({ name: r.name, address: r.address, lat: r.lat, lng: r.lng, phone: r.phone || '' });
    setError('');
    setShowForm(true);
  }

  async function save() {
    if (!form.name.trim() || !form.lat || !form.lng) {
      setError('Nomi, lat va lng majburiy');
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (editing) {
        await api.patch(`/restaurants/${editing._id}`, form);
      } else {
        await api.post('/restaurants', form);
      }
      setShowForm(false);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Xatolik');
    } finally {
      setSaving(false);
    }
  }

  async function toggle(r) {
    await api.patch(`/restaurants/${r._id}`, { is_active: !r.is_active });
    load();
  }

  async function remove(r) {
    if (!window.confirm(`"${r.name}" ni o'chirasizmi?`)) return;
    await api.delete(`/restaurants/${r._id}`);
    load();
  }

  return (
    <div style={{ padding: 24 }}>
      <div className="page-header">
        <h1 className="page-title">Restoranlar</h1>
        <button className="btn btn-primary" onClick={openAdd}>+ Restoran qo'shish</button>
      </div>

      <div className="card">
        {loading ? (
          <div className="loading"><div className="spinner" /></div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Nomi</th>
                  <th>Manzil</th>
                  <th>Telefon</th>
                  <th>Koordinatalar</th>
                  <th>Holat</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {list.map(r => (
                  <tr key={r._id}>
                    <td style={{ fontWeight: 600 }}>{r.name}</td>
                    <td style={{ fontSize: 13, color: '#6b7280', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.address || '—'}
                    </td>
                    <td style={{ fontSize: 13 }}>{r.phone || '—'}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: 12, color: '#6b7280' }}>
                      {r.lat.toFixed(5)}, {r.lng.toFixed(5)}
                    </td>
                    <td>
                      <span className={`badge ${r.is_active ? 'badge-green' : 'badge-gray'}`}>
                        {r.is_active ? 'Faol' : 'Nofaol'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-sm btn-secondary" onClick={() => openEdit(r)}>Tahrirlash</button>
                        <button className="btn btn-sm btn-secondary" onClick={() => toggle(r)}>
                          {r.is_active ? 'O\'chirish' : 'Yoqish'}
                        </button>
                        <button className="btn btn-sm" style={{ background: '#fee2e2', color: '#b91c1c', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 12 }}
                          onClick={() => remove(r)}>O'chirish</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {list.length === 0 && (
                  <tr><td colSpan={6} style={{ textAlign: 'center', color: '#9ca3af', padding: 32 }}>
                    Restoranlar yo'q. + Restoran qo'shish tugmasini bosing.
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit modal */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">{editing ? 'Restoranni tahrirlash' : 'Yangi restoran'}</h2>

            {error && <div className="alert alert-error">{error}</div>}

            <div className="form-group">
              <label className="form-label">Nomi *</label>
              <input className="input" value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Qaizli xot" />
            </div>

            <div className="form-group">
              <label className="form-label">Manzil (matn)</label>
              <input className="input" value={form.address}
                onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                placeholder="Ko'cha, bino, shahar" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Latitude *</label>
                <input className="input" type="number" step="any" value={form.lat}
                  onChange={e => setForm(f => ({ ...f, lat: e.target.value }))}
                  placeholder="41.29950" />
              </div>
              <div className="form-group">
                <label className="form-label">Longitude *</label>
                <input className="input" type="number" step="any" value={form.lng}
                  onChange={e => setForm(f => ({ ...f, lng: e.target.value }))}
                  placeholder="69.24007" />
              </div>
            </div>

            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 12, marginTop: -8 }}>
              💡 Google Maps da restoranni toping → o'ng tugma → koordinatalarni nusxalang
            </div>

            <div className="form-group">
              <label className="form-label">Telefon</label>
              <input className="input" value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                placeholder="+998 90 123 45 67" />
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
              <button className="btn btn-secondary" onClick={() => setShowForm(false)}>Bekor</button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>
                {saving ? 'Saqlanmoqda...' : 'Saqlash'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
