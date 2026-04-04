import React, { useEffect, useState } from 'react';
import api from '../api';

function fmt(n) { return new Intl.NumberFormat('uz-UZ').format(Math.round(n || 0)); }

function LivePreview({ settings }) {
  const examples = [1, 1.5, 3.5, 7, 15].map(dist => {
    const fee = dist <= 1 ? settings.base_fee : settings.base_fee + (dist - 1) * settings.per_km_fee;
    let pfee = 0;
    if (settings.platform_fee_type === 'percent') pfee = Math.round(fee * settings.platform_fee_pct / 100);
    else if (settings.platform_fee_type === 'flat') pfee = settings.platform_flat_fee;
    const payout  = fee - pfee;
    const company = (settings.client_price || 0) - fee;
    return { dist, fee, payout, pfee, company };
  });

  return (
    <div style={{ background: '#f0fdf4', border: '1px solid #a7f3d0', borderRadius: 12, padding: 16, marginTop: 20 }}>
      <div style={{ fontWeight: 700, marginBottom: 12, color: '#065f46' }}>Live Price Preview
        <span style={{ fontWeight: 400, fontSize: 12, color: '#6b7280', marginLeft: 8 }}>
          (Mijoz to'laydi: {fmt(settings.client_price || 0)} so'm)
        </span>
      </div>
      <table style={{ width: '100%', fontSize: 13 }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', padding: '4px 8px', color: '#047857' }}>Masofa</th>
            <th style={{ textAlign: 'right', padding: '4px 8px', color: '#047857' }}>Yetkazish narxi</th>
            <th style={{ textAlign: 'right', padding: '4px 8px', color: '#047857' }}>Kuryer oladi</th>
            <th style={{ textAlign: 'right', padding: '4px 8px', color: '#047857' }}>Platforma</th>
            <th style={{ textAlign: 'right', padding: '4px 8px', color: '#047857' }}>Kompaniya</th>
          </tr>
        </thead>
        <tbody>
          {examples.map(e => (
            <tr key={e.dist} style={{ borderTop: '1px solid #d1fae5' }}>
              <td style={{ padding: '6px 8px', fontWeight: 600 }}>{e.dist} km</td>
              <td style={{ padding: '6px 8px', textAlign: 'right' }}>{fmt(e.fee)} so'm</td>
              <td style={{ padding: '6px 8px', textAlign: 'right', color: '#059669', fontWeight: 700 }}>{fmt(e.payout)} so'm</td>
              <td style={{ padding: '6px 8px', textAlign: 'right', color: e.pfee > 0 ? '#7c3aed' : '#9ca3af' }}>
                {e.pfee > 0 ? `${fmt(e.pfee)} so'm` : '—'}
              </td>
              <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700, color: e.company >= 0 ? '#2563eb' : '#ef4444' }}>
                {e.company >= 0 ? '+' : ''}{fmt(e.company)} so'm
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Settings() {
  const [settings, setSettings] = useState({
    client_price: 10000,
    base_fee: 7000,
    per_km_fee: 2300,
    platform_fee_type: 'none',
    platform_fee_pct: 0,
    platform_flat_fee: 0,
    max_distance_km: 50
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const { data } = await api.get('/settings/pricing');
      setSettings(data.data);
    } catch (err) {
      setError('Failed to load settings');
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    setSaving(true);
    setError('');
    try {
      const { data } = await api.patch('/settings/pricing', settings);
      setSettings(data.data);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      setShowConfirm(false);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  }

  function update(key, value) {
    setSettings(s => ({ ...s, [key]: value }));
  }

  if (loading) return <div className="loading"><div className="spinner" /></div>;

  return (
    <div style={{ padding: 24, maxWidth: 760 }}>
      <div className="page-header">
        <h1 className="page-title">Settings</h1>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {saved && <div className="alert alert-success">Settings saved successfully!</div>}

      <div className="card">
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>Pricing Configuration</h2>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">Mijoz uchun yetkazish narxi (so'm)</label>
            <input type="number" className="input" value={settings.client_price} onChange={e => update('client_price', Number(e.target.value))} style={{ maxWidth: 280 }} />
            <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>Mijoz har doim shu narxni ko'radi va to'laydi. Masofadan qat'iy nazar o'zgarmaydi.</div>
          </div>
          <div className="form-group">
            <label className="form-label">Baza narx (so'm)</label>
            <input type="number" className="input" value={settings.base_fee} onChange={e => update('base_fee', Number(e.target.value))} />
            <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>Birinchi 1 km uchun narx</div>
          </div>
          <div className="form-group">
            <label className="form-label">Har km narxi (so'm)</label>
            <input type="number" className="input" value={settings.per_km_fee} onChange={e => update('per_km_fee', Number(e.target.value))} />
            <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>1 kmdan keyin har km uchun</div>
          </div>
          <div className="form-group">
            <label className="form-label">Max masofa (km)</label>
            <input type="number" className="input" value={settings.max_distance_km} onChange={e => update('max_distance_km', Number(e.target.value))} />
            <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>Bu masofadan uzoq buyurtmalar rad etiladi</div>
          </div>
        </div>

        <div style={{ marginTop: 8 }}>
          <label className="form-label">Platform Fee Type</label>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            {['none', 'percent', 'flat'].map(t => (
              <button
                key={t}
                onClick={() => update('platform_fee_type', t)}
                className={`btn ${settings.platform_fee_type === t ? 'btn-primary' : 'btn-secondary'}`}
                style={{ flex: 1, justifyContent: 'center' }}
              >
                {t === 'none' ? 'None' : t === 'percent' ? 'Percent (%)' : 'Flat fee'}
              </button>
            ))}
          </div>

          {settings.platform_fee_type === 'percent' && (
            <div className="form-group">
              <label className="form-label">Platform Fee Percent (%)</label>
              <input type="number" step="0.1" className="input" value={settings.platform_fee_pct}
                onChange={e => update('platform_fee_pct', Number(e.target.value))}
                style={{ maxWidth: 200 }}
              />
            </div>
          )}
          {settings.platform_fee_type === 'flat' && (
            <div className="form-group">
              <label className="form-label">Platform Flat Fee (so'm)</label>
              <input type="number" className="input" value={settings.platform_flat_fee}
                onChange={e => update('platform_flat_fee', Number(e.target.value))}
                style={{ maxWidth: 200 }}
              />
            </div>
          )}
        </div>

        <LivePreview settings={settings} />

        <div style={{ marginTop: 20 }}>
          {settings.updated_at && (
            <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 12 }}>
              Last updated: {new Date(settings.updated_at).toLocaleString()} by {settings.updated_by}
            </div>
          )}
          <button className="btn btn-primary" onClick={() => setShowConfirm(true)} disabled={saving}>
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>

      {/* Confirm dialog */}
      {showConfirm && (
        <div className="modal-overlay" onClick={() => setShowConfirm(false)}>
          <div className="modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">Confirm Settings Update</h2>
            <p style={{ color: '#6b7280', marginBottom: 20, fontSize: 14 }}>
              This will affect all new orders. Existing orders use their own pricing snapshot.
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setShowConfirm(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>
                {saving ? 'Saving...' : 'Confirm & Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
