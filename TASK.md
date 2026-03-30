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
- [ ] `GET /api/spots` — Listar spots verificados con filtros opcionales (`?lat`, `?lng`, `?radius`, `?category`)
- [ ] `POST /api/spots` — Crear spot (requiere sesión; `verified: false` por defecto)
- [ ] `GET /api/spots/[id]` — Obtener detalle completo de un spot con sus fotos
- [ ] `PUT /api/spots/[id]` — Actualizar spot (solo dueño o admin)
- [ ] `DELETE /api/spots/[id]` — Eliminar spot (solo dueño o admin)
- [ ] `POST /api/spots/[id]/photos` — Subir foto: validar MIME type, subir a Supabase Storage, guardar URL en `spot_photos`

### Rutas
- [ ] `GET /api/routes` — Listar todas las rutas
- [ ] `POST /api/routes` — Guardar nueva ruta GeoJSON con distancia calculada

---

## 4. Páginas Astro

- [ ] `/` — Landing page estática con descripción del proyecto y CTA al mapa
- [ ] `/app/map` — Página contenedora que renderiza la isla React `MapView`
- [ ] `/app/spots/[id]` — Página de detalle: nombre, descripción, categoría, dirección, galería de fotos, botón "Reportar"
- [ ] `/app/submit` — Formulario de nuevo spot (protegida; recibe `?lat` y `?lng` pre-cargados desde el mapa)
- [ ] `/login` — Página de autenticación
- [ ] `/admin/spots` — Lista de spots pendientes (protegida por service role)

---

## 5. Componente de Mapa (`MapView.tsx`)

- [ ] Crear `MapView.tsx` como isla React (`client:only="react"`)
- [ ] Inicializar `MapContainer` de Leaflet centrado en la ubicación del usuario (Geolocation API)
- [ ] Agregar `TileLayer` con tiles de OpenStreetMap
- [ ] Fetch inicial a `/api/spots` al montar el componente
- [ ] Renderizar markers con icono custom según la categoría del spot
- [ ] Al hacer click en un marker, mostrar `SpotCard` como popup (nombre, categoría, foto thumbnail, link a detalle)
- [ ] Integrar `Leaflet Draw` para habilitar trazado de rutas de running
- [ ] Al completar el trazado, calcular distancia con `Turf.js` y hacer POST a `/api/routes`
- [ ] Renderizar rutas existentes como polylines sobre el mapa
- [ ] Al hacer click en el mapa (sin marker), redirigir a `/app/submit?lat=...&lng=...` si el usuario está autenticado

---

## 6. Componente `FilterBar.tsx`

- [ ] Crear `FilterBar` con pills para cada categoría (slug + icono)
- [ ] Al seleccionar una categoría, re-fetch `/api/spots?category=<slug>`
- [ ] Agregar selector de radio de búsqueda (1 km / 5 km / 10 km)
- [ ] Combinar filtro de categoría y radio en la misma query
- [ ] Filtrado reactivo sin recarga de página

---

## 7. Componente `SpotCard.tsx`

- [ ] Crear `SpotCard` con nombre, icono de categoría y foto thumbnail
- [ ] Mostrar link "Ver más" hacia `/app/spots/[id]`

---

## 8. Página de Detalle de Spot

- [ ] Mostrar nombre, descripción, categoría, dirección, creador y fecha
- [ ] Galería de fotos con las imágenes del bucket `spot-photos`
- [ ] Botón "Subir foto" visible solo para usuarios autenticados
- [ ] Formulario de subida de foto (input file → POST a `/api/spots/[id]/photos`)
- [ ] Botón "Reportar" (puede ser un mailto o un endpoint simple)

---

## 9. Panel de Moderación (Admin)

- [ ] Página `/admin/spots` protegida: solo accesible con `SUPABASE_SERVICE_ROLE_KEY`
- [ ] Listar todos los spots con `verified: false`
- [ ] Botón "Aprobar" → `PUT /api/spots/[id]` con `{ verified: true }`
- [ ] Botón "Rechazar" → `DELETE /api/spots/[id]`

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
