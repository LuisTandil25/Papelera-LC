
import React, { useState, useEffect } from 'react';
import { db } from '../db';
import { TableName, Customer, Sale } from '../types';
import { syncEngine } from '../sync';
import { Users, Search, Plus, Phone, Mail, MapPin, MoreHorizontal, MessageSquare, RefreshCw, CheckCircle2, AlertCircle, X, ShoppingBag, Calendar } from 'lucide-react';

const Customers: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Partial<Customer> | null>(null);
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  
  // Estado para ventas del cliente
  const [showSalesModal, setShowSalesModal] = useState(false);
  const [selectedCustomerSales, setSelectedCustomerSales] = useState<Sale[]>([]);
  const [viewingCustomer, setViewingCustomer] = useState<Customer | null>(null);

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    const data = await db.getAll<Customer>(TableName.CUSTOMERS);
    setCustomers(data);
  };

  const showNotify = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      await syncEngine.run();
      await loadCustomers();
      showNotify('Sincronización de clientes exitosa');
    } catch (e) {
      showNotify('Error al sincronizar clientes', 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCustomer) return;

    const newCustomer: Customer = {
      id: editingCustomer.id || crypto.randomUUID(),
      name: editingCustomer.name || '',
      phone: editingCustomer.phone || '',
      email: editingCustomer.email || '',
      address: editingCustomer.address || '',
      notes: editingCustomer.notes || '',
      updatedAt: Date.now()
    };

    await db.put(TableName.CUSTOMERS, newCustomer);
    setShowModal(false);
    loadCustomers();
    showNotify('Cliente guardado localmente');
    syncEngine.run();
  };

  const openWhatsApp = (phone: string) => {
    const cleanPhone = phone.replace(/\D/g, '');
    window.open(`https://wa.me/${cleanPhone}`, '_blank');
  };

  const handleViewSales = async (customer: Customer) => {
    setViewingCustomer(customer);
    // Cargar todas las ventas y filtrar
    const allSales = await db.getAll<Sale>(TableName.SALES);
    const customerSales = allSales
      .filter(s => s.customerId === customer.id)
      .sort((a, b) => b.timestamp - a.timestamp); // Ordenar por fecha descendente
    
    setSelectedCustomerSales(customerSales);
    setShowSalesModal(true);
  };

  const filtered = customers.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.phone.includes(searchTerm)
  );

  return (
    <div className="h-full flex flex-col bg-slate-50 relative">
      {notification && (
        <div className={`fixed top-24 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-300 ${notification.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
          {notification.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          <span className="font-bold text-sm">{notification.message}</span>
        </div>
      )}

      <div className="p-8 border-b bg-white flex flex-col md:flex-row md:items-center justify-between gap-6 shrink-0">
        <div>
          <h2 className="text-3xl font-black text-slate-800">Clientes</h2>
          <p className="text-slate-400 font-medium">Gestión de relaciones y base de datos</p>
        </div>
        <div className="flex flex-wrap gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input 
              type="text"
              placeholder="Nombre o teléfono..."
              className="pl-10 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 w-64 font-medium"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="flex gap-2">
            <button 
              onClick={handleManualSync}
              className={`p-3 rounded-xl border border-slate-200 text-slate-600 bg-white active:scale-95 transition-all shadow-sm ${isSyncing ? 'animate-spin' : ''}`}
              title="Sincronizar ahora con la nube"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
            <button 
              onClick={() => { setEditingCustomer({}); setShowModal(true); }}
              className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-indigo-700 shadow-lg shadow-indigo-100 active:scale-95 transition-all text-sm uppercase tracking-widest"
            >
              <Plus className="w-5 h-5" />
              <span>Añadir Cliente</span>
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8 no-scrollbar">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filtered.length === 0 ? (
            <div className="col-span-full py-20 text-center text-slate-300 font-black uppercase tracking-widest text-xs">No hay clientes registrados</div>
          ) : (
            filtered.map(c => (
              <div key={c.id} className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 flex flex-col group relative hover:shadow-xl hover:scale-[1.02] transition-all">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                    <Users className="w-7 h-7" />
                  </div>
                  <button 
                    onClick={() => { setEditingCustomer(c); setShowModal(true); }}
                    className="p-2 text-slate-300 hover:text-slate-600"
                  >
                    <MoreHorizontal className="w-5 h-5" />
                  </button>
                </div>
                
                <h3 className="text-lg font-black text-slate-800 mb-1">{c.name}</h3>
                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-6">Cliente de la Casa</p>

                <div className="space-y-4 flex-1">
                  <div className="flex items-center gap-3 text-slate-500">
                    <Phone className="w-4 h-4" />
                    <span className="text-sm font-bold">{c.phone || 'S/T'}</span>
                  </div>
                  <div className="flex items-center gap-3 text-slate-500">
                    <Mail className="w-4 h-4" />
                    <span className="text-sm font-bold truncate">{c.email || 'S/E'}</span>
                  </div>
                  <div className="flex items-start gap-3 text-slate-500">
                    <MapPin className="w-4 h-4 mt-1" />
                    <span className="text-sm font-bold line-clamp-2">{c.address || 'Sin dirección'}</span>
                  </div>
                </div>

                <div className="mt-8 pt-6 border-t flex gap-2">
                  <button 
                    onClick={() => openWhatsApp(c.phone)}
                    disabled={!c.phone}
                    className="flex-1 flex items-center justify-center gap-2 py-3 bg-emerald-500 text-white rounded-xl font-black text-[10px] hover:bg-emerald-600 transition-all disabled:opacity-50 uppercase tracking-widest"
                  >
                    <MessageSquare className="w-4 h-4" />
                    WhatsApp
                  </button>
                  <button 
                    onClick={() => handleViewSales(c)}
                    className="flex-1 py-3 bg-slate-50 text-slate-500 rounded-xl font-black text-[10px] hover:bg-slate-100 transition-all uppercase tracking-widest"
                  >
                    Ventas
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Modal Edición Cliente */}
      {showModal && (
        <div className="fixed inset-0 z-[110] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleSave} className="bg-white rounded-[2.5rem] p-10 w-full max-w-lg shadow-2xl animate-in zoom-in duration-300">
            <h2 className="text-2xl font-black text-slate-800 mb-8 uppercase tracking-tighter">{editingCustomer?.id ? 'Editar Perfil' : 'Nuevo Cliente'}</h2>
            
            <div className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Nombre Completo</label>
                <input 
                  required
                  className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
                  value={editingCustomer?.name || ''}
                  onChange={(e) => setEditingCustomer({ ...editingCustomer, name: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Teléfono</label>
                  <input 
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
                    value={editingCustomer?.phone || ''}
                    onChange={(e) => setEditingCustomer({ ...editingCustomer, phone: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Email</label>
                  <input 
                    type="email"
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
                    value={editingCustomer?.email || ''}
                    onChange={(e) => setEditingCustomer({ ...editingCustomer, email: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Dirección</label>
                <input 
                  className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
                  value={editingCustomer?.address || ''}
                  onChange={(e) => setEditingCustomer({ ...editingCustomer, address: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Notas</label>
                <textarea 
                  className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold h-24"
                  value={editingCustomer?.notes || ''}
                  onChange={(e) => setEditingCustomer({ ...editingCustomer, notes: e.target.value })}
                />
              </div>
            </div>

            <div className="flex gap-4 mt-10">
              <button 
                type="button"
                onClick={() => setShowModal(false)}
                className="flex-1 py-4 bg-slate-100 text-slate-400 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all"
              >
                Cancelar
              </button>
              <button 
                type="submit"
                className="flex-[2] py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-indigo-100 active:scale-95 transition-all"
              >
                Guardar Cliente
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal Historial de Ventas */}
      {showSalesModal && viewingCustomer && (
        <div className="fixed inset-0 z-[120] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-lg h-[80vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom duration-300">
            <div className="p-8 border-b shrink-0 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">{viewingCustomer.name}</h3>
                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Historial de Compras</p>
              </div>
              <button onClick={() => setShowSalesModal(false)} className="p-2 bg-slate-50 rounded-full text-slate-400 hover:text-slate-600"><X className="w-5 h-5"/></button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-4 no-scrollbar bg-slate-50/50">
              {selectedCustomerSales.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-300 opacity-60">
                   <ShoppingBag className="w-12 h-12 mb-3" />
                   <p className="font-black text-xs uppercase tracking-widest">Sin compras registradas</p>
                </div>
              ) : (
                selectedCustomerSales.map(sale => (
                  <div key={sale.id} className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100">
                     <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center gap-2 text-slate-400 text-[10px] font-black uppercase tracking-widest">
                           <Calendar className="w-3 h-3" />
                           {new Date(sale.timestamp).toLocaleDateString()}
                        </div>
                        <div className={`px-2 py-1 rounded-md text-[9px] font-black uppercase ${sale.paymentMethod === 'Efectivo' ? 'bg-emerald-50 text-emerald-600' : 'bg-indigo-50 text-indigo-600'}`}>
                          {sale.paymentMethod}
                        </div>
                     </div>
                     
                     <div className="space-y-1 mb-4">
                        {sale.items.map((item, idx) => (
                           <div key={idx} className="flex justify-between text-sm">
                              <span className="text-slate-600 font-medium truncate w-[70%]">{item.quantity}x {item.name}</span>
                              <span className="text-slate-900 font-bold">${Number(item.subtotal).toFixed(2)}</span>
                           </div>
                        ))}
                     </div>

                     <div className="pt-3 border-t border-dashed border-slate-200 flex justify-between items-end">
                        <span className="text-xs text-slate-400 font-bold uppercase">Total</span>
                        <span className="text-xl font-black text-slate-800">${Number(sale.total).toFixed(2)}</span>
                     </div>
                  </div>
                ))
              )}
            </div>
            
            <div className="p-6 border-t bg-white shrink-0 rounded-b-[2.5rem]">
               <div className="flex justify-between items-center bg-slate-900 text-white p-4 rounded-2xl">
                  <span className="text-xs font-bold uppercase tracking-widest">Total Gastado</span>
                  <span className="text-xl font-black">${selectedCustomerSales.reduce((acc, s) => acc + Number(s.total), 0).toFixed(2)}</span>
               </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Customers;
