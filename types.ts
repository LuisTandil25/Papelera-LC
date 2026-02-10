
export enum TableName {
  PRODUCTS = 'Productos',
  CUSTOMERS = 'Clientes',
  SALES = 'Ventas',
  DELIVERY = 'Reparto',
  OUTBOX = 'Outbox',
  CONFIG = 'Config'
}

export interface Product {
  id: string;
  remoteId?: string;
  name: string;
  category: string;
  cost: number;
  price: number;
  stock: number;
  barcode: string;
  image?: string;
  updatedAt: number;
}

export interface Customer {
  id: string;
  remoteId?: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
  updatedAt: number;
}

export interface SaleItem {
  productId: string;
  name: string;
  quantity: number;
  price: number;
  subtotal: number;
}

export interface Sale {
  id: string;
  remoteId?: string;
  customerId?: string;
  customerName?: string;
  items: SaleItem[];
  total: number;
  paymentMethod: 'Efectivo' | 'Tarjeta' | 'Transferencia';
  timestamp: number;
  status: 'Completada' | 'Reembolsada';
  updatedAt: number;
}

export interface DeliveryPoint {
  id: string;
  lat: number;
  lng: number;
  day: string;
  timestamp: number;
  updatedAt: number;
  note?: string;
}

export interface OutboxItem {
  id: number;
  tableName: TableName;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  payload: any;
  timestamp: number;
}

export interface AppConfig {
  key: string;
  value: any;
}
