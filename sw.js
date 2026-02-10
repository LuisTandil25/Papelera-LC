
const CACHE_NAME = 'papelera-lc-v127';
let isWifi = true; // Estado por defecto

const STATIC_ASSETS = [
  './',
  './index.html',
  './index.tsx',
  './manifest.json',
  './types.ts',
  './db.ts',
  './api.ts',
  './sync.ts',
  './App.tsx',
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap',
  'https://esm.sh/react@^19.2.4',
  'https://esm.sh/react-dom@^19.2.4',
  'https://esm.sh/react-dom@^19.2.4/client',
  'https://esm.sh/recharts@^3.7.0',
  'https://esm.sh/lucide-react@^0.563.0'
];

// Escuchar mensajes de la App (WiFi vs Datos/Offline)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'NETWORK_TYPE') {
    isWifi = event.data.isWifi;
    console.log(`SW: Estrategia de carga -> ${isWifi ? 'WiFi (Actualización)' : 'Memoria (Ahorro/Offline)'}`);
  }
});

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.map((key) => { if (key !== CACHE_NAME) return caches.delete(key); })
    ))
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  const isLibrary = url.hostname.includes('esm.sh') || 
                   url.hostname.includes('tailwindcss.com') ||
                   url.hostname.includes('gstatic.com') ||
                   url.hostname.includes('googleapis.com');
  
  const isLocalAsset = STATIC_ASSETS.some(asset => event.request.url.includes(asset.replace('./', '')));

  // Si es un recurso crítico (Librerías o Archivos de la App)
  if (isLibrary || isLocalAsset) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        // MODO WIFI: Estrategia de actualización (Carga caché pero busca red para actualizar)
        if (isWifi && navigator.onLine) {
          const fetchPromise = fetch(event.request).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const cacheCopy = networkResponse.clone();
              caches.open(CACHE_NAME).then(cache => cache.put(event.request, cacheCopy));
            }
            return networkResponse;
          }).catch(() => cachedResponse);
          return cachedResponse || fetchPromise;
        } 
        
        // MODO MEMORIA (Datos o Offline): Cache-Only estricto
        // Forzamos el uso de memoria ignorando la red para ahorrar batería y datos
        return cachedResponse || fetch(event.request);
      })
    );
  }
});
