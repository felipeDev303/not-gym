import { useState, useEffect } from 'react'
import type React from 'react'

export type Spot = {
  id: string
  name: string
  description: string | null
  category_slug: string
  category_icon: string
  category_slugs: string[]
  category_icons: string[]
  latitude: number
  longitude: number
  address: string | null
  verified: boolean
}

export function SpotCard({ spot, isFavorite = false, session = false }: { spot: Spot; isFavorite?: boolean; session?: boolean }) {
  const [fav, setFav] = useState(isFavorite)
  const [loading, setLoading] = useState(false)

  useEffect(() => { setFav(isFavorite) }, [isFavorite])

  const toggleFav = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    console.log('[fav] click spot_id:', spot.id, 'currently fav:', fav)
    if (loading) return
    setLoading(true)
    const method = fav ? 'DELETE' : 'POST'
    const res = await fetch('/api/favorites', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ spot_id: spot.id }),
    })
    console.log('[fav] response status:', res.status)
    if (res.ok || res.status === 204 || res.status === 201) {
      setFav(!fav)
    } else {
      const body = await res.json().catch(() => ({}))
      console.error('[favorites] error body:', body)
    }
    setLoading(false)
  }

  return (
    <div style={{ minWidth: 180, fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', marginBottom: '0.25rem' }}>
        {(spot.category_icons ?? [spot.category_icon]).map((icon, i) => (
          <span key={i} style={{ fontSize: '0.72rem', color: '#888' }}>
            {icon} {(spot.category_slugs ?? [spot.category_slug])[i]?.replace(/_/g, ' ')}
          </span>
        ))}
      </div>
      <div style={{ fontWeight: 600, fontSize: '0.95rem', color: '#f1f1f1', marginBottom: '0.25rem' }}>
        {spot.name}
      </div>
      {spot.address && (
        <div style={{ fontSize: '0.78rem', color: '#888', marginBottom: '0.5rem' }}>
          📍 {spot.address}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.4rem' }}>
        <a
          href={`/app/spots/${spot.id}`}
          style={{ fontSize: '0.8rem', color: '#4ade80', textDecoration: 'none' }}
        >
          Ver más →
        </a>
        {session && (
          <button
            onClick={toggleFav}
            title={fav ? 'Quitar de favoritos' : 'Guardar en favoritos'}
            style={{
              background: 'none', border: 'none', cursor: loading ? 'default' : 'pointer',
              fontSize: '1.1rem', padding: '0 0.1rem', lineHeight: 1,
              opacity: loading ? 0.5 : 1, color: fav ? '#f87171' : '#888',
            }}
          >
            {fav ? '♥' : '♡'}
          </button>
        )}
      </div>
    </div>
  )
}
