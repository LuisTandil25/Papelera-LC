
import { TableName, AppConfig } from './types';
import { db } from './db';

export class ApiClient {
  private async getUrl(): Promise<string | null> {
    const url = await db.getConfig('api_url');
    if (!url || url.includes('YOUR_SCRIPT_ID')) return null;
    return url;
  }

  async syncOutbox(items: any[]): Promise<boolean> {
    if (items.length === 0) return true;
    
    const url = await this.getUrl();
    if (!url) return false;

    try {
      // POST para escritura
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8'
        },
        body: JSON.stringify({ action: 'SYNC_OUTBOX', data: items }),
        mode: 'cors',
        redirect: 'follow'
      });
      
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const result = await response.json();
      return result.success;
    } catch (e) {
      console.error('API sync failed:', e);
      return false;
    }
  }

  async fetchUpdates(tableName: TableName, lastSync: number): Promise<any[]> {
    const url = await this.getUrl();
    if (!url) return [];

    try {
      // ESTRATEGIA v2.6: Usar POST también para leer (fetchUpdates).
      // Esto evita problemas de CORS y cacheo agresivo en peticiones GET a Google Scripts.
      // Al enviar como POST text/plain, evitamos el Preflight (OPTIONS) que suele fallar.
      
      const response = await fetch(url, {
        method: 'POST', 
        headers: {
          'Content-Type': 'text/plain;charset=utf-8'
        },
        body: JSON.stringify({ 
          action: 'FETCH_UPDATES', 
          table: tableName, 
          since: lastSync 
        }),
        mode: 'cors',
        redirect: 'follow'
      });

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const result = await response.json();
      return result.data || [];
    } catch (e) {
      // console.error silencioso para no ensuciar si es solo falta de internet
      console.warn(`API fetch warning for ${tableName}:`, e);
      return [];
    }
  }
}

export const api = new ApiClient();
