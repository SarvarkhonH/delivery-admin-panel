import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Couriers from './pages/Couriers';
import Orders from './pages/Orders';
import MapPage from './pages/MapPage';
import Finance from './pages/Finance';
import Settings from './pages/Settings';
import Restaurants from './pages/Restaurants';
import useAuthStore from './store/authStore';
import 'leaflet/dist/leaflet.css';
import './index.css';

function PrivateRoute({ children }) {
  const { isAuthenticated } = useAuthStore();
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="couriers" element={<Couriers />} />
          <Route path="orders" element={<Orders />} />
          <Route path="map" element={<MapPage />} />
          <Route path="restaurants" element={<Restaurants />} />
          <Route path="finance" element={<Finance />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
