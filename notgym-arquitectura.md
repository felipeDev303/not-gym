# NotGym — Arquitectura y Alcance del Proyecto

> Plataforma colaborativa para mapear espacios de entrenamiento gratuito: pistas atléticas, zonas de calistenia, rutas de running y más.
> **Dominio:** [notgym.org](https://notgym.org) · **Hackathon build**

---

## Visión del Producto

NotGym es un mapa colaborativo donde cualquier persona puede descubrir y contribuir spots de entrenamiento al aire libre o de acceso gratuito. La premisa es simple: el mejor gym es el que no te cobra.

---

## Stack Tecnológico

| Capa | Tecnología | Justificación |
|---|---|---|
| Frontend / SSR | Astro 5 (SSR mode) | Ya existe la landing en notgym.org |
| Mapa | Leaflet + OpenStreetMap | Open source, sin costos de API |
| Trazado de rutas | Leaflet Draw + Turf.js | Cálculo de distancias client-side |
| Base de datos | Supabase (PostgreSQL + PostGIS) | Free tier, queries geoespaciales nativas |
| Almacenamiento | Supabase Storage | Fotos de spots |
| Autenticación | Supabase Auth | Magic link / OAuth |
| Deploy | CubePath (Docker / Node) | Crédito hackathon $15 |
| DNS / Proxy | Cloudflare | Ya configurado en notgym.org |

---

## Arquitectura del Sistema

```
notgym.org (Cloudflare DNS + Proxy)
    │
    └── CubePath (contenedor Node)
            │
            Astro 5 — output: 'server' + @astrojs/node adapter
            │
            ├── /                     → Landing page (estática)
            ├── /app/map              → Mapa interactivo (isla React)
            ├── /app/spots/[id]       → Detalle de un spot
            ├── /app/submit           → Formulario de nuevo spot
            │
            └── /api/
                ├── spots             → GET (listar/filtrar) · POST (crear)
                ├── spots/[id]        → GET · PUT · DELETE
                ├── spots/[id]/photos → POST (upload)
                └── routes            → GET · POST

    Supabase (cloud)
        ├── DB: spots, routes, spot_photos, spot_categories
        ├── PostGIS: queries geoespaciales (ST_DWithin, ST_Distance)
        ├── Storage: bucket "spot-photos" (público)
        └── Auth: usuarios registrados
```

### Componente de Mapa (isla React dentro de Astro)

```
MapView.tsx (client:only="react")
    ├── MapContainer (Leaflet)
    │     ├── TileLayer → OpenStreetMap tiles
    │     ├── Markers por categoría (icono custom por tipo)
    │     ├── Popups → SpotCard (preview + link a detalle)
    │     └── Leaflet Draw → trazado de rutas de running
    │
    └── FilterBar (categorías como pills)
```

---

## Base de Datos

### Schema Principal

```sql
-- Extensión geoespacial
CREATE EXTENSION IF NOT EXISTS postgis;

-- Categorías de spots
CREATE TABLE spot_categories (
  id   SERIAL PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,   -- 'calistenia', 'pista_atletica', etc.
  name TEXT NOT NULL,
  icon TEXT                    -- emoji o nombre de icono
);

-- Spots de entrenamiento
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

-- Fotos de cada spot
CREATE TABLE spot_photos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  spot_id     UUID REFERENCES spots(id) ON DELETE CASCADE,
  url         TEXT NOT NULL,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Rutas de running (GeoJSON LineString)
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

### Función RPC — Spots cercanos

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

### Categorías iniciales

| slug | name | icon |
|---|---|---|
| `calistenia` | Zona de Calistenia | 🏋️ |
| `pista_atletica` | Pista Atlética | 🏃 |
| `ruta_running` | Ruta de Running | 🗺️ |
| `parque_fitness` | Parque Fitness | 🌳 |
| `cancha` | Cancha Polideportiva | ⚽ |
| `escalada` | Zona de Escalada | 🧗 |

---

## Features del MVP

### 1. Mapa con Pins por Categoría
- Mapa centrado en la ubicación del usuario (Geolocation API)
- Pins con icono diferenciado por categoría
- Popup con nombre, categoría y foto thumbnail al hacer click
- Filtro por categoría (pills interactivos sobre el mapa)

### 2. Filtros por Tipo de Entrenamiento
- Filtros visibles como barra horizontal sobre el mapa
- Filtrado reactivo sin recarga de página
- Combinación con radio de búsqueda (1km / 5km / 10km)

### 3. Detalle y Fotos de Cada Spot
- Página dedicada `/app/spots/[id]`
- Galería de fotos (subidas por usuarios)
- Información: nombre, descripción, categoría, dirección, creador
- Botón "Reportar" para spots incorrectos
- Usuarios registrados pueden subir fotos

### 4. Rutas de Running Trazadas
- Herramienta de dibujo integrada en el mapa (Leaflet Draw)
- Cálculo de distancia automático con Turf.js (client-side)
- Guardado de ruta como GeoJSON en Supabase
- Visualización de rutas existentes como polylines en el mapa
- Rutas distinguibles de spots por estilo visual (línea vs marker)

### 5. Autenticación y Contribución
- Login con magic link o Google OAuth (Supabase Auth)
- Usuarios autenticados pueden: agregar spots, subir fotos, trazar rutas
- Spots nuevos quedan en estado `verified: false` hasta revisión
- Panel simple de moderación (admin) para aprobar spots

---

## Flujo de Usuario

```
Visitante anónimo
    → Ve el mapa con spots existentes
    → Filtra por categoría
    → Hace click en un spot → ve detalle y fotos
    → Quiere agregar un spot → se le pide login

Usuario registrado
    → Login (magic link / Google)
    → Agrega nuevo spot: click en el mapa → formulario → submit
    → Sube fotos a un spot existente
    → Traza una ruta de running con Leaflet Draw

Admin
    → Ve lista de spots pendientes
    → Aprueba / rechaza → verified: true/false
```

---

## Deploy

### Configuración Astro

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

### Dockerfile

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

### Variables de Entorno

```env
PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...   # solo server-side
PUBLIC_APP_URL=https://notgym.org
```

### DNS en Cloudflare

```
A   notgym.org   →   IP de CubePath   (proxied: ON)
```

---

## Presupuesto

| Servicio | Costo |
|---|---|
| CubePath (deploy) | $15 crédito hackathon |
| Supabase DB + Storage | Free tier (500 MB DB / 1 GB Storage) |
| OpenStreetMap tiles | Gratuito |
| Cloudflare DNS + Proxy | Gratuito |
| **Total out-of-pocket** | **$0** |

---

## Roadmap Post-Hackathon

- [ ] Sistema de valoraciones y reviews por spot
- [ ] Integración con datos de OSM via Overpass API (pre-poblar pistas existentes)
- [ ] App móvil (React Native / Expo) con modo offline
- [ ] Gamificación: badges por spots agregados o rutas completadas
- [ ] Importar / exportar rutas en formato GPX
- [ ] Notificaciones cuando se agrega un spot cercano al usuario

---

*Documento generado para hackathon build — NotGym v0.1*
