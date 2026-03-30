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

export function SpotCard({ spot }: { spot: Spot }) {
  return (
    <div style={{ minWidth: 180, fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ fontSize: '0.72rem', color: '#888', marginBottom: '0.25rem' }}>
        {spot.category_icon} {spot.category_slug.replace('_', ' ')}
      </div>
      <div style={{ fontWeight: 600, fontSize: '0.95rem', color: '#f1f1f1', marginBottom: '0.25rem' }}>
        {spot.name}
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
