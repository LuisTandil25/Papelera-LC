
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../db';
import { TableName, Product, Customer, Sale, SaleItem } from '../types';
import Receipt from './Receipt';
import { Search, Plus, Minus, Trash2, User, CreditCard, Banknote, ShoppingCart, Layout, ChevronUp, ChevronDown, X, Check, ArrowRight } from 'lucide-react';

const POS: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [cart, setCart] = useState<SaleItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  
  // Estados de UI
  const [showCheckout, setShowCheckout] = useState(false);
  const [lastSale, setLastSale] = useState<Sale | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const p = await db.getAll<Product>(TableName.PRODUCTS);
      const c = await db.getAll<Customer>(TableName.CUSTOMERS);
      setProducts(p || []);
      setCustomers(c || []);
    } catch (e) {
      console.error("Error cargando datos POS:", e);
    }
  };

  const filteredProducts = useMemo(() => {
    if (!products) return [];
    const term = searchTerm.toLowerCase();
    return products.filter(p => 
      p.name.toLowerCase().includes(term) || 
      (p.barcode && p.barcode.includes(term)) ||
      (p.category && p.category.toLowerCase().includes(term))
    );
  }, [products, searchTerm]);

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.productId === product.id);
      const price = Number(product.price) || 0;
      
      if (existing) {
        return prev.map(item => 
          item.productId === product.id 
            ? { ...item, quantity: item.quantity + 1, subtotal: (item.quantity + 1) * price }
            : item
        );
      }
      return [...prev, {
        productId: product.id,
        name: product.name,
        quantity: 1,
        price: price,
        subtotal: price
      }];
    });
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.productId === productId) {
        const newQty = Math.max(0, item.quantity + delta);
        const price = Number(item.price) || 0;
        return { ...item, quantity: newQty, subtotal: newQty * price };
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const cartTotal = cart.reduce((sum, item) => sum + (Number(item.subtotal) || 0), 0);
  const cartItemsCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const handleCheckout = async (paymentMethod: 'Efectivo' | 'Tarjeta' | 'Transferencia') => {
    if (cart.length === 0) return;

    const now = Date.now();
    const newSale: Sale = {
      id: crypto.randomUUID(),
      customerId: selectedCustomer?.id,
      customerName: selectedCustomer?.name,
      items: cart,
      total: cartTotal,
      paymentMethod,
      timestamp: now,
      status: 'Completada',
      updatedAt: now
    };

    await db.put(TableName.SALES, newSale);

    // Actualizar Stock Localmente
    for (const item of cart) {
      const p = products.find(prod => prod.id === item.productId);
      if (p) {
        const currentStock = Number(p.stock) || 0;
        await db.put(TableName.PRODUCTS, { ...p, stock: currentStock - item.quantity, updatedAt: Date.now() });
      }
    }

    setLastSale(newSale);
    setShowReceipt(true);
    setCart([]);
    setSelectedCustomer(null);
    setShowCheckout(false);
    setIsMobileCartOpen(false);
    loadData();
  };

  // Subcomponente del Carrito
  const CartContent = ({ isMobile = false }) => (
    <div className="flex flex-col h-full bg-white relative">
      {/* Header Carrito */}
      <div className="p-4 border-b flex items-center justify-between shrink-0 bg-slate-50">
        <div>
          <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight">Tu Pedido</h2>
          <span className="text-xs font-bold text-slate-400">{cart.length} ítems agregados</span>
        </div>
        {isMobile && (
          <button onClick={() => setIsMobileCartOpen(false)} className="p-2 bg-white rounded-full text-slate-400 shadow-sm border border-slate-100">
            <ChevronDown className="w-6 h-6" />
          </button>
        )}
      </div>

      {/* Selector de Cliente */}
      <div className="p-4 border-b shrink-0 bg-white">
        <div className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-100 rounded-2xl focus-within:border-indigo-500 transition-colors">
          <div className="p-2 bg-white text-indigo-600 rounded-xl shadow-sm">
            <User className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            {selectedCustomer ? (
              <div className="flex justify-between items-center">
                <div className="truncate">
                  <p className="text-sm font-black text-slate-800 truncate">{selectedCustomer.name}</p>
                  <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Cliente Seleccionado</p>
                </div>
                <button onClick={() => setSelectedCustomer(null)} className="text-slate-300 hover:text-red-500 p-2">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <select 
                className="w-full bg-transparent outline-none text-sm font-bold text-slate-500 appearance-none"
                onChange={(e) => setSelectedCustomer(customers.find(c => c.id === e.target.value) || null)}
                value=""
              >
                <option value="" disabled>Seleccionar Cliente (Opcional)...</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            )}
          </div>
        </div>
      </div>

      {/* Lista de Items */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar pb-32">
        {cart.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-4 opacity-50">
            <ShoppingCart className="w-16 h-16" />
            <p className="font-black text-sm uppercase tracking-widest text-center">Selecciona productos<br/>de la lista</p>
          </div>
        ) : (
          cart.map(item => (
            <div key={item.productId} className="flex flex-col p-3 rounded-2xl bg-slate-50 border border-slate-100 relative overflow-hidden">
              <div className="flex justify-between items-start mb-2 relative z-10">
                <h4 className="font-bold text-slate-800 text-sm line-clamp-2 w-[70%]">{item.name}</h4>
                <p className="text-indigo-600 font-black text-sm">${Number(item.subtotal).toFixed(2)}</p>
              </div>
              
              <div className="flex items-center justify-between relative z-10">
                <p className="text-[10px] text-slate-400 font-bold uppercase">x${Number(item.price).toFixed(2)}</p>
                <div className="flex items-center gap-3 bg-white rounded-lg border border-slate-200 p-1 shadow-sm">
                  <button onClick={() => updateQuantity(item.productId, -1)} className="w-8 h-8 flex items-center justify-center rounded-md bg-slate-100 text-slate-600 active:bg-slate-200"><Minus className="w-4 h-4" /></button>
                  <span className="text-sm font-black text-slate-800 w-6 text-center">{item.quantity}</span>
                  <button onClick={() => updateQuantity(item.productId, 1)} className="w-8 h-8 flex items-center justify-center rounded-md bg-indigo-600 text-white active:bg-indigo-700"><Plus className="w-4 h-4" /></button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer Totales (Pegado abajo) */}
      <div className="absolute bottom-0 left-0 right-0 p-6 bg-white border-t border-slate-100 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] z-20 pb-safe">
        <div className="flex justify-between items-end mb-4">
          <span className="text-slate-500 font-bold text-xs uppercase tracking-wider">Total a Pagar</span>
          <span className="text-4xl font-black text-slate-900 tracking-tight">${Number(cartTotal).toFixed(2)}</span>
        </div>
        <button 
          disabled={cart.length === 0}
          onClick={() => setShowCheckout(true)}
          className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-indigo-200 hover:bg-indigo-700 disabled:opacity-50 disabled:shadow-none transition-all active:scale-[0.98] flex items-center justify-center gap-2"
        >
          <span>TERMINAR VENTA</span>
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-full relative overflow-hidden bg-slate-100">
      
      {/* --- COLUMNA IZQUIERDA: LISTA DE PRODUCTOS --- */}
      <div className="flex-1 flex flex-col h-full min-w-0">
        <div className="p-4 bg-white border-b sticky top-0 z-10 shadow-sm shrink-0">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input 
              type="text"
              placeholder="Buscar por nombre, código o categoría..."
              className="w-full pl-12 pr-4 py-3.5 bg-slate-100 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-700 placeholder:font-medium"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 sm:p-4 pb-24 md:pb-4 no-scrollbar">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
            {filteredProducts.map(p => {
              const stock = Number(p.stock) || 0;
              const hasStock = stock > 0;
              return (
                <button 
                  key={p.id}
                  onClick={() => addToCart(p)}
                  disabled={!hasStock}
                  className="bg-white p-3 rounded-2xl shadow-sm border border-slate-200 text-left relative active:scale-95 transition-all disabled:opacity-60 disabled:grayscale flex flex-col h-full"
                >
                  <div className="w-full aspect-square bg-slate-50 rounded-xl mb-3 overflow-hidden flex items-center justify-center text-slate-300 relative">
                    {p.image ? (
                      <img src={p.image} className="w-full h-full object-cover" alt={p.name} loading="lazy" />
                    ) : (
                      <ShoppingCart className="w-8 h-8 opacity-20" />
                    )}
                    {!hasStock && (
                      <div className="absolute inset-0 bg-slate-100/80 flex items-center justify-center">
                        <span className="text-[10px] font-black uppercase text-red-500 border border-red-200 bg-red-50 px-2 py-1 rounded">Agotado</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1 min-h-0">
                    <h3 className="font-bold text-slate-800 text-xs sm:text-sm leading-tight line-clamp-2 mb-1">{p.name}</h3>
                    <p className="text-[10px] text-slate-400 font-medium mb-2 truncate">{p.category}</p>
                  </div>

                  <div className="mt-auto flex justify-between items-end border-t border-slate-50 pt-2">
                    <span className="text-sm sm:text-base font-black text-indigo-600">${Number(p.price).toFixed(2)}</span>
                    <span className={`text-[9px] font-bold ${stock > 5 ? 'text-emerald-500' : 'text-orange-500'}`}>
                      {stock}u
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* --- COLUMNA DERECHA: CARRITO (Escritorio) --- */}
      <div className="hidden md:flex w-96 flex-col border-l bg-white shadow-xl z-20">
        <CartContent isMobile={false} />
      </div>

      {/* --- BOTÓN FLOTANTE MÓVIL --- */}
      {!isMobileCartOpen && (
        <div className="md:hidden fixed bottom-20 left-4 right-4 z-30">
          <button 
            onClick={() => setIsMobileCartOpen(true)}
            className="w-full bg-slate-900 text-white rounded-2xl p-4 shadow-2xl shadow-slate-900/40 flex items-center justify-between active:scale-95 transition-transform border border-slate-700/50"
          >
            <div className="flex items-center gap-3">
              <div className="bg-indigo-500 w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm">
                {cartItemsCount}
              </div>
              <div className="flex flex-col items-start">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Ver Carrito</span>
                <span className="text-lg font-black leading-none">${Number(cartTotal).toFixed(2)}</span>
              </div>
            </div>
            <ChevronUp className="w-6 h-6 text-slate-400" />
          </button>
        </div>
      )}

      {/* --- CARRITO MÓVIL (OVERLAY CON Z-INDEX SUPERIOR A NAV) --- */}
      {isMobileCartOpen && (
        <div className="md:hidden fixed inset-0 z-[60] bg-slate-900/50 backdrop-blur-sm flex items-end">
          <div className="bg-white w-full h-[90vh] rounded-t-[2rem] shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-300">
             {/* Manija para cerrar */}
             <div className="flex justify-center pt-3 pb-1 shrink-0 bg-white" onClick={() => setIsMobileCartOpen(false)}>
                <div className="w-12 h-1.5 bg-slate-200 rounded-full"></div>
             </div>
             <CartContent isMobile={true} />
          </div>
        </div>
      )}

      {/* --- MODAL DE PAGO (Checkout) Z-INDEX SUPERIOR --- */}
      {showCheckout && (
        <div className="fixed inset-0 z-[70] bg-slate-900/60 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-[2.5rem] sm:rounded-[2.5rem] p-8 w-full max-w-md shadow-2xl animate-in slide-in-from-bottom duration-300 sm:zoom-in">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">Forma de Pago</h2>
              <button onClick={() => setShowCheckout(false)} className="p-2 bg-slate-50 rounded-full text-slate-400"><X className="w-6 h-6"/></button>
            </div>
            
            <div className="text-center mb-8 bg-slate-50 rounded-2xl p-6 border border-slate-100">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Total a cobrar</p>
              <p className="text-5xl font-black text-slate-900 tracking-tight">${Number(cartTotal).toFixed(2)}</p>
            </div>

            <div className="space-y-3 mb-8">
              <PaymentOption icon={<Banknote className="w-6 h-6" />} label="Efectivo" description="Billete físico" onClick={() => handleCheckout('Efectivo')} color="bg-emerald-500" />
              <PaymentOption icon={<CreditCard className="w-6 h-6" />} label="Tarjeta" description="Débito / Crédito" onClick={() => handleCheckout('Tarjeta')} color="bg-blue-500" />
              <PaymentOption icon={<Layout className="w-6 h-6" />} label="Transferencia" description="MercadoPago / Banco" onClick={() => handleCheckout('Transferencia')} color="bg-purple-500" />
            </div>
          </div>
        </div>
      )}

      {/* --- RECIBO (Ticket) Z-INDEX SUPERIOR --- */}
      {showReceipt && lastSale && (
        <Receipt sale={lastSale} onClose={() => setShowReceipt(false)} />
      )}
    </div>
  );
};

const PaymentOption = ({ icon, label, description, onClick, color }: any) => (
  <button 
    onClick={onClick}
    className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-slate-100 hover:border-indigo-600 transition-all group text-left active:scale-[0.98] bg-white"
  >
    <div className={`w-12 h-12 rounded-xl ${color} text-white flex items-center justify-center shrink-0 shadow-lg`}>
      {icon}
    </div>
    <div className="flex-1">
      <h3 className="font-bold text-slate-800 text-sm">{label}</h3>
      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{description}</p>
    </div>
    <div className="w-6 h-6 rounded-full border-2 border-slate-200 group-hover:border-indigo-600 group-hover:bg-indigo-600 transition-colors"></div>
  </button>
);

export default POS;
