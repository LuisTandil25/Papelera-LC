
import { TableName, Product, Customer, Sale, OutboxItem } from './types';

const DB_NAME = 'PapeleraLC_DB';
const DB_VERSION = 1;

export class Database {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  async init(): Promise<void> {
    if (this.db) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise<void>((resolve, reject) => {
      try {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          
          if (!db.objectStoreNames.contains(TableName.PRODUCTS)) {
            const productStore = db.createObjectStore(TableName.PRODUCTS, { keyPath: 'id' });
            productStore.createIndex('barcode', 'barcode', { unique: false });
            productStore.createIndex('category', 'category', { unique: false });
          }
          
          if (!db.objectStoreNames.contains(TableName.CUSTOMERS)) {
            db.createObjectStore(TableName.CUSTOMERS, { keyPath: 'id' });
          }
          
          if (!db.objectStoreNames.contains(TableName.SALES)) {
            const saleStore = db.createObjectStore(TableName.SALES, { keyPath: 'id' });
            saleStore.createIndex('timestamp', 'timestamp', { unique: false });
          }

          if (!db.objectStoreNames.contains(TableName.DELIVERY)) {
            db.createObjectStore(TableName.DELIVERY, { keyPath: 'id' });
          }
          
          if (!db.objectStoreNames.contains(TableName.OUTBOX)) {
            db.createObjectStore(TableName.OUTBOX, { keyPath: 'id', autoIncrement: true });
          }

          if (!db.objectStoreNames.contains(TableName.CONFIG)) {
            db.createObjectStore(TableName.CONFIG, { keyPath: 'key' });
          }
        };

        request.onsuccess = (event) => {
          this.db = (event.target as IDBOpenDBRequest).result;
          resolve();
        };

        request.onerror = () => {
          this.initPromise = null;
          reject('Failed to open IndexedDB');
        };
      } catch (err) {
        this.initPromise = null;
        reject(err);
      }
    });

    return this.initPromise;
  }

  private async getStore(tableName: TableName, mode: IDBTransactionMode = 'readonly') {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');
    const transaction = this.db.transaction(tableName, mode);
    return transaction.objectStore(tableName);
  }

  async getAll<T>(tableName: TableName): Promise<T[]> {
    const store = await this.getStore(tableName);
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(`Error getting data from ${tableName}`);
    });
  }

  async getById<T>(tableName: TableName, id: string): Promise<T | undefined> {
    const store = await this.getStore(tableName);
    return new Promise((resolve, reject) => {
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(`Error getting record ${id} from ${tableName}`);
    });
  }

  async put(tableName: TableName, data: any, addToOutbox = true): Promise<void> {
    const store = await this.getStore(tableName, 'readwrite');
    return new Promise<void>((resolve, reject) => {
      const request = store.put(data);
      request.onsuccess = async () => {
        if (addToOutbox && tableName !== TableName.OUTBOX && tableName !== TableName.CONFIG) {
          await this.addToOutbox(tableName, 'CREATE', data);
        }
        resolve();
      };
      request.onerror = () => reject(`Error saving to ${tableName}`);
    });
  }

  async delete(tableName: TableName, id: string, addToOutbox = true): Promise<void> {
    const store = await this.getStore(tableName, 'readwrite');
    return new Promise<void>((resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = async () => {
        if (addToOutbox) {
          await this.addToOutbox(tableName, 'DELETE', { id });
        }
        resolve();
      };
      request.onerror = () => reject(`Error deleting from ${tableName}`);
    });
  }

  async deleteBulk(tableName: TableName, ids: string[], addToOutbox = true): Promise<void> {
    for (const id of ids) {
      await this.delete(tableName, id, addToOutbox);
    }
  }

  private async addToOutbox(tableName: TableName, action: 'CREATE' | 'UPDATE' | 'DELETE', payload: any) {
    const outboxStore = await this.getStore(TableName.OUTBOX, 'readwrite');
    return new Promise<void>((resolve, reject) => {
      const request = outboxStore.add({
        tableName,
        action,
        payload,
        timestamp: Date.now()
      });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to add item to outbox'));
    });
  }

  async clearOutboxItem(id: number): Promise<void> {
    const store = await this.getStore(TableName.OUTBOX, 'readwrite');
    return new Promise<void>((resolve) => {
      const request = store.delete(id);
      request.onsuccess = () => resolve();
    });
  }

  async getConfig(key: string): Promise<any> {
    const config = await this.getById<any>(TableName.CONFIG, key);
    return config?.value;
  }

  async setConfig(key: string, value: any): Promise<void> {
    return this.put(TableName.CONFIG, { key, value }, false);
  }
}

export const db = new Database();
