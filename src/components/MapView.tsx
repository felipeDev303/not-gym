import 'leaflet/dist/leaflet.css'
import 'leaflet-draw/dist/leaflet.draw.css'

import { useState, useEffect, useCallback, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import * as turf from '@turf/turf'
import { FilterBar } from './FilterBar'
import { SpotCard, type Spot } from './SpotCard'

// ─── Location search ─────────────────────────────────────────────────────────

type GeoResult = { display_name: string; lat: string; lon: string }

function LocationSearch({ onSelect }: { onSelect: (lat: number, lng: number, label: string) => void }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<GeoResult[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const search = (q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!q.trim()) { setResults([]); setOpen(false); return }
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5`,
          { headers: { 'Accept-Language': 'es' } }
        )
        const data: GeoResult[] = await res.json()
        setResults(data)
        setOpen(data.length > 0)
      } catch { setResults([]) }
      finally { setLoading(false) }
    }, 400)
  }

  const handleSelect = (r: GeoResult) => {
    setQuery(r.display_name.split(',')[0])
    setOpen(false)
    setResults([])
    onSelect(parseFloat(r.lat), parseFloat(r.lon), r.display_name)
  }

  return (
    <div style={{ position: 'relative', padding: '0.5rem 0.75rem', background: '#111', borderBottom: '1px solid #2a2a2a' }}>
      <div style={{ display: 'flex', alignItems: 'center', background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 8, padding: '0.4rem 0.75rem', gap: '0.5rem' }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          type="text"
          value={query}
          placeholder="Buscar ciudad o lugar..."
          onChange={e => { setQuery(e.target.value); search(e.target.value) }}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          style={{
            flex: 1, background: 'none', border: 'none', outline: 'none',
            color: '#f1f1f1', fontSize: '0.875rem', fontFamily: 'system-ui, sans-serif',
          }}
        />
        {loading && <span style={{ fontSize: '0.75rem', color: '#888' }}>...</span>}
        {query && !loading && (
          <button onClick={() => { setQuery(''); setResults([]); setOpen(false) }}
            style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '1rem', padding: 0, lineHeight: 1 }}>✕</button>
        )}
      </div>
      {open && (
        <ul style={{
          position: 'absolute', top: '100%', left: '0.75rem', right: '0.75rem', zIndex: 2000,
          background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 8,
          margin: 0, padding: '0.25rem 0', listStyle: 'none',
          boxShadow: '0 4px 16px rgba(0,0,0,0.5)', maxHeight: 220, overflowY: 'auto',
        }}>
          {results.map((r, i) => (
            <li key={i}
              onMouseDown={() => handleSelect(r)}
              style={{
                padding: '0.5rem 0.85rem', cursor: 'pointer', fontSize: '0.825rem',
                color: '#f1f1f1', borderBottom: i < results.length - 1 ? '1px solid #2a2a2a' : 'none',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#252525')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              {r.display_name}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

const CATEGORIES = [
  { slug: 'calistenia',     name: 'Calistenia',    icon: '🏋️' },
  { slug: 'pista_atletica', name: 'Pista Atlética', icon: '🏃' },
  { slug: 'ruta_running',   name: 'Running',        icon: '🗺️' },
  { slug: 'parque_fitness', name: 'Parque Fitness', icon: '🌳' },
  { slug: 'escalada',       name: 'Escalada',       icon: '🧗' },
  { slug: 'skateboarding',  name: 'Skateboarding',  icon: '🛹' },
  { slug: 'bicicleta',      name: 'Ciclismo',       icon: '🚴' },
  { slug: 'tenis',          name: 'Tenis',          icon: '🎾' },
  { slug: 'futbol',         name: 'Fútbol',         icon: '⚽' },
  { slug: 'baloncesto',     name: 'Baloncesto',     icon: '🏀' },
  { slug: 'ajedrez',        name: 'Ajedrez',        icon: '♟️' },
  { slug: 'patines',        name: 'Patinaje',       icon: '🛼' },
  { slug: 'parkour',        name: 'Parkour',        icon: '🤸' },
]

type Route = {
  id: string
  name: string
  geojson: { type: string; coordinates: [number, number][] }
  distance_km: number | null
}

function createIcon(emoji: string) {
  return L.divIcon({
    html: `<span class="spot-pin-inner">${emoji}</span>`,
    className: 'spot-pin',
    iconSize: [36, 36],
    iconAnchor: [18, 36],
    popupAnchor: [0, -40],
  })
}

// ─── Inner component: map events + Leaflet Draw ───────────────────────────────

type MapControlsProps = {
  session: boolean
  onRouteCreated: (geojson: object, distance: number) => void
  onMapClick: (lat: number, lng: number) => void
}

function LocateMeButton({ mapRef, onLocate }: { mapRef: React.RefObject<L.Map | null>, onLocate: (lat: number, lng: number) => void }) {
  const handleClick = () => {
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        mapRef.current?.setView([coords.latitude, coords.longitude], 15)
        onLocate(coords.latitude, coords.longitude)
      },
      () => alert('No se pudo obtener tu ubicación. Verificá los permisos del browser.'),
      { timeout: 8000 }
    )
  }
  const btnStyle: React.CSSProperties = {
    width: 44, height: 44, borderRadius: '50%',
    background: '#1a1a1a',
    border: '1.5px solid #2a2a2a',
    color: '#f1f1f1', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 2px 12px rgba(0,0,0,0.5)',
    transition: 'border-color 0.15s, color 0.15s',
  }
  return (
    <div style={{ position: 'fixed', bottom: '5rem', right: '1.5rem', zIndex: 1000 }}>
      <button onClick={handleClick} title="Centrar en mi ubicación" style={btnStyle}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#4ade80'; (e.currentTarget as HTMLElement).style.color = '#4ade80' }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#2a2a2a'; (e.currentTarget as HTMLElement).style.color = '#f1f1f1' }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3"/>
          <line x1="12" y1="2" x2="12" y2="6"/>
          <line x1="12" y1="18" x2="12" y2="22"/>
          <line x1="2" y1="12" x2="6" y2="12"/>
          <line x1="18" y1="12" x2="22" y2="12"/>
        </svg>
      </button>
    </div>
  )
}

function MapControls({ session, onRouteCreated, onMapClick }: MapControlsProps) {
  const map = useMap()
  const onRouteCreatedRef = useRef(onRouteCreated)
  useEffect(() => { onRouteCreatedRef.current = onRouteCreated }, [onRouteCreated])

  useMapEvents({
    click(e) {
      if (session) onMapClick(e.latlng.lat, e.latlng.lng)
    },
  })

  useEffect(() => {
    if (!session) return

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const LC = (L as any).Control.Draw
    if (!LC) return

    const drawControl = new LC({
      draw: {
        polyline: { shapeOptions: { color: '#4ade80', weight: 3 } },
        polygon: false,
        rectangle: false,
        circle: false,
        marker: false,
        circlemarker: false,
      },
      edit: false,
    })
    map.addControl(drawControl)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const LE = (L as any).Draw?.Event?.CREATED
    if (LE) {
      map.on(LE, (e: unknown) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const layer = (e as any).layer
        const feature = layer.toGeoJSON()
        const distance = Math.round(turf.length(feature, { units: 'kilometers' }) * 100) / 100
        layer.addTo(map)
        onRouteCreatedRef.current(feature.geometry, distance)
      })
    }

    return () => { map.removeControl(drawControl) }
  }, [map, session])

  return null
}

// ─── Main component ───────────────────────────────────────────────────────────

export function MapView({ session }: { session: boolean }) {
  const [spots, setSpots] = useState<Spot[]>([])
  const [routes, setRoutes] = useState<Route[]>([])
  const [favorites, setFavorites] = useState<Set<string>>(new Set())
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [radius, setRadius] = useState(5000)
  const [center, setCenter] = useState<[number, number]>([41.3851, 2.1734])
  const [ready, setReady] = useState(false)
  const mapRef = useRef<L.Map | null>(null)

  // Geolocation
  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setCenter([coords.latitude, coords.longitude])
        setReady(true)
      },
      () => setReady(true),
      { timeout: 6000 }
    )
  }, [])

  // Fetch spots whenever filters or center change
  useEffect(() => {
    if (!ready) return
    const p = new URLSearchParams({
      lat: center[0].toString(),
      lng: center[1].toString(),
      radius: radius.toString(),
    })
    if (activeCategory) p.set('category', activeCategory)
    fetch(`/api/spots?${p}`)
      .then(r => r.json())
      .then(data => setSpots(Array.isArray(data) ? data : []))
      .catch(() => setSpots([]))
  }, [ready, center, radius, activeCategory])

  // Fetch favorites once (only when logged in)
  useEffect(() => {
    if (!session) return
    fetch('/api/favorites')
      .then(r => r.json())
      .then(data => setFavorites(new Set(Array.isArray(data) ? data : [])))
      .catch(() => {})
  }, [session])

  // Fetch routes once
  useEffect(() => {
    fetch('/api/routes')
      .then(r => r.json())
      .then(data => setRoutes(Array.isArray(data) ? data : []))
      .catch(() => setRoutes([]))
  }, [])

  const handleRouteCreated = useCallback(async (geojson: object, distance: number) => {
    const name = window.prompt(`Ruta de ${distance} km — ¿Cómo se llama?`)
    if (!name) return
    const res = await fetch('/api/routes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, geojson, distance_km: distance }),
    })
    if (res.ok) {
      fetch('/api/routes').then(r => r.json()).then(data => setRoutes(Array.isArray(data) ? data : []))
    }
  }, [])

  const handleMapClick = useCallback((lat: number, lng: number) => {
    window.location.href = `/app/submit?lat=${lat.toFixed(6)}&lng=${lng.toFixed(6)}`
  }, [])

  if (!ready) {
    return (
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#888', fontFamily: 'system-ui, sans-serif', fontSize: '0.9rem',
      }}>
        Localizando...
      </div>
    )
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <LocationSearch onSelect={(lat, lng) => {
        mapRef.current?.setView([lat, lng], 13)
        setCenter([lat, lng])
      }} />
      <FilterBar
        categories={CATEGORIES}
        active={activeCategory}
        radius={radius}
        onCategory={setActiveCategory}
        onRadius={setRadius}
      />

      <MapContainer
        center={center}
        zoom={14}
        style={{ flex: 1, minHeight: 0 }}
        ref={mapRef}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />

        <MapControls
          session={session}
          onRouteCreated={handleRouteCreated}
          onMapClick={handleMapClick}
        />

        {spots.map(spot => (
          <Marker
            key={spot.id}
            position={[spot.latitude, spot.longitude]}
            icon={createIcon(spot.category_icon)}
          >
            <Popup minWidth={190} maxWidth={260}>
              <SpotCard spot={spot} isFavorite={favorites.has(spot.id)} session={session} />
            </Popup>
          </Marker>
        ))}

        {routes.map(route => {
          const positions = route.geojson.coordinates.map(
            ([lng, lat]: [number, number]) => [lat, lng] as [number, number]
          )
          return (
            <Polyline
              key={route.id}
              positions={positions}
              color="#4ade80"
              weight={4}
              opacity={0.75}
            />
          )
        })}
      </MapContainer>

      <LocateMeButton mapRef={mapRef} onLocate={(lat, lng) => setCenter([lat, lng])} />

      {session && (
        <div style={{ position: 'fixed', bottom: '8.5rem', right: '1.5rem', zIndex: 1000 }}>
          <a
            href="/app/favorites"
            title="Mis favoritos"
            style={{
              width: 44, height: 44, borderRadius: '50%',
              background: '#1a1a1a', border: '1.5px solid #2a2a2a',
              color: '#f1f1f1', textDecoration: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 12px rgba(0,0,0,0.5)',
              transition: 'border-color 0.15s, color 0.15s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#4ade80'; (e.currentTarget as HTMLElement).style.color = '#4ade80' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#2a2a2a'; (e.currentTarget as HTMLElement).style.color = '#f1f1f1' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
          </a>
        </div>
      )}

      {session && (
        <div style={{
          position: 'fixed', bottom: '1.5rem', right: '1.5rem', zIndex: 1000,
        }}>
          <a
            href="/app/submit"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 44, height: 44, borderRadius: '50%',
              background: '#1a1a1a',
              border: '1.5px solid #4ade80',
              color: '#4ade80',
              fontSize: '1.4rem', fontWeight: 700, textDecoration: 'none',
              boxShadow: '0 2px 12px rgba(0,0,0,0.5)',
              transition: 'background 0.15s',
            }}
            title="Agregar spot"
          >
            +
          </a>
        </div>
      )}

      <style>{`
        .spot-pin {
          background: #1a1a1a !important;
          border: 2px solid #4ade80;
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          display: flex !important;
          align-items: center;
          justify-content: center;
          box-shadow: 0 2px 8px rgba(0,0,0,0.5);
        }
        .spot-pin-inner {
          transform: rotate(45deg);
          font-size: 15px;
          line-height: 1;
          display: block;
        }
        .leaflet-popup-content-wrapper {
          background: #1a1a1a !important;
          border: 1px solid #2a2a2a !important;
          color: #f1f1f1 !important;
          border-radius: 10px !important;
          box-shadow: 0 4px 20px rgba(0,0,0,0.5) !important;
        }
        .leaflet-popup-tip { background: #1a1a1a !important; }
        .leaflet-popup-close-button { color: #888 !important; }
        .leaflet-popup-content { margin: 12px 14px !important; }
      `}</style>
    </div>
  )
}
