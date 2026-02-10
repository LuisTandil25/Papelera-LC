import React, { useState, useEffect, useRef } from 'react';
import { db } from '../db';
import { TableName, Product } from '../types';
import { syncEngine } from '../sync';
import { jsPDF } from 'jspdf';
import { Package, Plus, Search, Edit, FileUp, RefreshCw, CheckCircle2, AlertCircle, CheckSquare, Square, Info, X, MessageSquare, Smartphone, Send, FileText } from 'lucide-react';

const Inventory: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Estados para compartir vía WhatsApp
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [whatsappPhone, setWhatsappPhone] = useState('');

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    const data = await db.getAll<Product>(TableName.PRODUCTS);
    setProducts(data);
    setSelectedIds(new Set());
  };

  const showNotify = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(p => p.id)));
    }
  };

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      await syncEngine.run();
      await loadProducts();
      showNotify('Sincronización completada');
    } catch (e) {
      showNotify('Error en sincronización', 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;

    const newProduct: Product = {
      id: editingProduct.id || crypto.randomUUID(),
      name: editingProduct.name || 'Nuevo Producto',
      category: editingProduct.category || 'General',
      cost: Number(editingProduct.cost) || 0,
      price: Number(editingProduct.price) || 0,
      stock: Number(editingProduct.stock) || 0,
      barcode: editingProduct.barcode || '',
      image: editingProduct.image,
      updatedAt: Date.now()
    };

    await db.put(TableName.PRODUCTS, newProduct);
    setShowModal(false);
    loadProducts();
    showNotify('Producto guardado');
  };

  const handleCsvImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        const rows = text.split(/\r?\n/);
        if (rows.length < 2) return;

        const headers = rows[0].split(',').map(h => h.trim().toLowerCase());
        
        let importCount = 0;
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i].split(',').map(cell => cell.trim().replace(/^["']|["']$/g, ''));
          if (row.length < 2) continue;

          const data: any = {};
          headers.forEach((h, index) => { data[h] = row[index]; });

          const newProduct: Product = {
            id: data.id || crypto.randomUUID(),
            name: data.name || 'Importado',
            category: data.category || 'General',
            cost: parseFloat(data.cost) || 0,
            price: parseFloat(data.price) || 0,
            stock: parseInt(data.stock) || 0,
            barcode: data.barcode || '',
            image: data.image || '',
            updatedAt: Date.now()
          };
          
          await db.put(TableName.PRODUCTS, newProduct, false);
          importCount++;
        }
        loadProducts();
        showNotify(`Importados ${importCount} productos (Solo Local)`);
      } catch (err) {
        showNotify('Error al procesar el archivo', 'error');
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const generateAndSendPDF = () => {
    if (selectedIds.size === 0 || !whatsappPhone) return;
    
    const selectedProducts = products.filter(p => selectedIds.has(p.id));
    
    // 1. GENERAR PDF REAL
    const doc = new jsPDF();
    const dateStr = new Date().toLocaleDateString();
    
    // Título
    doc.setFontSize(22);
    doc.setTextColor(79, 70, 229); // Indigo 600
    doc.text('PAPELERA LC', 105, 20, { align: 'center' });
    
    doc.setFontSize(12);
    doc.setTextColor(100);
    doc.text('CATALOGO DE PRECIOS ACTUALIZADO', 105, 28, { align: 'center' });
    doc.text(`Fecha: ${dateStr}`, 105, 34, { align: 'center' });
    
    doc.setDrawColor(200);
    doc.line(20, 40, 190, 40);
    
    // Lista de Productos
    let y = 50;
    doc.setFontSize(10);
    doc.setTextColor(0);
    
    // Encabezados de tabla
    doc.setFont('helvetica', 'bold');
    doc.text('PRODUCTO', 25, y);
    doc.text('PRECIO', 170, y, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    
    y += 10;
    
    selectedProducts.forEach((p, index) => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      
      doc.text(p.name.toUpperCase(), 25, y);
      doc.setFont('helvetica', 'bold');
      doc.text(`$${Number(p.price).toFixed(2)}`, 170, y, { align: 'right' });
      doc.setFont('helvetica', 'normal');
      
      y += 8;
      doc.setDrawColor(240);
      doc.line(25, y - 4, 175, y - 4);
    });
    
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text('Precios sujetos a cambios sin previo aviso. Gracias por su confianza.', 105, 285, { align: 'center' });

    // 2. DESCARGAR PDF
    const fileName = `Catalogo_PapeleraLC_${dateStr.replace(/\//g, '-')}.pdf`;
    doc.save(fileName);
    
    // 3. ENVIAR WHATSAPP (Aviso de envío de archivo)
    const cleanPhone = whatsappPhone.replace(/\D/g, '');
    const message = `*CATÁLOGO DE PRECIOS - PAPELERA LC*\n\nHola! Te adjunto el catálogo de productos solicitado en PDF.\n\n_Generado el: ${dateStr}_`;
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
    
    window.open(url, '_blank');
    setShowPhoneModal(false);
    showNotify('PDF Generado y descargado. Adjúntalo en WhatsApp.');
  };

  const filtered = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (p.barcode && p.barcode.includes(searchTerm)) ||
    (p.category && p.category.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="h-full flex flex-col bg-white relative">
      {notification && (
        <div className={`fixed top-24 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-300 ${notification.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
          {notification.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          <span className="font-bold text-sm">{notification.message}</span>
        </div>
      )}

      <div className="p-6 border-b flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
        <div>
          <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2">
            Inventario
            <button onClick={() => setShowHelp(true)} className="text-slate-300 hover:text-indigo-600 transition-colors">
              <Info className="w-5 h-5" />
            </button>
          </h2>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-tight">Gestión Local y Nube</p>
        </div>
        
        <div className="flex flex-wrap gap-2">
          <div className="relative min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input 
              type="text"
              placeholder="Buscar..."
              className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="flex gap-1.5">
            {selectedIds.size > 0 && (
              <button 
                onClick={() => setShowPhoneModal(true)}
                className="bg-indigo-600 text-white px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-indigo-700 shadow-lg active:scale-95 transition-all text-sm uppercase animate-in zoom-in duration-200"
              >
                <FileText className="w-5 h-5" />
                <span>Generar PDF ({selectedIds.size})</span>
              </button>
            )}
            <button onClick={handleManualSync} className={`p-2.5 rounded-xl border border-slate-100 text-slate-600 active:scale-95 transition-all ${isSyncing ? 'animate-spin' : ''}`}>
              <RefreshCw className="w-5 h-5" />
            </button>
            <input type="file" accept=".csv" className="hidden" ref={fileInputRef} onChange={handleCsvImport} />
            <button onClick={() => fileInputRef.current?.click()} className="p-2.5 rounded-xl border border-slate-100 text-slate-600 active:scale-95 transition-all flex items-center gap-2">
              <FileUp className="w-5 h-5" />
              <span className="hidden sm:inline font-bold text-xs">CSV</span>
            </button>
            <button onClick={() => { setEditingProduct({}); setShowModal(true); }} className="bg-indigo-600 text-white px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-indigo-700 shadow-lg active:scale-95 transition-all text-sm uppercase">
              <Plus className="w-5 h-5" />
              <span>Nuevo</span>
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto no-scrollbar">
        <table className="w-full text-left border-collapse min-w-[800px]">
          <thead className="sticky top-0 bg-white border-b z-10">
            <tr className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              <th className="px-6 py-4 w-10">
                <button onClick={toggleSelectAll} className="text-slate-400 hover:text-indigo-600">
                  {selectedIds.size === filtered.length && filtered.length > 0 ? <CheckSquare className="w-5 h-5 text-indigo-600" /> : <Square className="w-5 h-5" />}
                </button>
              </th>
              <th className="px-6 py-4">Producto</th>
              <th className="px-6 py-4">Categoría</th>
              <th className="px-6 py-4">Precio</th>
              <th className="px-6 py-4">Stock</th>
              <th className="px-6 py-4 text-right"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.map(p => (
              <tr key={p.id} className={`hover:bg-slate-50 transition-colors group ${selectedIds.has(p.id) ? 'bg-indigo-50/50' : ''}`}>
                <td className="px-6 py-4">
                  <button onClick={() => toggleSelect(p.id)} className="text-slate-300 hover:text-indigo-600">
                    {selectedIds.has(p.id) ? <CheckSquare className="w-5 h-5 text-indigo-600" /> : <Square className="w-5 h-5" />}
                  </button>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 overflow-hidden shrink-0 border border-slate-200">
                      {p.image ? <img src={p.image} className="w-full h-full object-cover" /> : <Package className="w-5 h-5" />}
                    </div>
                    <div>
                      <p className="font-bold text-slate-800 text-sm leading-tight">{p.name}</p>
                      <p className="text-[10px] font-mono text-slate-400 mt-0.5">{p.barcode || 'S/C'}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className="px-2 py-1 bg-slate-100 text-slate-500 rounded text-[9px] font-black uppercase">{p.category}</span>
                </td>
                <td className="px-6 py-4 font-black text-slate-700 text-sm">${Number(p.price).toFixed(2)}</td>
                <td className="px-6 py-4">
                  <div className={`text-sm font-bold ${Number(p.stock) <= 5 ? 'text-red-500' : 'text-slate-600'}`}>
                    {p.stock}
                  </div>
                </td>
                <td className="px-6 py-4 text-right">
                  <button onClick={() => { setEditingProduct(p); setShowModal(true); }} className="p-2 text-slate-300 hover:text-indigo-600 transition-colors opacity-0 group-hover:opacity-100">
                    <Edit className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-[110] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleSave} className="bg-white rounded-[2rem] p-8 w-full max-w-lg shadow-2xl">
            <h2 className="text-2xl font-black text-slate-800 mb-6">{editingProduct?.id ? 'Editar' : 'Nuevo'} Producto</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400">Nombre del Producto</label>
                <input required className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-medium" value={editingProduct?.name || ''} onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400">Precio Venta</label>
                <input type="number" step="0.01" className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-medium" value={editingProduct?.price || ''} onChange={(e) => setEditingProduct({ ...editingProduct, price: Number(e.target.value) })} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400">Stock Inicial</label>
                <input type="number" className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-medium" value={editingProduct?.stock || ''} onChange={(e) => setEditingProduct({ ...editingProduct, stock: Number(e.target.value) })} />
              </div>
            </div>
            <div className="flex gap-4 mt-8">
              <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-3 bg-slate-50 text-slate-400 rounded-2xl font-black uppercase text-xs">Cancelar</button>
              <button type="submit" className="flex-[2] py-3 bg-indigo-600 text-white rounded-2xl font-black uppercase text-xs shadow-xl active:scale-95 transition-all">Guardar</button>
            </div>
          </form>
        </div>
      )}

      {/* Modal para solicitar Teléfono (WhatsApp) */}
      {showPhoneModal && (
        <div className="fixed inset-0 z-[160] bg-slate-900/70 backdrop-blur-xl flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-md rounded-t-[3rem] sm:rounded-[3rem] p-10 shadow-2xl animate-in slide-in-from-bottom duration-300">
            <div className="flex justify-between items-center mb-8">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">
                  <Smartphone className="w-7 h-7" />
                </div>
                <div>
                  <h4 className="font-black text-slate-800 uppercase tracking-tighter text-lg">Compartir Catálogo</h4>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Generación de PDF Real</p>
                </div>
              </div>
              <button onClick={() => setShowPhoneModal(false)} className="p-3 bg-slate-50 rounded-full text-slate-300 hover:bg-slate-100"><X className="w-6 h-6" /></button>
            </div>
            
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Número de Teléfono</label>
                <input 
                  autoFocus 
                  type="tel" 
                  placeholder="Ej: +54 9 11 2233 4455" 
                  className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-[1.5rem] outline-none font-black text-slate-800 text-lg focus:border-indigo-500 transition-colors" 
                  value={whatsappPhone} 
                  onChange={(e) => setWhatsappPhone(e.target.value)} 
                />
              </div>
              
              <div className="bg-indigo-50 p-4 rounded-2xl border border-indigo-100">
                <p className="text-[10px] font-bold text-indigo-700 uppercase tracking-tight leading-relaxed">
                  El sistema generará un archivo PDF con {selectedIds.size} productos y lo descargará en tu equipo. Luego podrás adjuntarlo en WhatsApp.
                </p>
              </div>

              <button 
                onClick={generateAndSendPDF} 
                disabled={!whatsappPhone || selectedIds.size === 0} 
                className="w-full py-5 bg-indigo-600 text-white rounded-[1.5rem] font-black text-xs flex items-center justify-center gap-3 active:scale-95 transition-all disabled:opacity-30 uppercase tracking-widest shadow-xl shadow-indigo-100"
              >
                <FileText className="w-4 h-4" /> GENERAR Y ENVIAR PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Inventory;