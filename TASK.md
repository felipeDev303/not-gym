# TASK.md — NotGym MVP

Lista de tareas granulares basada en el SDD y README.

---

## 0. Setup inicial

- [x] Inicializar proyecto Astro 5 con `output: 'server'` y adaptador `@astrojs/node`
- [x] Instalar dependencias: `@astrojs/react`, `react`, `react-dom`
- [x] Instalar dependencias de mapa: `leaflet`, `react-leaflet`, `leaflet-draw`, `@turf/turf`
- [x] Instalar cliente de Supabase: `@supabase/supabase-js`
- [x] Configurar `astro.config.mjs` con React y Node adapter
- [x] Crear `Dockerfile` con build multi-stage y exposición del puerto 3000
- [x] Configurar `.gitignore` para excluir `.env` y `node_modules`
- [x] Completar `.env`: agregar `SUPABASE_SERVICE_ROLE_KEY` y `PUBLIC_APP_URL`; eliminar duplicados sin prefijo (`SUPABASE_URL`, `SUPABASE_ANON_KEY`)
- [x] Crear `.env.example` con las 4 variables sin valores reales
- [x] Instalar `@types/leaflet`
- [x] Completar el campo `name` en `package.json`

---

## 1. Base de Datos (Supabase)

- [x] Ejecutar `supabase/schema.sql` en el SQL Editor de Supabase (cubre los ítems de abajo)
  - [x] Habilitar extensión PostGIS
  - [x] Crear tabla `spot_categories`
  - [x] Crear tabla `spots`
  - [x] Crear tabla `spot_photos`
  - [x] Crear tabla `routes`
  - [x] Crear función RPC `spots_near(lat, lng, radius)` con `ST_DWithin`
  - [x] Crear índice espacial sobre `spots.location`
  - [x] Insertar las 6 categorías iniciales
  - [x] Configurar RLS en `spots`, `spot_photos` y `routes`
- [x] Crear bucket `spot-photos` en Supabase Storage (manual: Dashboard → Storage → New bucket, Public: ON)

---

## 2. Autenticación

- [x] Habilitar magic link en Supabase Auth (manual: Dashboard → Authentication → Providers → Email → Enable)
- [x] Habilitar Google OAuth en Supabase Auth (manual: Dashboard → Authentication → Providers → Google → Client ID + Secret)
- [x] Crear página `/login` con formulario de magic link y botón de Google
- [x] Crear `POST /api/auth/magic-link` — envía magic link con OTP
- [x] Crear `POST /api/auth/google` — inicia flujo OAuth con Google
- [x] Crear `GET /api/auth/callback` — intercambia code por sesión
- [x] Crear `POST /api/auth/logout` — cierra sesión
- [x] Crear `src/lib/supabase.ts` con clientes server, admin y browser
- [x] Crear `src/middleware.ts` — refresca sesión y protege rutas `/app/submit` y `/admin`
- [x] Crear `src/env.d.ts` — declara `App.Locals` (supabase, session)

---

## 3. API Routes

### Spots
- [x] `GET /api/spots` — Lista por filtros o RPC `spots_near` según `?lat/lng/radius/category`
- [x] `POST /api/spots` — Crea spot (sesión requerida; `verified: false`)
- [x] `GET /api/spots/[id]` — Detalle completo con `spot_categories` y `spot_photos`
- [x] `PUT /api/spots/[id]` — Actualiza (dueño o admin); filtra campos permitidos
- [x] `DELETE /api/spots/[id]` — Elimina (dueño o admin)
- [x] `POST /api/spots/[id]/photos` — Valida MIME + tamaño, sube a Storage, guarda URL en `spot_photos`

### Rutas
- [x] `GET /api/routes` — Lista todas las rutas
- [x] `POST /api/routes` — Valida LineString GeoJSON y guarda con distancia

---

## 4. Páginas Astro

- [x] `/` — Landing page con hero, tagline, CTA y pills de categorías
- [x] `/app/map` — Contenedor del mapa (monta `MapView` via script dinámico)
- [x] `/app/spots/[id]` — Detalle SSR: categoría, fotos, upload (auth), botón reportar
- [x] `/app/submit` — Formulario protegido con `?lat/lng` pre-cargados, POST a `/api/spots`
- [x] `/login` — Página de autenticación (completada en §2)
- [x] `/admin/spots` — Panel de moderación: lista pendientes, aprobar/rechazar
- [x] `src/layouts/Layout.astro` — Layout compartido con nav (sesión detectada)

---

## 5. Componente de Mapa (`MapView.tsx`)

- [x] Crear `MapView.tsx` como isla React (`client:only="react"`)
- [x] Inicializar `MapContainer` centrado en ubicación del usuario (Geolocation API, fallback BA)
- [x] Agregar `TileLayer` con tiles de OpenStreetMap
- [x] Fetch a `/api/spots` al montar y cuando cambian filtros/radio
- [x] Markers con `DivIcon` personalizado por emoji de categoría
- [x] Popup con `SpotCard` (nombre, categoría, dirección, link a detalle)
- [x] Integrar `Leaflet Draw` (solo si autenticado) para trazar rutas
- [x] Al terminar trazado: calcular distancia con `Turf.js`, prompt nombre, POST a `/api/routes`
- [x] Renderizar rutas existentes como `Polyline` verde
- [x] Click en mapa (autenticado) → redirige a `/app/submit?lat=&lng=`
- [x] Botón flotante `+` (autenticado) para agregar spot desde el mapa

---

## 6. Componente `FilterBar.tsx`

- [x] Pills por categoría con estado activo; toggle al hacer click
- [x] Re-fetch reactivo al cambiar categoría o radio
- [x] Selector de radio: 1 km / 5 km / 10 km
- [x] Filtrado sin recarga de página

---

## 7. Componente `SpotCard.tsx`

- [x] Nombre, icono de categoría, dirección y link "Ver más" a `/app/spots/[id]`

---

## 8. Página de Detalle de Spot

- [x] Nombre, descripción, categoría, dirección y fecha (SSR en `/app/spots/[id].astro`)
- [x] Galería de fotos del bucket `spot-photos`
- [x] Botón "Subir foto" visible solo para autenticados
- [x] Formulario de subida → `POST /api/spots/[id]/photos`
- [x] Botón "Reportar" (mailto)

---

## 9. Panel de Moderación (Admin)

- [x] `/admin/spots` protegida; usa `createSupabaseAdminClient` (service role)
- [x] Lista spots con `verified: false` ordenados por fecha
- [x] Aprobar → `PUT /api/spots/[id]` `{ verified: true }` → remueve fila
- [x] Rechazar → `DELETE /api/spots/[id]` → remueve fila

---

## 10. Deploy

- [ ] Buildear imagen Docker y probar localmente (`docker build` + `docker run`)
- [ ] Crear proyecto en CubePath y desplegar imagen
- [ ] Configurar variables de entorno en CubePath
- [ ] Configurar DNS en Cloudflare: registro A `notgym.org` → IP de CubePath (proxied: ON)
- [ ] Verificar HTTPS y redirección www → apex

---

## 11. QA y Pulido

- [ ] Probar flujo completo de visitante anónimo (explorar → detalle)
- [ ] Probar flujo de usuario registrado (login → agregar spot → subir foto → trazar ruta)
- [ ] Probar flujo de moderación (admin aprueba/rechaza spot)
- [ ] Verificar que `SUPABASE_SERVICE_ROLE_KEY` no aparece en ningún bundle del cliente
- [ ] Verificar responsive del mapa en mobile
- [ ] Revisar que spots no verificados no aparecen en el mapa público
