// index.js or main.jsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { AuthProvider } from '../../financial-mapping-system/src/Context/AuthContext.jsx'; // ✅ NEW
import './index.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider> {/* ✅ WRAP App */}
      <App />
    </AuthProvider>
  </StrictMode>,
);