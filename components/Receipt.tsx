
import React, { useState, useEffect } from 'react';
import { Sale, Customer, TableName } from '../types';
import { db } from '../db';
import { printer, PrintCustomOptions } from '../printer';
import { Printer, X, Bluetooth, CheckCircle2, AlertCircle, Smartphone, MessageSquare, Send, Settings, Wifi, Copy, Wallet, Calculator, Clock } from 'lucide-react';

interface ReceiptProps {
  sale: Sale;
  onClose: () => void;
}

const Receipt: React.FC<ReceiptProps> = ({ sale, onClose }) => {
  const [isPrinting, setIsPrinting] = useState(false);
  const [status, setStatus] = useState<{msg: string, type: 'success' | 'error' | 'info'} | null>(null);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [whatsappPhone, setWhatsappPhone] = useState('');

  // Estados para Configuración de Impresión
  const [showPrintConfig, setShowPrintConfig] = useState(false);
  const [printMethod, setPrintMethod] = useState<'bt' | 'wifi' | null>(null);
  const [copies, setCopies] = useState(1);
  const [paymentType, setPaymentType] = useState<'full' | 'partial'>('full');
  const [partialAmount, setPartialAmount] = useState<string>('');

  useEffect(() => {
    if (sale.customerId) {
      db.getById<Customer>(TableName.CUSTOMERS, sale.customerId).then(customer => {
        if (customer?.phone) {
          setWhatsappPhone(customer.phone);
        }
      });
    }
  }, [sale.customerId]);

  const initiatePrint = (method: 'bt' | 'wifi') => {
    setPrintMethod(method);
    setCopies(1);
    setPaymentType('full');
    setPartialAmount('');
    setShowPrintConfig(true);
  };

  const executePrint = async () => {
    if (!printMethod) return;
    setIsPrinting(true);
    setShowPrintConfig(false);
    setStatus({ msg: 'Iniciando impresión...', type: 'info' });

    const options: PrintCustomOptions = {
      isPartial: paymentType === 'partial',
      paidAmount: paymentType === 'partial' ? parseFloat(partialAmount) || 0 : undefined
    };

    try {
      for (let i = 0; i < copies; i++) {
        // Actualizar estado visual
        if (copies > 1) {
          setStatus({ msg: `Imprimiendo copia ${i + 1} de ${copies}...`, type: 'info' });
        }

        if (printMethod === 'bt') {
          const result = await printer.print(sale, options);
          if (!result.success) throw new Error(result.error);
        } else {
          printer.printViaSystem(sale, options);
        }

        // Sleep de 4 segundos entre copias (solo si no es la última)
        if (i < copies - 1) {
           setStatus({ msg: `Esperando 4s para siguiente copia...`, type: 'info' });
           await new Promise(resolve => setTimeout(resolve, 4000));
        }
      }
      setStatus({ msg: '¡Impresión finalizada!', type: 'success' });
    } catch (e: any) {
      setStatus({ msg: e.message || 'Error al imprimir', type: 'error' });
    } finally {
      setIsPrinting(false);
    }
  };

  const handleSendWhatsApp = () => {
    if (!whatsappPhone) return;
    const cleanPhone = whatsappPhone.replace(/\D/g, '');
    let message = `*RECIBO DE COMPRA - PAPELERA LC*\n`;
    message += `_Ticket: #${sale.id.slice(0, 8).toUpperCase()}_\n`;
    message += `--------------------------------\n`;
    message += `Fecha: ${new Date(sale.timestamp).toLocaleString()}\n`;
    message += `Cliente: ${sale.customerName || 'Mostrador'}\n`;
    message += `--------------------------------\n`;
    sale.items.forEach(item => {
      message += `* ${item.name} (${item.quantity}x) -> *$${Number(item.subtotal).toFixed(2)}*\n`;
    });
    message += `--------------------------------\n`;
    message += `TOTAL A PAGAR: $${Number(sale.total).toFixed(2)}\n`;
    message += `Metodo: ${sale.paymentMethod}\n`;
    message += `--------------------------------\n`;
    message += `¡GRACIAS POR CONFIAR EN NOSOTROS!`;

    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
    setShowWhatsAppModal(false);
  };

  return (
    <div className="fixed inset-0 z-[150] bg-slate-900/80 backdrop-blur-xl flex items-center justify-center p-4">
      <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-sm overflow-hidden flex flex-col max-h-[95vh] animate-in zoom-in duration-300 relative">
        <div className="px-8 py-6 bg-slate-50/50 border-b flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Papelera LC</h3>
              <p className="text-sm font-black text-slate-800">#{sale.id.slice(0, 8).toUpperCase()}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-3 hover:bg-slate-200 rounded-full text-slate-400 transition-all"><X className="w-5 h-5" /></button>
        </div>

        {status && (
          <div className={`px-6 py-3 text-[10px] font-black text-center text-white flex items-center justify-center gap-2 uppercase tracking-tight ${status.type === 'success' ? 'bg-emerald-500' : status.type === 'info' ? 'bg-indigo-500' : 'bg-red-500'}`}>
            {status.type === 'success' ? <CheckCircle2 className="w-3 h-3" /> : status.type === 'info' ? <Clock className="w-3 h-3 animate-pulse" /> : <AlertCircle className="w-3 h-3" />}
            {status.msg}
          </div>
        )}

        {/* VISTA PREVIA DEL TICKET */}
        <div className="flex-1 overflow-y-auto p-6 flex justify-center no-scrollbar bg-slate-100/50">
          <div className="bg-white shadow-2xl border border-slate-100 w-[58mm] min-h-[250px] p-6 font-mono leading-relaxed text-slate-900 relative">
            <div className="text-center mb-6 border-b border-dashed border-slate-200 pb-4">
              <p className="font-black text-2xl leading-none mb-1 tracking-tighter">PAPELERA LC</p>
            </div>
            <div className="space-y-6 mb-8">
              {sale.items.map((item, i) => (
                <div key={i} className="flex flex-col border-b border-dashed border-slate-200 pb-3 last:border-0">
                  <span className="font-black uppercase text-lg leading-tight mb-1">{item.name}</span>
                  <div className="flex justify-between text-slate-600 text-sm font-bold">
                    <span>{item.quantity} x ${Number(item.price).toFixed(2)}</span>
                    <span className="font-black text-slate-900">${Number(item.subtotal).toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t-2 border-dashed border-slate-900 pt-4 flex justify-between items-end mb-6">
              <span className="font-black text-sm uppercase">Total</span>
              <span className="text-2xl font-black">${Number(sale.total).toFixed(2)}</span>
            </div>
            <div className="text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">
              ¡Gracias por confiar en nosotros!
            </div>
          </div>
        </div>

        {/* BOTONES PRINCIPALES */}
        <div className="p-8 bg-white border-t space-y-3">
          <button onClick={() => setShowWhatsAppModal(true)} className="w-full py-4 bg-emerald-500 text-white rounded-2xl font-black text-[10px] flex items-center justify-center gap-3 shadow-xl uppercase tracking-widest hover:bg-emerald-600 transition-all">
            <MessageSquare className="w-5 h-5" /> WHATSAPP
          </button>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => initiatePrint('wifi')} className="py-4 bg-indigo-600 text-white rounded-2xl font-black text-[10px] flex items-center justify-center gap-3 shadow-xl uppercase tracking-widest hover:bg-indigo-700 transition-all">
              <Wifi className="w-5 h-5" /> WIFI / RED
            </button>
            <button onClick={() => initiatePrint('bt')} disabled={isPrinting} className={`py-4 rounded-2xl font-black text-[10px] flex items-center justify-center gap-3 border-2 ${isPrinting ? 'bg-slate-100 border-slate-100 text-slate-300' : 'bg-white border-slate-900 text-slate-900'} uppercase tracking-widest`}>
              {isPrinting ? <Settings className="w-4 h-4 animate-spin" /> : <Bluetooth className="w-4 h-4" />} BLUETOOTH
            </button>
          </div>
        </div>

        {/* MODAL WHATSAPP */}
        {showWhatsAppModal && (
          <div className="absolute inset-0 z-[160] bg-slate-900/70 backdrop-blur-xl flex items-end animate-in slide-in-from-bottom duration-300">
            <div className="bg-white w-full rounded-t-[3.5rem] p-10 shadow-[0_-20px_50px_rgba(0,0,0,0.3)]">
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h4 className="font-black text-slate-800 uppercase tracking-widest text-xs">Destinatario</h4>
                </div>
                <button onClick={() => setShowWhatsAppModal(false)} className="p-3 bg-slate-50 rounded-full text-slate-300"><X className="w-5 h-5" /></button>
              </div>
              <div className="space-y-6">
                <input autoFocus type="tel" placeholder="Ej: +54 9 11 2233 4455" className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-[1.5rem] outline-none font-black text-slate-800 text-lg" value={whatsappPhone} onChange={(e) => setWhatsappPhone(e.target.value)} />
                <button onClick={handleSendWhatsApp} disabled={!whatsappPhone} className="w-full py-5 bg-emerald-500 text-white rounded-[1.5rem] font-black text-xs flex items-center justify-center gap-3 active:scale-95 transition-all disabled:opacity-30 uppercase tracking-widest">
                  <Send className="w-4 h-4" /> ENVIAR AHORA
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL CONFIGURACIÓN IMPRESIÓN */}
        {showPrintConfig && (
           <div className="absolute inset-0 z-[170] bg-slate-900/80 backdrop-blur-xl flex items-end sm:items-center justify-center animate-in fade-in duration-200">
             <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 m-4 shadow-2xl animate-in slide-in-from-bottom duration-300">
                <div className="flex justify-between items-center mb-6">
                  <h4 className="font-black text-slate-800 uppercase tracking-widest text-sm flex items-center gap-2">
                    <Settings className="w-4 h-4 text-indigo-600" /> Opciones de Impresión
                  </h4>
                  <button onClick={() => setShowPrintConfig(false)} className="p-2 bg-slate-50 rounded-full text-slate-300 hover:bg-slate-100"><X className="w-5 h-5" /></button>
                </div>

                <div className="space-y-6">
                  {/* Cantidad de Copias */}
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block flex items-center gap-2">
                        <Copy className="w-3 h-3" /> Cantidad de Copias
                     </label>
                     <div className="flex items-center gap-4">
                        <button onClick={() => setCopies(Math.max(1, copies - 1))} className="w-10 h-10 bg-white rounded-xl shadow-sm border border-slate-200 flex items-center justify-center font-bold text-slate-600">-</button>
                        <span className="flex-1 text-center font-black text-2xl text-slate-800">{copies}</span>
                        <button onClick={() => setCopies(copies + 1)} className="w-10 h-10 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-200 flex items-center justify-center font-bold text-white">+</button>
                     </div>
                  </div>

                  {/* Tipo de Pago */}
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block flex items-center gap-2">
                        <Wallet className="w-3 h-3" /> Estado del Pago
                     </label>
                     <div className="grid grid-cols-2 gap-2 mb-4">
                        <button 
                          onClick={() => setPaymentType('full')}
                          className={`py-3 rounded-xl font-bold text-xs transition-all ${paymentType === 'full' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-slate-500 border border-slate-200'}`}
                        >
                          COMPLETO
                        </button>
                        <button 
                          onClick={() => setPaymentType('partial')}
                          className={`py-3 rounded-xl font-bold text-xs transition-all ${paymentType === 'partial' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-slate-500 border border-slate-200'}`}
                        >
                          PARCIAL / SEÑA
                        </button>
                     </div>

                     {paymentType === 'partial' && (
                       <div className="animate-in slide-in-from-top-2 fade-in">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-tight mb-1 block">Monto que abona el cliente</label>
                          <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-slate-400">$</span>
                            <input 
                              type="number" 
                              autoFocus
                              className="w-full pl-8 pr-4 py-3 bg-white border-2 border-indigo-100 focus:border-indigo-500 rounded-xl outline-none font-black text-lg text-slate-800"
                              placeholder="0.00"
                              value={partialAmount}
                              onChange={(e) => setPartialAmount(e.target.value)}
                            />
                          </div>
                          <div className="mt-2 flex justify-between items-center px-2">
                             <span className="text-[10px] font-bold text-slate-400 uppercase">Resta Pagar:</span>
                             <span className="text-sm font-black text-red-500">
                               ${(sale.total - (parseFloat(partialAmount) || 0)).toFixed(2)}
                             </span>
                          </div>
                       </div>
                     )}
                  </div>

                  <button 
                    onClick={executePrint}
                    className="w-full py-5 bg-slate-900 text-white rounded-[1.5rem] font-black text-xs flex items-center justify-center gap-3 shadow-xl active:scale-95 transition-all uppercase tracking-widest"
                  >
                    <Settings className="w-4 h-4" /> CONFIRMAR E IMPRIMIR
                  </button>
                </div>
             </div>
           </div>
        )}

      </div>
    </div>
  );
};

export default Receipt;
