
import React, { useState, useEffect, useRef } from 'react';
import { db } from '../db';
import { TableName, DeliveryPoint } from '../types';
import { Plus, Save, Trash2, X, Truck, WifiOff, LocateFixed, Wifi, Zap, Navigation, RefreshCw, Route, Map as MapIcon, ExternalLink, Clock, Ruler } from 'lucide-react';

const DeliveryMap: React.FC = () => {
  const mapRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<any[]>([]);
  const polylineRef = useRef<any>(null);
  const directionsRendererRef = useRef<any>(null);
  
  const [map, setMap] = useState<any>(null);
  const [deliveryPoints, setDeliveryPoints] = useState<DeliveryPoint[]>([]);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [orsKey, setOrsKey] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  // Tracking State
  const [currentLocation, setCurrentLocation] = useState<{lat: number, lng: number} | null>(null);
  const [followUser, setFollowUser] = useState(true);
  const [isCalculating, setIsCalculating] = useState<'ors' | 'google' | null>(null);
  const [routeInfo, setRouteInfo] = useState<{distance: string, duration: string} | null>(null);
  
  // UI State
  const [showPointModal, setShowPointModal] = useState(false);
  const [newPointData, setNewPointData] = useState<{lat: number, lng: number, note: string} | null>(null);
  
  const DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const [selectedDay, setSelectedDay] = useState(DAYS[new Date().getDay()]);

  const pointsOfDay = deliveryPoints.filter(p => p.day === selectedDay);

  // 1. Carga Inicial y GPS
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    const loadData = async () => {
      const gKey = await db.getConfig('maps_api_key');
      const oKey = await db.getConfig('ors_api_key');
      setApiKey(gKey);
      setOrsKey(oKey);
      
      const points = await db.getAll<DeliveryPoint>(TableName.DELIVERY);
      setDeliveryPoints(points || []);
    };
    loadData();

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setCurrentLocation(coords);
        if (map && followUser && isOnline) map.panTo(coords);
      },
      (err) => console.warn("GPS Activo"),
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      navigator.geolocation.clearWatch(watchId);
    };
  }, [map, followUser]);

  // 2. Inicialización de Google Maps
  useEffect(() => {
    if (apiKey && isOnline && !map) {
      if (!(window as any).google) {
        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=geometry,places`;
        script.async = true;
        script.defer = true;
        script.onload = () => initMap();
        document.head.appendChild(script);
      } else {
        initMap();
      }
    }
  }, [apiKey, isOnline]);

  const initMap = () => {
    if (!mapRef.current || map || !(window as any).google) return;
    try {
      const google = (window as any).google;
      const newMap = new google.maps.Map(mapRef.current, {
        center: currentLocation || { lat: -34.6037, lng: -58.3816 },
        zoom: 15,
        disableDefaultUI: true,
        zoomControl: true,
        styles: [
          { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
          { featureType: "transit", elementType: "labels", stylers: [{ visibility: "off" }] }
        ]
      });

      newMap.addListener('click', (e: any) => {
        setNewPointData({ lat: e.latLng.lat(), lng: e.latLng.lng(), note: '' });
        setShowPointModal(true);
      });

      directionsRendererRef.current = new google.maps.DirectionsRenderer({
        map: newMap,
        suppressMarkers: true,
        polylineOptions: { strokeColor: "#4f46e5", strokeWeight: 6, strokeOpacity: 0.8 }
      });

      setMap(newMap);
    } catch (e) {
      console.error("Error al iniciar el mapa táctico.");
    }
  };

  // 3. Sincronización de Marcadores
  useEffect(() => {
    if (map && (window as any).google) {
      setRouteInfo(null); // Limpiar info de ruta al cambiar de día o puntos
      syncMarkers();
    }
  }, [map, deliveryPoints, selectedDay, isOnline]);

  const syncMarkers = () => {
    const google = (window as any).google;
    if (!google) return;

    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];

    pointsOfDay.forEach((p, i) => {
      const marker = new google.maps.Marker({
        position: { lat: p.lat, lng: p.lng },
        map: isOnline ? map : null,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          fillColor: '#4f46e5',
          fillOpacity: 1,
          strokeWeight: 3,
          strokeColor: '#ffffff',
          scale: 16,
        },
        label: { 
          text: (i + 1).toString(), 
          color: "white", 
          fontWeight: "900",
          fontSize: "12px"
        },
        animation: google.maps.Animation.DROP
      });

      marker.addListener('click', () => {
        const url = `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}&travelmode=driving`;
        window.open(url, '_blank');
      });

      markersRef.current.push(marker);
    });
  };

  // 4. Optimización GOOGLE (TSP)
  const optimizeGoogle = async () => {
    const google = (window as any).google;
    if (!google || pointsOfDay.length < 2) return;
    
    if (pointsOfDay.length > 27) {
      alert("Límite de 27 puntos para Google.");
      return;
    }

    setIsCalculating('google');
    const directionsService = new google.maps.DirectionsService();
    
    const waypoints = pointsOfDay.slice(1, -1).map(p => ({
      location: new google.maps.LatLng(p.lat, p.lng),
      stopover: true
    }));

    const request = {
      origin: { lat: pointsOfDay[0].lat, lng: pointsOfDay[0].lng },
      destination: { lat: pointsOfDay[pointsOfDay.length - 1].lat, lng: pointsOfDay[pointsOfDay.length - 1].lng },
      waypoints: waypoints,
      optimizeWaypoints: true,
      travelMode: google.maps.TravelMode.DRIVING
    };

    directionsService.route(request, (result: any, status: any) => {
      if (status === google.maps.DirectionsStatus.OK) {
        if (polylineRef.current) polylineRef.current.setMap(null);
        directionsRendererRef.current.setDirections(result);
        
        // Extraer info de ruta
        const route = result.routes[0];
        let totalDist = 0;
        let totalDuration = 0;
        route.legs.forEach((leg: any) => {
          totalDist += leg.distance.value;
          totalDuration += leg.duration.value;
        });

        setRouteInfo({
          distance: (totalDist / 1000).toFixed(1) + ' km',
          duration: Math.round(totalDuration / 60) + ' min'
        });
      }
      setIsCalculating(null);
    });
  };

  // 5. Optimización ORS
  const optimizeORS = async () => {
    if (!orsKey || pointsOfDay.length < 2) return;
    
    setIsCalculating('ors');
    try {
      const coordinates = pointsOfDay.map(p => [p.lng, p.lat]);
      const response = await fetch(`https://api.openrouteservice.org/v2/directions/driving-car/geojson`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': orsKey },
        body: JSON.stringify({ coordinates })
      });
      const data = await response.json();
      if (data.features?.length > 0) {
        const google = (window as any).google;
        const feature = data.features[0];
        const routeCoords = feature.geometry.coordinates.map((c: any) => ({ lat: c[1], lng: c[0] }));
        
        if (directionsRendererRef.current) directionsRendererRef.current.setDirections({routes: []});
        if (polylineRef.current) polylineRef.current.setMap(null);

        polylineRef.current = new google.maps.Polyline({
          path: routeCoords,
          strokeColor: "#10b981",
          strokeWeight: 6,
          strokeOpacity: 0.9,
          map: map
        });

        // Extraer info de ruta ORS
        const summary = feature.properties.summary;
        setRouteInfo({
          distance: (summary.distance / 1000).toFixed(1) + ' km',
          duration: Math.round(summary.duration / 60) + ' min'
        });
      }
    } catch (e) {
      console.error("Error ORS");
    } finally {
      setIsCalculating(null);
    }
  };

  const handleSavePoint = async () => {
    if (!newPointData) return;
    const now = Date.now();
    const point: DeliveryPoint = {
      id: crypto.randomUUID(),
      lat: newPointData.lat,
      lng: newPointData.lng,
      day: selectedDay,
      timestamp: now,
      updatedAt: now,
      note: newPointData.note
    };
    await db.put(TableName.DELIVERY, point);
    setDeliveryPoints(prev => [...prev, point]);
    setShowPointModal(false);
    setNewPointData(null);
  };

  return (
    <div className="h-full flex flex-col relative bg-black overflow-hidden">
      
      {/* HEADER DÍAS */}
      <div className="absolute top-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200">
        <div className="flex overflow-x-auto no-scrollbar p-3 gap-2">
          {DAYS.map(day => (
            <button
              key={day}
              onClick={() => setSelectedDay(day)}
              className={`flex-shrink-0 px-5 py-2.5 rounded-2xl flex flex-col items-center min-w-[85px] transition-all border-2 ${selectedDay === day ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg' : 'bg-white border-slate-100 text-slate-400'}`}
            >
              <span className="text-[10px] uppercase font-black tracking-widest">{day.slice(0, 3)}</span>
              <span className="text-sm font-black">{deliveryPoints.filter(p => p.day === day).length}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ÁREA DE MAPA */}
      <div className="flex-1 w-full relative mt-[76px]">
        <div ref={mapRef} className={`absolute inset-0 z-10 transition-opacity duration-500 ${isOnline ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} />
        
        {/* INFO DE RUTA FLOTANTE */}
        {routeInfo && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 animate-in fade-in slide-in-from-top duration-500">
            <div className="bg-white/80 backdrop-blur-xl border border-white/40 shadow-2xl px-6 py-3 rounded-full flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Ruler className="w-4 h-4 text-indigo-600" />
                <span className="text-xs font-black text-slate-800 uppercase tracking-tighter">{routeInfo.distance}</span>
              </div>
              <div className="w-[1px] h-4 bg-slate-300"></div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-600" />
                <span className="text-xs font-black text-slate-800 uppercase tracking-tighter">{routeInfo.duration}</span>
              </div>
            </div>
          </div>
        )}

        {/* Grilla de Respaldo */}
        <div className="absolute inset-0 z-0 bg-slate-950">
          <div className="absolute inset-0" style={{ backgroundImage: `linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)`, backgroundSize: '40px 40px' }} />
          <div className="absolute top-6 left-1/2 -translate-x-1/2 z-50">
            {isOnline ? (
              <div className="bg-indigo-600/20 backdrop-blur-md text-white px-5 py-2.5 rounded-full flex items-center gap-2 text-[10px] font-black uppercase tracking-widest border border-indigo-400/30">
                <Wifi className="w-3.5 h-3.5" /> MAPA INTERACTIVO
              </div>
            ) : (
              <div className="bg-slate-900 text-slate-400 px-5 py-2.5 rounded-full flex items-center gap-2 text-[10px] font-black uppercase tracking-widest shadow-2xl border border-slate-700 animate-pulse">
                <WifiOff className="w-3.5 h-3.5 text-red-500" /> MODO OFFLINE
              </div>
            )}
          </div>
        </div>
      </div>

      {/* BOTONES DE CONTROL */}
      <div className="absolute bottom-10 right-4 flex flex-col gap-4 z-50">
        
        {/* Grupo de Optimización */}
        <div className="flex flex-col gap-2 bg-white/10 backdrop-blur-xl p-2 rounded-[2.5rem] border border-white/20 shadow-2xl">
          <button 
            onClick={optimizeGoogle}
            disabled={!!isCalculating || pointsOfDay.length < 2}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-all active:scale-90 relative ${isCalculating === 'google' ? 'bg-indigo-200 text-indigo-600' : 'bg-white text-indigo-600 shadow-xl'}`}
            title="Optimizar Google"
          >
            {isCalculating === 'google' ? <RefreshCw className="w-6 h-6 animate-spin" /> : <MapIcon className="w-6 h-6" />}
          </button>

          <button 
            onClick={optimizeORS}
            disabled={!!isCalculating || pointsOfDay.length < 2}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-all active:scale-90 relative ${isCalculating === 'ors' ? 'bg-emerald-200 text-emerald-600' : 'bg-emerald-500 text-white shadow-xl'}`}
            title="Optimizar ORS"
          >
            {isCalculating === 'ors' ? <RefreshCw className="w-6 h-6 animate-spin" /> : <Zap className="w-6 h-6" />}
          </button>
        </div>

        {/* Localización */}
        <button 
          onClick={() => setFollowUser(!followUser)}
          className={`w-14 h-14 rounded-full flex items-center justify-center shadow-2xl transition-all active:scale-90 border border-white/10 ${followUser ? 'bg-indigo-600 text-white' : 'bg-white/80 backdrop-blur-md text-indigo-600'}`}
        >
          <LocateFixed className="w-6 h-6" />
        </button>

        {/* Agregar Punto */}
        <button 
          onClick={() => {
            if (!currentLocation) return alert("Esperando GPS...");
            setNewPointData({ ...currentLocation, note: '' });
            setShowPointModal(true);
          }}
          className="w-16 h-16 bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white rounded-[1.8rem] shadow-[0_15px_30px_rgba(79,70,229,0.4)] flex items-center justify-center active:scale-90 transition-all border-t border-white/20"
        >
          <Plus className="w-8 h-8" />
        </button>
      </div>

      {/* MODAL NUEVO PUNTO */}
      {showPointModal && newPointData && (
        <div className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-xl flex items-end sm:items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-[3rem] p-10 shadow-2xl animate-in slide-in-from-bottom duration-300">
            <div className="flex justify-between items-center mb-8">
              <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center"><Truck className="w-7 h-7" /></div>
              <button onClick={() => setShowPointModal(false)} className="p-3 bg-slate-50 rounded-full text-slate-300"><X className="w-6 h-6" /></button>
            </div>
            <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tighter mb-6">Nueva Entrega</h3>
            <textarea 
              autoFocus
              placeholder="Nombre del cliente o detalles..."
              className="w-full p-6 bg-slate-50 border-2 border-slate-100 rounded-[2rem] outline-none focus:border-indigo-500 font-bold text-slate-800 text-base h-36 resize-none"
              value={newPointData.note}
              onChange={(e) => setNewPointData({...newPointData, note: e.target.value})}
            />
            <button 
              onClick={handleSavePoint}
              className="w-full mt-8 py-5 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-indigo-200 active:scale-95 transition-all flex items-center justify-center gap-3"
            >
              <Save className="w-5 h-5" /> GUARDAR PUNTO
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeliveryMap;
