
import React, { useState, useEffect } from 'react';
import { db } from './db';
import { syncEngine, SyncStatus } from './sync';
import { TableName } from './types';
import POS from './components/POS';
import Inventory from './components/Inventory';
import Customers from './components/Customers';
import Dashboard from './components/Dashboard';
import DeliveryMap from './components/DeliveryMap';
import { LayoutDashboard, CloudOff, Cloud, RefreshCw, ShoppingCart, Package, Users, Settings, Map, UploadCloud, Download, Share, X, Zap, Smartphone, Database, Wifi } from 'lucide-react';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'pos' | 'inventory' | 'customers' | 'delivery' | 'dashboard'>('pos');
  const [isDbReady, setIsDbReady] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isWifi, setIsWifi] = useState(true);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  
  // PWA State
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [canInstall, setCanInstall] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIosModal, setShowIosModal] = useState(false);

  useEffect(() => {
    const notifyNetworkType = () => {
      const online = navigator.onLine;
      const conn = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
      
      const wifiStatus = online && conn ? (conn.type === 'wifi' || conn.type === 'ethernet' || !conn.type) : false;
      
      setIsOnline(online);
      setIsWifi(wifiStatus);
      
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'NETWORK_TYPE',
          isWifi: wifiStatus
        });
      }
    };

    const initApp = async () => {
      try {
        await db.init();
        setIsDbReady(true);
        syncEngine.subscribe(setSyncStatus);
        syncEngine.startAutoSync();
        notifyNetworkType();

        // Detectar si ya está instalado
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone;
        
        // Detectar iOS
        const userAgent = window.navigator.userAgent.toLowerCase();
        const ios = /iphone|ipad|ipod/.test(userAgent);
        setIsIOS(ios);

        if (!isStandalone) {
          if (ios) {
            setShowInstallBanner(true);
          }
        }
      } catch (e) {
        console.error("Error DB:", e);
      }
    };

    const handleBeforeInstall = (e: any) => {
      e.preventDefault();
      (window as any).deferredPrompt = e;
      setCanInstall(true);
      setShowInstallBanner(true);
    };

    window.addEventListener('pwa-ready', () => {
      setCanInstall(true);
      setShowInstallBanner(true);
    });
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('online', notifyNetworkType);
    window.addEventListener('offline', notifyNetworkType);

    const conn = (navigator as any).connection;
    if (conn) conn.addEventListener('change', notifyNetworkType);

    initApp();
    
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      if (conn) conn.removeEventListener('change', notifyNetworkType);
    };
  }, []);

  const handleInstall = async () => {
    if (isIOS) { setShowIosModal(true); return; }
    const promptEvent = (window as any).deferredPrompt;
    if (promptEvent) {
      promptEvent.prompt();
      const { outcome } = await promptEvent.userChoice;
      if (outcome === 'accepted') setShowInstallBanner(false);
      (window as any).deferredPrompt = null;
    }
  };

  if (!isDbReady) return null;

  return (
    <div className="flex flex-col h-full w-full bg-slate-50 text-slate-900 overflow-hidden font-sans">
      
      {/* BANNER DE INSTALACIÓN PWA */}
      {showInstallBanner && (
        <div className="bg-slate-900 text-white px-5 py-4 shadow-2xl flex items-center justify-between shrink-0 relative z-[100] border-b border-white/10 animate-in slide-in-from-top duration-500">
          <div className="flex items-center gap-4">
            <div className="bg-indigo-600 p-2.5 rounded-2xl shadow-lg shadow-indigo-500/20">
              <Zap className="w-5 h-5 text-white fill-white" />
            </div>
            <div>
              <p className="font-black text-xs uppercase tracking-widest leading-none mb-1">Papelera LC Pro</p>
              <p className="text-[9px] text-slate-400 font-bold leading-none uppercase tracking-tighter">Instala la App para uso Offline Total</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleInstall} className={`px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all flex items-center gap-2 ${canInstall || isIOS ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-500 cursor-not-allowed'}`}>
              <Download className="w-3.5 h-3.5" /> {canInstall || isIOS ? 'INSTALAR' : 'CARGANDO'}
            </button>
            <button onClick={() => setShowInstallBanner(false)} className="p-2 text-slate-600"><X className="w-4 h-4" /></button>
          </div>
        </div>
      )}

      {/* Indicador de Modo de Carga Inteligente (WiFi / Datos / Offline) */}
      <div className={`px-4 py-1.5 flex items-center justify-center gap-2 text-[8px] font-black uppercase tracking-[0.2em] border-b transition-colors ${!isOnline ? 'bg-slate-950 text-red-500 border-slate-800' : (!isWifi ? 'bg-indigo-900 text-indigo-200 border-indigo-800' : 'bg-white text-slate-400 border-slate-100')}`}>
        {!isOnline ? (
          <><CloudOff className="w-3 h-3" /> SIN SEÑAL: CARGANDO 100% DESDE MEMORIA LOCAL</>
        ) : (!isWifi ? (
          <><Database className="w-3 h-3" /> MODO DATOS: CARGANDO DESDE MEMORIA (AHORRO)</>
        ) : (
          <><Wifi className="w-3 h-3 text-emerald-500" /> MODO WIFI: CARGA NORMAL Y ACTUALIZACIÓN</>
        ))}
      </div>

      <header className="bg-white px-6 py-4 flex justify-between items-center shrink-0 border-b border-slate-100 shadow-sm z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg">
            <LayoutDashboard className="w-5 h-5" />
          </div>
          <h1 className="text-lg font-black tracking-tighter uppercase leading-none">
            PAPELERA<br/><span className="text-indigo-600">LC PRO</span>
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <div className={`px-3 py-1.5 rounded-full text-[9px] font-black border flex items-center gap-1.5 transition-all ${syncStatus === 'syncing' ? 'bg-indigo-50 text-indigo-700 border-indigo-100' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
            {syncStatus === 'syncing' ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Cloud className="w-3 h-3" />}
            <span className="uppercase hidden sm:inline">{syncStatus === 'syncing' ? 'Sincronizando' : (isOnline ? 'Nube Conectada' : 'Modo Local')}</span>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-hidden relative bg-slate-100">
        <div className="absolute inset-0 app-scroll no-scrollbar">
          {activeTab === 'pos' && <POS />}
          {activeTab === 'inventory' && <Inventory />}
          {activeTab === 'customers' && <Customers />}
          {activeTab === 'delivery' && <DeliveryMap />}
          {activeTab === 'dashboard' && <Dashboard />}
        </div>
      </main>

      <nav className="bg-white/95 backdrop-blur-md border-t border-slate-100 flex justify-around items-center px-4 pt-3 pb-8 shrink-0 z-50">
        <NavButton active={activeTab === 'pos'} onClick={() => setActiveTab('pos')} label="Ventas" icon={<ShoppingCart className="w-5 h-5" />} />
        <NavButton active={activeTab === 'inventory'} onClick={() => setActiveTab('inventory')} label="Stock" icon={<Package className="w-5 h-5" />} />
        <NavButton active={activeTab === 'customers'} onClick={() => setActiveTab('customers')} label="Clientes" icon={<Users className="w-5 h-5" />} />
        <NavButton active={activeTab === 'delivery'} onClick={() => setActiveTab('delivery')} label="Reparto" icon={<Map className="w-5 h-5" />} />
        <NavButton active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} label="Panel" icon={<Settings className="w-5 h-5" />} />
      </nav>

      {/* Modal Tutorial iOS */}
      {showIosModal && (
        <div className="fixed inset-0 z-[200] bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-6" onClick={() => setShowIosModal(false)}>
          <div className="bg-white rounded-[2.5rem] w-full max-w-xs p-8 text-center shadow-2xl animate-in zoom-in duration-300">
            <Smartphone className="w-12 h-12 text-indigo-600 mx-auto mb-5" />
            <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight mb-4 leading-tight">Instalar en iPhone</h3>
            <div className="space-y-4 text-left bg-slate-50 p-5 rounded-2xl border border-slate-100">
              <p className="text-[11px] font-bold text-slate-600 uppercase">1. Toca el botón <Share className="w-4 h-4 inline mx-1" /> compartir.</p>
              <p className="text-[11px] font-bold text-slate-600 uppercase">2. Elige "Agregar a Inicio".</p>
            </div>
            <button className="mt-8 w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl">Entendido</button>
          </div>
        </div>
      )}
    </div>
  );
};

const NavButton = ({ active, onClick, label, icon }: any) => (
  <button onClick={onClick} className={`flex flex-col items-center gap-1.5 transition-all w-16 ${active ? 'text-indigo-600' : 'text-slate-300'}`}>
    <div className={`p-2 rounded-2xl transition-all ${active ? 'bg-indigo-50 shadow-sm' : ''}`}>{icon}</div>
    <span className={`text-[8px] font-black uppercase tracking-tighter ${active ? 'opacity-100' : 'opacity-60'}`}>{label}</span>
  </button>
);

export default App;
