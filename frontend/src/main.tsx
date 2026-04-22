import React from 'react';
import ReactDOM from 'react-dom/client';
import { Toaster } from 'react-hot-toast';
import { MsalProvider } from '@azure/msal-react';
import App from './App';
import './index.css';
import { msalInstance } from './lib/msal';

// Initialize MSAL before rendering (required by MSAL v3+)
msalInstance.initialize().then(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <MsalProvider instance={msalInstance}>
        <App />
      </MsalProvider>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3500,
          style: {
            background: '#fff',
            color: '#111',
            border: '1px solid #e5e7eb',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            borderRadius: '10px',
            fontSize: '14px',
          },
        }}
      />
    </React.StrictMode>
  );
});
