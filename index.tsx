
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Globales para PWA
(window as any).deferredPrompt = null;

window.addEventListener('beforeinstallprompt', (e: any) => {
  e.preventDefault();
  (window as any).deferredPrompt = e;
  // Disparamos un evento custom para que App.tsx reaccione al instante sin esperas
  window.dispatchEvent(new CustomEvent('pwa-ready'));
  console.log('PWA: Evento capturado');
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js', { scope: './' })
      .then(reg => {
        reg.onupdatefound = () => {
          const installingWorker = reg.installing;
          if (installingWorker) {
            installingWorker.onstatechange = () => {
              if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('PWA: Nueva versión lista, actualiza.');
              }
            };
          }
        };
      })
      .catch(err => console.error('PWA: SW Error', err));
  });
}

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
