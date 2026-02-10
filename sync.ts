
import { db } from './db';
import { api } from './api';
import { TableName } from './types';

export type SyncStatus = 'idle' | 'syncing' | 'error' | 'unconfigured' | 'offline' | 'paused_mobile';

// Helper: Detectar si estamos en WiFi/Ethernet
const isWifiConnection = (): boolean => {
  const nav = navigator as any;
  // La API 'connection' es estándar en Chromium (Android/Chrome/Edge)
  const conn = nav.connection || nav.mozConnection || nav.webkitConnection;
  
  if (!conn) return true; // Si el navegador no soporta la API, permitimos sync por defecto
  
  // Si tiene la propiedad type (común en móviles)
  if (conn.type) {
    // Permitimos sync auto solo en estos tipos
    return conn.type === 'wifi' || conn.type === 'ethernet' || conn.type === 'wimax' || conn.type === 'unknown';
  }
  
  // Fallback: saveData (si el usuario tiene activado ahorro de datos, bloqueamos auto-sync)
  if (conn.saveData === true) return false;

  // Si no podemos determinar específicamente que es 'cellular', asumimos WiFi para no bloquear functionality
  // En Android WebView moderno, 'cellular' es reportado correctamente.
  return conn.type !== 'cellular';
};

export class SyncEngine {
  private isSyncing = false;
  private status: SyncStatus = 'idle';
  private statusListeners: ((status: SyncStatus) => void)[] = [];

  getStatus(): SyncStatus {
    return this.status;
  }

  subscribe(listener: (status: SyncStatus) => void) {
    this.statusListeners.push(listener);
    return () => {
      this.statusListeners = this.statusListeners.filter(l => l !== listener);
    };
  }

  private setStatus(newStatus: SyncStatus) {
    if (this.status === newStatus) return;
    this.status = newStatus;
    this.statusListeners.forEach(l => l(newStatus));
  }

  // force = true indica que el usuario apretó el botón, ignorando la restricción de WiFi
  async run(force = true) {
    if (this.isSyncing) return;
    
    // Verificación de conexión básica
    if (!navigator.onLine) {
      this.setStatus('offline');
      return;
    }

    // Verificación de Tipo de Red para Automático (force=false)
    if (!force && !isWifiConnection()) {
      console.log("Auto-sync pausado: Datos móviles detectados.");
      this.setStatus('paused_mobile'); // Nuevo estado para UI si se desea mostrar
      return;
    }

    const url = await db.getConfig('api_url');
    if (!url || url.includes('YOUR_SCRIPT_ID')) {
      this.setStatus('unconfigured');
      return;
    }

    this.isSyncing = true;
    this.setStatus('syncing');

    try {
      // 1. Push Outbox (Subir cambios locales)
      const outbox = await db.getAll<any>(TableName.OUTBOX);
      if (outbox.length > 0) {
        const success = await api.syncOutbox(outbox);
        if (success) {
          for (const item of outbox) {
            await db.clearOutboxItem(item.id);
          }
        } else {
          console.warn('Fallo al subir datos, se reintentará luego.');
        }
      }

      // 2. Pull Updates (Bajar novedades: Clientes, Productos, etc.)
      const tables = [TableName.PRODUCTS, TableName.CUSTOMERS, TableName.SALES, TableName.DELIVERY];
      for (const table of tables) {
        const lastSync = await db.getConfig(`last_sync_${table}`) || 0;
        const updates = await api.fetchUpdates(table, lastSync);
        
        for (const record of updates) {
          // false = no agregar al outbox (es data remota que baja a local)
          await db.put(table, record, false); 
        }

        if (updates.length > 0) {
          await db.setConfig(`last_sync_${table}`, Date.now());
        }
      }
      this.setStatus('idle');
    } catch (e) {
      console.error('Error en proceso de sync:', e);
      this.setStatus('error');
    } finally {
      this.isSyncing = false;
    }
  }

  startAutoSync(intervalMs = 15000) {
    // Intento inicial (solo si es WiFi)
    this.run(false); 
    
    // Intervalo (false = modo automático, respeta WiFi)
    setInterval(() => this.run(false), intervalMs);
    
    // Eventos de red
    window.addEventListener('online', () => {
      // Al volver la conexión, intentamos sync automático (respetando WiFi)
      this.run(false);
    });
    
    window.addEventListener('offline', () => {
      this.setStatus('offline');
    });

    // Escuchar cambios de tipo de conexión (si el navegador lo soporta)
    const nav = navigator as any;
    const conn = nav.connection || nav.mozConnection || nav.webkitConnection;
    if (conn && conn.addEventListener) {
      conn.addEventListener('change', () => {
        // Si cambiamos de 4G a WiFi, intentar sync
        if (isWifiConnection()) {
           this.run(false);
        }
      });
    }
  }
}

export const syncEngine = new SyncEngine();
