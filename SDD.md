# Documento de Diseño de Software — NotGym

**Versión:** 0.1  
**Fecha:** Marzo 2026  
**Proyecto:** NotGym — Mapa Colaborativo de Spots de Entrenamiento Gratuito  
**Dominio:** [notgym.org](https://notgym.org)

---

## 1. Introducción

### 1.1 Propósito
Este documento describe el diseño de software de NotGym, una plataforma web colaborativa para mapear espacios de entrenamiento al aire libre y de acceso gratuito. Cubre la arquitectura del sistema, los modelos de datos, el diseño de componentes, los contratos de API y la configuración de despliegue.

### 1.2 Alcance
NotGym permite a cualquier usuario descubrir spots de entrenamiento (zonas de calistenia, pistas atléticas, rutas de running, parques fitness, etc.) en un mapa interactivo. Los usuarios registrados pueden contribuir nuevos spots, subir fotos y trazar rutas de running.

### 1.3 Definiciones

| Término | Definición |
|---|---|
| Spot | Ubicación de entrenamiento geolocada, contribuida por un usuario |
| Ruta | Recorrido de running trazado por el usuario, almacenado como GeoJSON LineString |
| Verificado | Bandera booleana que indica la aprobación del spot por parte de un administrador |
| Magic link | Inicio de sesión sin contraseña mediante un enlace de un solo uso por email |

---

## 2. Visión General del Sistema

NotGym es una aplicación web con renderizado del lado del servidor construida con Astro 5. Expone una API REST consumida tanto por las páginas SSR como por una isla React del lado del cliente que renderiza el mapa interactivo. Todos los datos persistentes se almacenan en Supabase (PostgreSQL + PostGIS). Los archivos estáticos y las fotos subidas por usuarios se sirven desde Supabase Storage.

```
notgym.org (Cloudflare DNS + Proxy)
    │
    └── CubePath (contenedor Docker / Node)
            │
            Astro 5 — output: 'server' + adaptador @astrojs/node
            │
            ├── /                     → Landing page (estática)
            ├── /app/map              → Mapa interactivo (isla React)
            ├── /app/spots/[id]       → Detalle de un spot
            ├── /app/submit           → Formulario de nuevo spot
            │
            └── /api/
                ├── spots             → GET (listar/filtrar) · POST (crear)
                ├── spots/[id]        → GET · PUT · DELETE
                ├── spots/[id]/photos → POST (subir foto)
                └── routes            → GET · POST

    Supabase (cloud)
        ├── DB: spots, routes, spot_photos, spot_categories
        ├── PostGIS: queries geoespaciales (ST_DWithin, ST_Distance)
        ├── Storage: bucket "spot-photos" (público)
        └── Auth: magic link / Google OAuth
```

---

## 3. Stack Tecnológico

| Capa | Tecnología | Justificación |
|---|---|---|
| Frontend / SSR | Astro 5 (`output: 'server'`) | Landing existente; arquitectura de islas |
| Mapa Interactivo | Leaflet + OpenStreetMap | Open source, sin costo de API |
| Trazado de Rutas | Leaflet Draw + Turf.js | Cálculo de distancias client-side |
| Base de Datos | Supabase (PostgreSQL + PostGIS) | Free tier; queries geoespaciales nativas |
| Almacenamiento | Supabase Storage | Hosting de fotos de spots |
| Autenticación | Supabase Auth | Magic link + Google OAuth |
| Deploy | CubePath (Docker / Node) | Crédito hackathon |
| DNS / Proxy | Cloudflare | Ya configurado en notgym.org |

---

## 4. Diseño de la Arquitectura

### 4.1 Estrategia de Renderizado
Astro 5 corre en modo `server` con el adaptador standalone `@astrojs/node`. Las páginas se renderizan en el servidor en cada petición. El mapa interactivo se aísla como una **isla React** (`client:only="react"`) para evitar conflictos de hidratación con los requisitos del DOM de Leaflet.

### 4.2 Componente del Mapa

```
MapView.tsx (client:only="react")
    ├── MapContainer (Leaflet)
    │     ├── TileLayer → tiles de OpenStreetMap
    │     ├── Markers por categoría (icono custom por tipo)
    │     ├── Popups → SpotCard (preview + link al detalle)
    │     └── Leaflet Draw → trazado de rutas de running
    │
    └── FilterBar (pills de categorías)
```

**Flujo de datos:**
1. `MapView` consulta `/api/spots` al montarse con los parámetros opcionales `lat`, `lng`, `radius` y `category`.
2. Los markers se renderizan reactivamente; `FilterBar` actualiza los query params sin recargar la página.
3. El trazado de una ruta dispara el cálculo de distancia con Turf.js antes de hacer POST a `/api/routes`.

### 4.3 Flujo de Autenticación
- Supabase Auth gestiona los tokens de sesión mediante cookies HTTP-only (sesiones SSR del lado del servidor).
- Los usuarios no autenticados pueden navegar; cualquier acción de escritura redirige a `/login`.
- `SUPABASE_SERVICE_ROLE_KEY` se usa exclusivamente en las rutas de API del servidor para operaciones privilegiadas (moderación).

---

## 5. Modelo de Datos

### 5.1 Resumen Entidad-Relación

```
spot_categories ──< spots >──< spot_photos
                      │
                    routes
```

- Un `spot` pertenece a una `spot_category`.
- Un `spot` tiene cero o más `spot_photos`.
- Las `routes` son entidades independientes trazadas en el mapa.
- Tanto `spots` como `spot_photos` referencian a `auth.users`.

### 5.2 Esquema de Base de Datos

```sql
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE spot_categories (
  id   SERIAL PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  icon TEXT
);

CREATE TABLE spots (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  description TEXT,
  category_id INT REFERENCES spot_categories(id),
  location    GEOGRAPHY(Point, 4326) NOT NULL,
  address     TEXT,
  created_by  UUID REFERENCES auth.users(id),
  verified    BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE spot_photos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  spot_id     UUID REFERENCES spots(id) ON DELETE CASCADE,
  url         TEXT NOT NULL,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE routes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  description TEXT,
  geojson     JSONB NOT NULL,
  distance_km FLOAT,
  created_by  UUID REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

### 5.3 Función RPC — Spots Cercanos

```sql
CREATE OR REPLACE FUNCTION spots_near(lat FLOAT, lng FLOAT, radius INT)
RETURNS TABLE (
  id UUID, name TEXT, description TEXT,
  category_slug TEXT, category_icon TEXT,
  latitude FLOAT, longitude FLOAT,
  address TEXT, verified BOOLEAN
) AS $$
  SELECT
    s.id, s.name, s.description,
    c.slug, c.icon,
    ST_Y(s.location::geometry) AS latitude,
    ST_X(s.location::geometry) AS longitude,
    s.address, s.verified
  FROM spots s
  JOIN spot_categories c ON c.id = s.category_id
  WHERE ST_DWithin(
    s.location,
    ST_Point(lng, lat)::geography,
    radius
  );
$$ LANGUAGE sql;
```

### 5.4 Datos Iniciales — Categorías

| slug | nombre | icono |
|---|---|---|
| `calistenia` | Zona de Calistenia | 🏋️ |
| `pista_atletica` | Pista Atlética | 🏃 |
| `ruta_running` | Ruta de Running | 🗺️ |
| `parque_fitness` | Parque Fitness | 🌳 |
| `cancha` | Cancha Polideportiva | ⚽ |
| `escalada` | Zona de Escalada | 🧗 |

---

## 6. Diseño de la API

### 6.1 Spots

| Método | Endpoint | Auth | Descripción |
|---|---|---|---|
| GET | `/api/spots` | No requerida | Listar spots; soporta `?lat`, `?lng`, `?radius`, `?category` |
| POST | `/api/spots` | Requerida | Crear un nuevo spot (`verified: false`) |
| GET | `/api/spots/[id]` | No requerida | Obtener detalle de un spot |
| PUT | `/api/spots/[id]` | Dueño / Admin | Actualizar spot |
| DELETE | `/api/spots/[id]` | Dueño / Admin | Eliminar spot |
| POST | `/api/spots/[id]/photos` | Requerida | Subir foto a Supabase Storage |

### 6.2 Rutas

| Método | Endpoint | Auth | Descripción |
|---|---|---|---|
| GET | `/api/routes` | No requerida | Listar todas las rutas |
| POST | `/api/routes` | Requerida | Guardar una nueva ruta trazada |

### 6.3 Estructura de Respuesta — Spot

```json
{
  "id": "uuid",
  "name": "Parque Central Calisthenics",
  "description": "Barras y paralelas en buen estado.",
  "category": { "slug": "calistenia", "icon": "🏋️" },
  "latitude": -34.603,
  "longitude": -58.381,
  "address": "Av. del Libertador 1000",
  "verified": true,
  "photos": ["https://...supabase.co/storage/v1/object/public/spot-photos/..."],
  "created_at": "2026-03-01T12:00:00Z"
}
```

---

## 7. Flujos de Usuario

### 7.1 Visitante Anónimo

```
Visita notgym.org
    → Landing page
    → /app/map → el mapa carga con los spots verificados existentes
    → Filtra por categoría (pill)
    → Click en un marker → popup SpotCard
    → Click en "Ver más" → /app/spots/[id]
    → Click en "Agregar spot" → redirigido a /login
```

### 7.2 Usuario Registrado

```
Login (magic link / Google OAuth)
    → Redirigido de vuelta a /app/map
    → Click en una posición del mapa → /app/submit (coords pre-cargadas)
    → Completa el formulario → submit → spot creado (verified: false)
    → Sube foto en /app/spots/[id]
    → Traza una ruta de running con Leaflet Draw → guardada vía /api/routes
```

### 7.3 Admin

```
/admin/spots (protegido, service role)
    → Lista de spots pendientes (verified: false)
    → Aprobar → PATCH verified: true
    → Rechazar → DELETE
```

---

## 8. Consideraciones de Seguridad

- **Row-Level Security (RLS):** Las políticas de RLS de Supabase garantizan que solo el dueño o un administrador pueda actualizar o eliminar un spot o una foto.
- **Service Role Key:** Nunca expuesta al cliente; se usa únicamente en las rutas de API del servidor de Astro.
- **Anon Key:** Segura para uso en el cliente; el acceso de solo lectura a spots verificados es irrestricto.
- **Subida de archivos:** Validada del lado del servidor por tipo MIME (image/jpeg, image/png, image/webp) y límite de tamaño antes de enviar a Supabase Storage.
- **Cloudflare Proxy:** Oculta la IP de origen; provee protección DDoS y terminación TLS.

---

## 9. Despliegue

### 9.1 Configuración de Astro

```js
// astro.config.mjs
import { defineConfig } from 'astro/config'
import react from '@astrojs/react'
import node from '@astrojs/node'

export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  integrations: [react()],
})
```

### 9.2 Dockerfile

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
EXPOSE 3000
ENV HOST=0.0.0.0 PORT=3000
CMD ["node", "./dist/server/entry.mjs"]
```

### 9.3 Variables de Entorno

```env
PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...   # solo server-side
PUBLIC_APP_URL=https://notgym.org
```

### 9.4 DNS

```
A   notgym.org   →   CubePath IP   (Cloudflare proxy: ON)
```

---

## 10. Presupuesto

| Servicio | Costo |
|---|---|
| CubePath (deploy) | $15 crédito hackathon |
| Supabase DB + Storage | Free tier (500 MB DB / 1 GB Storage) |
| OpenStreetMap tiles | Gratuito |
| Cloudflare DNS + Proxy | Gratuito |
| **Total out-of-pocket** | **$0** |

---

## 11. Checklist de Features del MVP

- [ ] Mapa interactivo con pins por categoría
- [ ] Barra de filtros (pills de categoría + selector de radio)
- [ ] Página de detalle de spot con galería de fotos
- [ ] Formulario de envío de spot (autenticado)
- [ ] Subida de fotos por spot
- [ ] Trazado de rutas de running (Leaflet Draw + distancia con Turf.js)
- [ ] Autenticación (magic link + Google OAuth)
- [ ] Panel de moderación para admins (aprobar/rechazar spots)

---

## 12. Roadmap Post-MVP

- [ ] Sistema de valoraciones y reviews por spot
- [ ] Integración con Overpass API de OSM para pre-poblar pistas existentes
- [ ] App móvil (React Native / Expo) con modo offline
- [ ] Gamificación: badges por spots agregados o rutas completadas
- [ ] Importar / exportar rutas en formato GPX
- [ ] Notificaciones cuando se agrega un spot cercano al usuario

---

*NotGym SDD v0.1 — Hackathon build*
