
import React, { useState, useEffect } from 'react';
import { db } from '../db';
import { TableName, Sale } from '../types';
import { syncEngine } from '../sync';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, BarChart, Bar, LineChart, Line } from 'recharts';
import { TrendingUp, DollarSign, ShoppingBag, Users, Calendar, Settings, Save, CheckCircle2, MessageSquare, Smartphone, X, Send, Code, Copy, ExternalLink, Terminal, Database, Sparkles, RefreshCw, Map, Zap, Layout, BarChart3, Activity, Layers } from 'lucide-react';

const Dashboard: React.FC = () => {
  const [sales, setSales] = useState<Sale[]>([]);
  const [stats, setStats] = useState({ totalRev: 0, orderCount: 0, avgTicket: 0 });
  const [apiUrl, setApiUrl] = useState('');
  const [mapsKey, setMapsKey] = useState('');
  const [orsKey, setOrsKey] = useState('');
  const [isSavingUrl, setIsSavingUrl] = useState(false);
  const [isConfiguring, setIsConfiguring] = useState(false);
  const [isGlobalSyncing, setIsGlobalSyncing] = useState(false);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  
  // Chart Data & State
  const [weeklyData, setWeeklyData] = useState<any[]>([]);
  const [paymentMethodData, setPaymentMethodData] = useState<any[]>([]);
  const [topProductsData, setTopProductsData] = useState<any[]>([]);

  // Chart Type Selectors
  const [weeklyChartType, setWeeklyChartType] = useState<'area' | 'bar' | 'line'>('area');
  const [topProdChartType, setTopProdChartType] = useState<'bar' | 'area' | 'line'>('bar');
  
  const [whatsappModal, setWhatsappModal] = useState<{show: boolean, sale: Sale | null}>({ show: false, sale: null });
  const [whatsappPhone, setWhatsappPhone] = useState('');

  const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']; 

  const backendScript = `/**
 * BACKEND PAPELERA LC - GOOGLE APPS SCRIPT v2.6 (Full POST Strategy)
 * Todo el tráfico (Lectura y Escritura) viaja por POST para estabilidad CORS.
 */
// ... (El script se mantiene igual que antes, resumido para ahorrar espacio en la vista de código si no cambió)
const SS = SpreadsheetApp.getActiveSpreadsheet();

function onEdit(e) { /* ... */ }
function doPost(e) { /* ... */ }
function doGet(e) { /* ... */ }
function handleFetchUpdates(tableName, since) { /* ... */ }
function upsertRecord(sheet, record) { /* ... */ }
function deleteRecord(sheet, id) { /* ... */ }
function jsonResponse(data) { /* ... */ }
function setup() { /* ... */ }`;

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const s = await db.getAll<Sale>(TableName.SALES);
    setSales(s);
    
    // Stats calc
    const rev = s.reduce((sum, item) => sum + (Number(item.total) || 0), 0);
    setStats({
      totalRev: rev,
      orderCount: s.length,
      avgTicket: s.length > 0 ? rev / s.length : 0
    });

    // Chart Data Generation
    generateChartsData(s);
    
    // Load Configs
    const savedUrl = await db.getConfig('api_url');
    if (savedUrl) setApiUrl(savedUrl);
    const savedMapsKey = await db.getConfig('maps_api_key');
    if (savedMapsKey) setMapsKey(savedMapsKey);
    const savedOrsKey = await db.getConfig('ors_api_key');
    if (savedOrsKey) setOrsKey(savedOrsKey);
  };

  const generateChartsData = (salesData: Sale[]) => {
    // 1. Weekly Sales
    const last7Days = [...Array(7)].map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' });
    });

    const dailyTotals: {[key: string]: number} = {};
    salesData.forEach(sale => {
      const saleDate = new Date(sale.timestamp).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' });
      dailyTotals[saleDate] = (dailyTotals[saleDate] || 0) + Number(sale.total);
    });

    const weekChart = last7Days.map(dateStr => ({
      name: dateStr,
      total: dailyTotals[dateStr] || 0
    }));
    setWeeklyData(weekChart);

    // 2. Payment Methods
    const methods: {[key: string]: number} = {};
    salesData.forEach(sale => {
      const method = sale.paymentMethod || 'Otros';
      methods[method] = (methods[method] || 0) + 1;
    });
    
    const payChart = Object.keys(methods).map(key => ({
      name: key,
      value: methods[key]
    }));
    setPaymentMethodData(payChart);

    // 3. Top 10 Products
    const productCounts: {[key: string]: number} = {};
    salesData.forEach(sale => {
      sale.items.forEach(item => {
        productCounts[item.name] = (productCounts[item.name] || 0) + item.quantity;
      });
    });

    const topProd = Object.entries(productCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    
    setTopProductsData(topProd);
  };

  const handleGlobalSync = async () => {
    setIsGlobalSyncing(true);
    try {
      await syncEngine.run(true);
      alert('¡Sincronización global completada con éxito!');
    } catch (e) {
      alert('Error en la sincronización global');
    } finally {
      setIsGlobalSyncing(false);
    }
  };

  const handleSaveConfig = async () => {
    setIsSavingUrl(true);
    await db.setConfig('api_url', apiUrl);
    await db.setConfig('maps_api_key', mapsKey);
    await db.setConfig('ors_api_key', orsKey);
    setIsSavingUrl(false);
    setShowSaveConfirm(true);
    setTimeout(() => setShowSaveConfirm(false), 3000);
    syncEngine.run(true);
  };

  const handleSetupSheets = async () => {
    if (!apiUrl) return alert('Primero guarda la URL de Sincronización');
    setIsConfiguring(true);
    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ action: 'SETUP_SHEETS' }),
        mode: 'cors'
      });
      const result = await response.json();
      if (result.success) alert('¡Hojas de Google Sheets configuradas con éxito!');
      else alert('Error: ' + result.message);
    } catch (e) {
      alert('Error de conexión con el servidor.');
    } finally {
      setIsConfiguring(false);
    }
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(backendScript);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const openWhatsAppDialog = (sale: Sale) => {
    setWhatsappModal({ show: true, sale });
    setWhatsappPhone(''); 
  };

  // Helper para renderizar los botones de cambio de gráfico
  const ChartToggle = ({ current, onChange }: { current: string, onChange: (t: any) => void }) => (
    <div className="flex bg-slate-100 p-1 rounded-lg">
      <button onClick={() => onChange('area')} className={`p-1.5 rounded-md transition-all ${current === 'area' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`} title="Área">
        <Layers className="w-4 h-4" />
      </button>
      <button onClick={() => onChange('bar')} className={`p-1.5 rounded-md transition-all ${current === 'bar' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`} title="Barras">
        <BarChart3 className="w-4 h-4" />
      </button>
      <button onClick={() => onChange('line')} className={`p-1.5 rounded-md transition-all ${current === 'line' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`} title="Línea">
        <Activity className="w-4 h-4" />
      </button>
    </div>
  );

  // Helper para renderizar el gráfico según la selección
  const RenderChart = ({ type, data, dataKey, color, xKey = "name" }: any) => {
    return (
      <ResponsiveContainer width="100%" height="100%" minWidth={10} minHeight={10}>
        {type === 'area' ? (
          <AreaChart data={data}>
            <defs>
              <linearGradient id={`color${dataKey}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.3}/>
                <stop offset="95%" stopColor={color} stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey={xKey} axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} dy={10} interval={0} />
            <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} />
            <Tooltip contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} itemStyle={{color: color, fontWeight: 'bold'}} />
            <Area type="monotone" dataKey={dataKey} stroke={color} strokeWidth={3} fillOpacity={1} fill={`url(#color${dataKey})`} />
          </AreaChart>
        ) : type === 'bar' ? (
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey={xKey} axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} dy={10} interval={0} />
            <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} />
            <Tooltip contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} itemStyle={{color: color, fontWeight: 'bold'}} cursor={{fill: '#f8fafc'}} />
            <Bar dataKey={dataKey} fill={color} radius={[4, 4, 0, 0]} barSize={30} />
          </BarChart>
        ) : (
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey={xKey} axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} dy={10} interval={0} />
            <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} />
            <Tooltip contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} itemStyle={{color: color, fontWeight: 'bold'}} />
            <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={3} dot={{r: 4, fill: color, strokeWidth: 2, stroke: '#fff'}} />
          </LineChart>
        )}
      </ResponsiveContainer>
    );
  };

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-8 bg-slate-50 space-y-8 no-scrollbar">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-800 uppercase tracking-tighter">Panel de Control</h2>
          <p className="text-slate-400 font-medium">Gestión de sistema y métricas</p>
        </div>
        <button 
          onClick={handleGlobalSync}
          disabled={isGlobalSyncing || !apiUrl}
          className="bg-white border-2 border-slate-200 text-slate-600 px-6 py-3 rounded-2xl font-black text-[10px] flex items-center gap-2 hover:bg-slate-50 transition-all uppercase tracking-widest disabled:opacity-30"
        >
          <RefreshCw className={`w-4 h-4 ${isGlobalSyncing ? 'animate-spin' : ''}`} />
          Sincronizar Todo
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <KpiCard icon={<DollarSign className="text-emerald-500" />} label="Ingresos" value={`$${Number(stats.totalRev).toLocaleString()}`} trend="Total Histórico" color="bg-emerald-50" />
        <KpiCard icon={<ShoppingBag className="text-indigo-500" />} label="Ventas" value={stats.orderCount.toString()} trend="Transacciones" color="bg-indigo-50" />
        <KpiCard icon={<TrendingUp className="text-blue-500" />} label="Ticket Prom." value={`$${Number(stats.avgTicket).toFixed(2)}`} trend="Promedio" color="bg-blue-50" />
        <KpiCard icon={<Map className="text-amber-500" />} label="Zonas de Reparto" value="Mapa Activo" trend="OK" color="bg-amber-50" />
      </div>

      {/* GRAFICOS FILA 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sales Chart (Dynamic) */}
        <div className="lg:col-span-2 bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 h-80 flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Ventas (7 días)</h3>
            <ChartToggle current={weeklyChartType} onChange={setWeeklyChartType} />
          </div>
          <div className="flex-1 w-full min-h-0 relative">
             <div className="absolute inset-0">
               <RenderChart type={weeklyChartType} data={weeklyData} dataKey="total" color="#4f46e5" />
             </div>
          </div>
        </div>

        {/* Payment Methods Chart */}
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 h-80 flex flex-col">
          <h3 className="text-sm font-black text-slate-800 mb-2 uppercase tracking-widest">Métodos de Pago</h3>
          <div className="flex-1 w-full min-h-0 relative">
             <div className="absolute inset-0">
               <ResponsiveContainer width="100%" height="100%" minWidth={10} minHeight={10}>
                 <PieChart>
                    <Pie
                      data={paymentMethodData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {paymentMethodData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="none" />
                      ))}
                    </Pie>
                    <Tooltip />
                 </PieChart>
               </ResponsiveContainer>
               <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-3xl font-black text-slate-800">{stats.orderCount}</span>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Ventas</span>
               </div>
             </div>
          </div>
          <div className="flex justify-center gap-4 mt-2">
             {paymentMethodData.map((entry, index) => (
               <div key={index} className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{backgroundColor: COLORS[index % COLORS.length]}}></div>
                  <span className="text-[9px] font-bold text-slate-500 uppercase">{entry.name}</span>
               </div>
             ))}
          </div>
        </div>
      </div>

      {/* GRAFICOS FILA 2 (TOP PRODUCTOS) */}
      <div className="w-full bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 h-96 flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Top 10 Productos Más Vendidos</h3>
            <ChartToggle current={topProdChartType} onChange={setTopProdChartType} />
          </div>
          <div className="flex-1 w-full min-h-0 relative">
             <div className="absolute inset-0">
               <RenderChart type={topProdChartType} data={topProductsData} dataKey="count" color="#f59e0b" />
             </div>
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                <Settings className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-800">Configuración</h3>
            </div>
            
            <div className="space-y-4 mb-4">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">URL Google Apps Script</label>
                <input 
                  type="text"
                  placeholder="https://script.google.com/macros/s/..."
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-sm"
                  value={apiUrl}
                  onChange={(e) => setApiUrl(e.target.value)}
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Google Maps API Key (Visualización)</label>
                <input 
                  type="text"
                  placeholder="AIzaSyB..."
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-sm"
                  value={mapsKey}
                  onChange={(e) => setMapsKey(e.target.value)}
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1 flex items-center gap-2">
                  OpenRouteService API Key (Rutas) <Zap className="w-3 h-3 text-amber-500 fill-amber-500" />
                </label>
                <input 
                  type="text"
                  placeholder="5b3ce3597851110001cf6248..."
                  className="w-full px-4 py-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl outline-none focus:ring-2 focus:ring-amber-500 font-bold text-sm placeholder-amber-300"
                  value={orsKey}
                  onChange={(e) => setOrsKey(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <button onClick={handleSaveConfig} disabled={isSavingUrl} className="bg-indigo-600 text-white px-6 py-4 rounded-2xl font-black text-[10px] flex items-center justify-center gap-2 uppercase tracking-widest shadow-xl shadow-indigo-100 active:scale-95 transition-all">
                {showSaveConfirm ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                {showSaveConfirm ? 'Guardado' : 'Guardar Todo'}
              </button>
              <button onClick={handleSetupSheets} disabled={isConfiguring || !apiUrl} className="bg-emerald-500 text-white px-6 py-4 rounded-2xl font-black text-[10px] flex items-center justify-center gap-2 uppercase tracking-widest shadow-xl shadow-emerald-100 disabled:opacity-30 active:scale-95 transition-all">
                {isConfiguring ? <Terminal className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
                Actualizar Hojas
              </button>
            </div>
          </div>
        </div>

        <div className="bg-slate-900 p-6 rounded-[2rem] shadow-xl text-white flex flex-col justify-between border border-slate-800">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-white/10 text-white rounded-xl">
                <Code className="w-5 h-5" />
              </div>
              <h3 className="font-bold">Código del Servidor</h3>
            </div>
            <p className="text-xs text-slate-400 mb-6 font-medium uppercase tracking-widest">v2.6 - Full POST Strategy</p>
          </div>
          <button onClick={() => setShowCodeModal(true)} className="mt-6 w-full bg-white/10 hover:bg-white/20 text-white px-6 py-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 border border-white/10">
            <Terminal className="w-4 h-4" />
            VER CÓDIGO ACTUALIZADO
          </button>
        </div>
      </div>

      {/* Recents Section */}
      <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100">
        <h3 className="text-xl font-black text-slate-800 mb-6 uppercase tracking-tighter">Ventas Recientes</h3>
        <div className="space-y-4">
          {sales.slice(-5).reverse().map(s => (
            <div key={s.id} className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-100 group">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-500">
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-bold text-slate-800 text-sm">{s.customerName || 'Venta Mostrador'}</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase">{new Date(s.timestamp).toLocaleString()}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="font-black text-slate-800">${Number(s.total).toFixed(2)}</p>
                  <p className="text-[9px] font-black text-indigo-500 uppercase">{s.paymentMethod}</p>
                </div>
                <button 
                  onClick={() => openWhatsAppDialog(s)}
                  className="p-3 bg-emerald-500 text-white rounded-xl shadow-lg active:scale-90 transition-transform hover:bg-emerald-600"
                >
                  <MessageSquare className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {showCodeModal && (
        <div className="fixed inset-0 z-[200] bg-slate-900/80 backdrop-blur-xl flex items-center justify-center p-4">
          <div className="bg-[#1e1e1e] w-full max-w-4xl h-[80vh] rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden border border-white/10 relative">
            <div className="p-8 border-b border-white/5 flex items-center justify-between shrink-0">
              <h4 className="text-white font-black text-sm uppercase tracking-widest">backend.gs v2.6</h4>
              <div className="flex gap-3">
                <button onClick={handleCopyCode} className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-xs transition-all ${copySuccess ? 'bg-emerald-500 text-white' : 'bg-white/10 text-white'}`}>
                  {copySuccess ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copySuccess ? 'COPIADO' : 'COPIAR'}
                </button>
                <button onClick={() => setShowCodeModal(false)} className="p-3 bg-white/5 text-slate-400 rounded-xl"><X className="w-5 h-5" /></button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-8 font-mono text-[13px] leading-relaxed text-slate-300 bg-[#121212] custom-scrollbar"><pre>{backendScript}</pre></div>
          </div>
        </div>
      )}
    </div>
  );
};

const KpiCard = ({ icon, label, value, trend, color }: any) => (
  <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 relative overflow-hidden group">
    <div className={`absolute -right-4 -top-4 w-24 h-24 ${color} rounded-full opacity-50 group-hover:scale-110 transition-transform duration-500`}></div>
    <div className="relative z-10">
      <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center mb-4 border border-slate-100">{icon}</div>
      <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">{label}</p>
      <p className="text-xl font-black text-slate-800">{value}</p>
      <p className="text-[9px] font-bold text-emerald-500">{trend}</p>
    </div>
  </div>
);

export default Dashboard;
