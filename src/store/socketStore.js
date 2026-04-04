import { create } from 'zustand';
import { io } from 'socket.io-client';

const useSocketStore = create((set, get) => ({
  socket: null,
  courierLocations: {},  // { courier_id: { lat, lng, timestamp, order_id } }
  courierStatuses: {},   // { courier_id: status }

  connect: () => {
    const token = localStorage.getItem('token');
    if (!token || get().socket?.connected) return;

    const socket = io('/', { auth: { token } });

    socket.on('connect', () => {
      console.log('Admin socket connected');
    });

    socket.on('courier:location', ({ courier_id, lat, lng, order_id, timestamp }) => {
      set(state => ({
        courierLocations: {
          ...state.courierLocations,
          [courier_id]: { lat, lng, order_id, timestamp }
        }
      }));
    });

    socket.on('courier:status', ({ courier_id, status }) => {
      set(state => ({
        courierStatuses: { ...state.courierStatuses, [courier_id]: status }
      }));
    });

    socket.on('disconnect', () => {
      console.log('Admin socket disconnected');
    });

    set({ socket });
  },

  disconnect: () => {
    get().socket?.disconnect();
    set({ socket: null, courierLocations: {}, courierStatuses: {} });
  }
}));

export default useSocketStore;
