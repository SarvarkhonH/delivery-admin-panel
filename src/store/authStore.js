import { create } from 'zustand';
import api from '../api';

const useAuthStore = create((set) => ({
  token: localStorage.getItem('token') || null,
  user: (() => { try { return JSON.parse(localStorage.getItem('user') || 'null'); } catch { return null; } })(),
  isAuthenticated: !!localStorage.getItem('token'),

  login: async (phone, password) => {
    const { data } = await api.post('/auth/login', { phone, password });
    if (data.data.role !== 'admin') throw new Error('Admin access required');
    localStorage.setItem('token', data.data.token);
    localStorage.setItem('refresh_token', data.data.refresh_token);
    localStorage.setItem('user', JSON.stringify(data.data.user));
    set({ token: data.data.token, user: data.data.user, isAuthenticated: true });
  },

  logout: async () => {
    try { await api.post('/auth/logout'); } catch {}
    localStorage.clear();
    set({ token: null, user: null, isAuthenticated: false });
  }
}));

export default useAuthStore;
