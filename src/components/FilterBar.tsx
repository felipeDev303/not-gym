import type { CSSProperties } from 'react'

export type Category = { slug: string; name: string; icon: string }

type Props = {
  categories: Category[]
  active: string | null
  radius: number
  onCategory: (slug: string | null) => void
  onRadius: (r: number) => void
}

const RADII = [
  { label: '1 km', value: 1000 },
  { label: '5 km', value: 5000 },
  { label: '10 km', value: 10000 },
]

export function FilterBar({ categories, active, radius, onCategory, onRadius }: Props) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '0.4rem',
      padding: '0.55rem 1rem',
      background: '#1a1a1a',
      borderBottom: '1px solid #2a2a2a',
      overflowX: 'auto',
      flexShrink: 0,
      scrollbarWidth: 'none',
    }}>
      <button onClick={() => onCategory(null)} style={pill(active === null)}>
        Todos
      </button>

      {categories.map(c => (
        <button
          key={c.slug}
          onClick={() => onCategory(active === c.slug ? null : c.slug)}
          style={pill(active === c.slug)}
        >
          {c.icon} {c.name}
        </button>
      ))}

      <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.3rem', flexShrink: 0 }}>
        {RADII.map(r => (
          <button
            key={r.value}
            onClick={() => onRadius(r.value)}
            style={pill(radius === r.value)}
          >
            {r.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function pill(active: boolean): CSSProperties {
  return {
    background: active ? '#4ade80' : '#111',
    color: active ? '#0f0f0f' : '#888',
    border: '1px solid',
    borderColor: active ? '#4ade80' : '#2a2a2a',
    borderRadius: '999px',
    padding: '0.28rem 0.7rem',
    fontSize: '0.78rem',
    fontWeight: active ? 600 : 400,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition: 'all 0.15s',
    fontFamily: 'system-ui, sans-serif',
  }
}
