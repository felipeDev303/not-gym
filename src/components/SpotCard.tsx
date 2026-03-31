import { useState } from 'react'
import type React from 'react'

export type Spot = {
  id: string
  name: string
  description: string | null
  category_slug: string
  category_icon: string
  latitude: number
  longitude: number
  address: string | null
  verified: boolean
}

export function SpotCard({ spot, isFavorite = false, session = false }: { spot: Spot; isFavorite?: boolean; session?: boolean }) {
  const [fav, setFav] = useState(isFavorite)
  const [loading, setLoading] = useState(false)

  const toggleFav = async (e: React.MouseEvent) => {
    e.preventDefault()
    if (loading) return
    setLoading(true)
    const method = fav ? 'DELETE' : 'POST'
    const res = await fetch('/api/favorites', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ spot_id: spot.id }),
    })
    if (res.ok || res.status === 204 || res.status === 201) setFav(!fav)
    setLoading(false)
  }

  return (
    <div style={{ minWidth: 180, fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem' }}>
        <div>
          <div style={{ fontSize: '0.72rem', color: '#888', marginBottom: '0.25rem' }}>
            {spot.category_icon} {spot.category_slug.replace('_', ' ')}
          </div>
          <div style={{ fontWeight: 600, fontSize: '0.95rem', color: '#f1f1f1', marginBottom: '0.25rem' }}>
            {spot.name}
          </div>
        </div>
        {session && (
          <button
            onClick={toggleFav}
            title={fav ? 'Quitar de favoritos' : 'Guardar en favoritos'}
            style={{
              background: 'none', border: 'none', cursor: loading ? 'default' : 'pointer',
              fontSize: '1rem', padding: '0', lineHeight: 1, opacity: loading ? 0.5 : 1,
              flexShrink: 0, marginTop: '0.1rem',
            }}
          >
            {fav ? '♥' : '♡'}
          </button>
        )}
      </div>
      {spot.address && (
        <div style={{ fontSize: '0.78rem', color: '#888', marginBottom: '0.5rem' }}>
          📍 {spot.address}
        </div>
      )}
      <a
        href={`/app/spots/${spot.id}`}
        style={{
          display: 'inline-block',
          fontSize: '0.8rem',
          color: '#4ade80',
          textDecoration: 'none',
          marginTop: '0.2rem',
        }}
      >
        Ver más →
      </a>
    </div>
  )
}
