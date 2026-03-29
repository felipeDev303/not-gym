# Software Design Document — NotGym

**Version:** 0.1  
**Date:** March 2026  
**Project:** NotGym — Collaborative Free Training Spots Map  
**Domain:** [notgym.org](https://notgym.org)

---

## 1. Introduction

### 1.1 Purpose
This document describes the software design of NotGym, a collaborative web platform for mapping free outdoor and accessible training spots. It covers system architecture, data models, component design, API contracts, and deployment configuration.

### 1.2 Scope
NotGym allows any user to discover training spots (calisthenics zones, athletic tracks, running routes, fitness parks, etc.) on an interactive map. Registered users can contribute new spots, upload photos, and draw running routes.

### 1.3 Definitions

| Term | Definition |
|---|---|
| Spot | A geolocated training location contributed by a user |
| Route | A user-drawn running path stored as a GeoJSON LineString |
| Verified | Boolean flag indicating admin approval of a spot |
| Magic link | Passwordless login via a one-time email link |

---

## 2. System Overview

NotGym is a server-side rendered web application built with Astro 5. It exposes a REST API consumed both by SSR pages and a client-side React island that renders the interactive map. All persistent data is stored in Supabase (PostgreSQL + PostGIS). Static assets and user-uploaded photos are served from Supabase Storage.

```
notgym.org (Cloudflare DNS + Proxy)
    │
    └── CubePath (Docker / Node container)
            │
            Astro 5 — output: 'server' + @astrojs/node adapter
            │
            ├── /                     → Landing page (static)
            ├── /app/map              → Interactive map (React island)
            ├── /app/spots/[id]       → Spot detail page
            ├── /app/submit           → New spot submission form
            │
            └── /api/
                ├── spots             → GET (list/filter) · POST (create)
                ├── spots/[id]        → GET · PUT · DELETE
                ├── spots/[id]/photos → POST (upload)
                └── routes            → GET · POST

    Supabase (cloud)
        ├── DB: spots, routes, spot_photos, spot_categories
        ├── PostGIS: geospatial queries (ST_DWithin, ST_Distance)
        ├── Storage: bucket "spot-photos" (public)
        └── Auth: magic link / Google OAuth
```

---

## 3. Technology Stack

| Layer | Technology | Rationale |
|---|---|---|
| Frontend / SSR | Astro 5 (`output: 'server'`) | Existing landing site; islands architecture |
| Interactive Map | Leaflet + OpenStreetMap | Open source, zero API cost |
| Route Drawing | Leaflet Draw + Turf.js | Client-side distance calculation |
| Database | Supabase (PostgreSQL + PostGIS) | Free tier; native geospatial queries |
| File Storage | Supabase Storage | Spot photo hosting |
| Authentication | Supabase Auth | Magic link + Google OAuth |
| Deploy | CubePath (Docker / Node) | Hackathon credit |
| DNS / Proxy | Cloudflare | Already configured on notgym.org |

---

## 4. Architecture Design

### 4.1 Rendering Strategy
Astro 5 runs in `server` mode with the `@astrojs/node` standalone adapter. Pages are server-rendered on each request. The interactive map is isolated as a **React island** (`client:only="react"`) to avoid hydration conflicts with Leaflet's DOM requirements.

### 4.2 Map Component

```
MapView.tsx (client:only="react")
    ├── MapContainer (Leaflet)
    │     ├── TileLayer → OpenStreetMap tiles
    │     ├── Markers per category (custom icon per type)
    │     ├── Popups → SpotCard (preview + link to detail)
    │     └── Leaflet Draw → running route tracing
    │
    └── FilterBar (category pills)
```

**Data flow:**
1. `MapView` fetches `/api/spots` on mount with optional `lat`, `lng`, `radius`, and `category` query params.
2. Markers are rendered reactively; `FilterBar` updates query params without page reload.
3. Route drawing triggers a Turf.js distance calculation before POSTing to `/api/routes`.

### 4.3 Authentication Flow
- Supabase Auth handles session tokens via HTTP-only cookies (server-side SSR sessions).
- Unauthenticated users can browse; any write action redirects to `/login`.
- `SUPABASE_SERVICE_ROLE_KEY` is used exclusively on server-side API routes for privileged operations (moderation).

---

## 5. Data Model

### 5.1 Entity-Relationship Overview

```
spot_categories ──< spots >──< spot_photos
                      │
                    routes
```

- A `spot` belongs to one `spot_category`.
- A `spot` has zero or more `spot_photos`.
- `routes` are independent entities drawn on the map.
- Both `spots` and `spot_photos` reference `auth.users`.

### 5.2 Database Schema

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

### 5.3 RPC Function — Nearby Spots

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

### 5.4 Initial Seed Data — Categories

| slug | name | icon |
|---|---|---|
| `calistenia` | Zona de Calistenia | 🏋️ |
| `pista_atletica` | Pista Atlética | 🏃 |
| `ruta_running` | Ruta de Running | 🗺️ |
| `parque_fitness` | Parque Fitness | 🌳 |
| `cancha` | Cancha Polideportiva | ⚽ |
| `escalada` | Zona de Escalada | 🧗 |

---

## 6. API Design

### 6.1 Spots

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/spots` | None | List spots; supports `?lat`, `?lng`, `?radius`, `?category` |
| POST | `/api/spots` | Required | Create a new spot (`verified: false`) |
| GET | `/api/spots/[id]` | None | Get spot detail |
| PUT | `/api/spots/[id]` | Owner / Admin | Update spot |
| DELETE | `/api/spots/[id]` | Owner / Admin | Delete spot |
| POST | `/api/spots/[id]/photos` | Required | Upload photo to Supabase Storage |

### 6.2 Routes

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/routes` | None | List all routes |
| POST | `/api/routes` | Required | Save a new drawn route |

### 6.3 Response Shape — Spot

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

## 7. User Flows

### 7.1 Anonymous Visitor

```
Visit notgym.org
    → Landing page
    → /app/map → map loads with existing verified spots
    → Filter by category pill
    → Click marker → SpotCard popup
    → Click "Ver más" → /app/spots/[id]
    → Click "Agregar spot" → redirected to /login
```

### 7.2 Registered User

```
Login (magic link / Google OAuth)
    → Redirected back to /app/map
    → Click on map position → /app/submit (pre-filled coords)
    → Fill form → submit → spot created (verified: false)
    → Upload photo on /app/spots/[id]
    → Draw running route with Leaflet Draw → saved via /api/routes
```

### 7.3 Admin

```
/admin/spots (protected, service role)
    → List of pending spots (verified: false)
    → Approve → PATCH verified: true
    → Reject → DELETE
```

---

## 8. Security Considerations

- **Row-Level Security (RLS):** Supabase RLS policies enforce that only the owner or an admin can update/delete a spot or photo.
- **Service Role Key:** Never exposed to the client; used only in Astro server-side API routes.
- **Anon Key:** Safe for client use; read-only access to verified spots is unrestricted.
- **File uploads:** Validated server-side for MIME type (image/jpeg, image/png, image/webp) and size limit before proxying to Supabase Storage.
- **Cloudflare Proxy:** Hides origin IP; provides DDoS protection and TLS termination.

---

## 9. Deployment

### 9.1 Astro Configuration

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

### 9.3 Environment Variables

```env
PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...   # server-side only
PUBLIC_APP_URL=https://notgym.org
```

### 9.4 DNS

```
A   notgym.org   →   CubePath IP   (Cloudflare proxy: ON)
```

---

## 10. Budget

| Service | Cost |
|---|---|
| CubePath (deploy) | $15 hackathon credit |
| Supabase DB + Storage | Free tier (500 MB DB / 1 GB Storage) |
| OpenStreetMap tiles | Free |
| Cloudflare DNS + Proxy | Free |
| **Total out-of-pocket** | **$0** |

---

## 11. MVP Feature Checklist

- [ ] Interactive map with category pins
- [ ] Filter bar (category pills + radius selector)
- [ ] Spot detail page with photo gallery
- [ ] Spot submission form (authenticated)
- [ ] Photo upload per spot
- [ ] Running route drawing (Leaflet Draw + Turf.js distance)
- [ ] Authentication (magic link + Google OAuth)
- [ ] Admin moderation panel (approve/reject spots)

---

## 12. Post-MVP Roadmap

- [ ] Ratings and reviews per spot
- [ ] OSM Overpass API integration to pre-populate existing tracks
- [ ] Mobile app (React Native / Expo) with offline mode
- [ ] Gamification: badges for spots added or routes completed
- [ ] GPX import/export for routes
- [ ] Push notifications for new nearby spots

---

*NotGym SDD v0.1 — Hackathon build*
