# NotGym

> El mejor gym es el que no te cobra.

NotGym es un mapa colaborativo para descubrir y agregar spots de entrenamiento al aire libre de acceso gratuito — zonas de calistenia, pistas atléticas, rutas de running, parques fitness y más.

**En vivo:** [notgym.org](https://notgym.org)

![Landing](public/landing.gif)

---

## Funcionalidades

- **Mapa interactivo** — Explora spots verificados cerca de tu ubicación, filtrados por categoría de entrenamiento
- **Páginas de detalle** — Fotos, descripción, dirección e información del contribuidor
- **Contribuir spots** — Los usuarios autenticados pueden agregar nuevos spots al mapa
- **Favoritos** — Guarda y consulta tus spots favoritos desde cualquier dispositivo
- **Subida de fotos** — Agrega fotos a cualquier spot existente
- **Rutas de running** — Traza y guarda rutas directamente en el mapa con cálculo automático de distancia
- **Moderación** — Panel de administración para aprobar o rechazar spots enviados

---

## Demo

### Crear un spot
![Crear spot](public/crearspot.gif)

### Guardar favoritos
![Favoritos](public/favoritos.gif)

### Moderación (admin)
![Aceptar spot](public/aceptarspot.gif)

---

## Stack Tecnológico

| Capa | Tecnología |
|---|---|
| Frontend / SSR | Astro 5 (modo server) |
| Mapa Interactivo | Leaflet + OpenStreetMap |
| Trazado de Rutas | Leaflet Draw + Turf.js |
| Base de Datos | Supabase (PostgreSQL + PostGIS) |
| Almacenamiento | Supabase Storage |
| Autenticación | Supabase Auth (magic link + Google OAuth) |
| Deploy | CubePath (Docker / Node) |
| DNS / Proxy | Cloudflare |

---

## Features Futuras

- [ ] Sistema de valoraciones y reseñas por spot
- [ ] Integración con Overpass API de OSM para pre-cargar pistas existentes
- [ ] Aplicación móvil (React Native / Expo) con modo sin conexión
- [ ] Gamificación: insignias por spots agregados o rutas completadas
- [ ] Importar / exportar rutas en formato GPX
- [ ] Notificaciones cuando se agrega un spot cercano al usuario

---

*Hackathon build — NotGym v0.1*
