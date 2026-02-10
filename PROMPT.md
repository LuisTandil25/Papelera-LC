# Master Specification: Papelera LC Pro v127

## 1. Identidad y Propósito
**Papelera LC Pro** es una PWA (Progressive Web App) de alto rendimiento diseñada para la gestión integral de un punto de venta (POS), inventario, base de datos de clientes y logística de reparto. El objetivo principal es la **supervivencia operativa total**: la app debe funcionar al 100% en condiciones de cero señal, optimizar el uso de datos móviles y sincronizarse de forma inteligente cuando detecte WiFi.

## 2. Arquitectura Técnica (Frontend-Only PWA)
- **Estructura**: Single-page application integrada en `index.html` e `index.tsx`.
- **Librerías Core**: React 19, Tailwind CSS, Lucide React (iconografía), Recharts (analítica).
- **Base de Datos**: IndexedDB (implementación nativa en `db.ts`) con patrón Outbox para sincronización diferida.
- **Backend**: Google Apps Script (GAS) actuando como API REST para persistencia en Google Sheets.
- **Service Worker (SW)**: Estrategia de carga adaptativa (WiFi vs. Datos/Offline).

## 3. Estrategia de Red Inteligente (Cold Start & Data Saving)
La aplicación implementa una lógica de "Carga desde Memoria Local" (Caché) con tres estados:
1.  **WiFi (Modo Normal)**: Estrategia *Stale-While-Revalidate*. Carga desde caché instantáneamente pero consulta la red para actualizar assets y librerías en segundo plano. Permite auto-sincronización de datos cada 15 segundos.
2.  **Datos Móviles (Modo Ahorro)**: Estrategia *Cache-Only* para recursos estáticos (CSS, JS, Fonts). Prohíbe el tráfico de red innecesario para ahorrar datos. El Service Worker ignora la red y sirve todo desde el almacenamiento local del teléfono.
3.  **Sin Señal (Modo Offline)**: Funcionamiento idéntico al modo Datos, garantizando que el "Inicio en Frío" sea exitoso incluso si no hay ninguna conexión.

## 4. Módulos del Sistema
### A. Punto de Venta (POS)
- Buscador reactivo por nombre, código de barras o categoría.
- Carrito de compras con persistencia local.
- Checkout con selección de cliente y método de pago (Efectivo, Tarjeta, Transferencia).
- Descuento automático de stock en IndexedDB.
- Generación de recibo térmico digital (80mm/58mm).

### B. Inventario y Productos
- CRUD completo de productos.
- Importación masiva vía CSV (procesamiento local).
- Indicadores de stock crítico (bajo 5 unidades).
- Gestión de categorías e imágenes (Base64/URLs).

### C. Gestión de Clientes
- Directorio con búsqueda rápida.
- Integración directa con WhatsApp (API wa.me).
- Historial detallado de compras por cliente vinculado a la tabla de Ventas.

### D. Logística y Mapa Táctico (DeliveryMap)
- **Modo Offline**: Grilla de coordenadas de respaldo sobre fondo oscuro.
- **Modo Online**: Google Maps con tracking GPS en tiempo real.
- **Optimización de Rutas (TSP)**:
    - Integración con Google Maps Directions (WiFi).
    - Integración con OpenRouteService (ORS) para cálculos tácticos de distancia y tiempo.
- Gestión de puntos de entrega por día de la semana.

### E. Panel de Control y Analytics
- Gráficos dinámicos (Ventas semanales, Métodos de pago, Top 10 productos).
- Exportador de código `backend.gs` para el servidor de Google Sheets.
- Configuración de APIs (GAS URL, Google Maps Key, ORS Key).

## 5. Diseño UX/UI (Especificación Estética)
- **Estilo**: "Bento Box" moderno con alto contraste (Slate-50 a White).
- **Bordes**: Radio de curvatura agresivo (`rounded-[2rem]` o `rounded-[3rem]`).
- **Navegación**: Bottom Nav Bar fija con Safe Area Insets para iPhone/Android.
- **Feedback**: Sistema de notificaciones tipo "Toast" en la parte superior.
- **PWA Experience**: Splash screen personalizado (`index.html` loader), banner de instalación nativo y soporte para gestos táctiles.

## 6. Lógica de Sincronización
- **Outbox Pattern**: Cada cambio (CREATE/UPDATE/DELETE) se guarda en una tabla `Outbox`.
- **Sync Engine**:
    - **Automático**: Solo en WiFi.
    - **Manual**: Botón "Sincronizar Todo" que fuerza el push de Outbox y pull de novedades sin importar el tipo de red (siempre que haya conexión).
- **Backend GAS**: Lógica de `upsertRecord` basada en `id` único para evitar duplicados en Google Sheets.

## 7. Notas de Seguridad y Compatibilidad
- Requiere Contexto Seguro (HTTPS) para Bluetooth y GPS.
- Impresión térmica: Compatible con comandos ESC/POS vía Web Bluetooth API.
- Offline-First: La aplicación DEBE poder iniciarse y mostrar la interfaz completa sin una sola petición de red exitosa tras la primera instalación.
