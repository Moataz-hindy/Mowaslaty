import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import 'leaflet/dist/leaflet.css';
import './landing.css';
import AppEntry from './AppEntry.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppEntry />
  </React.StrictMode>
);
