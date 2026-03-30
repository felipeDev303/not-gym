import type { APIRoute } from 'astro'
import { createSupabaseServerClient } from '../../../lib/supabase'

export const GET: APIRoute = async ({ request, cookies }) => {
  const supabase = createSupabaseServerClient({ request, cookies })

  const { data, error } = await supabase
    .from('routes')
    .select('id, name, description, geojson, distance_km, created_at')
    .order('created_at', { ascending: false })

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  return new Response(JSON.stringify(data), { status: 200 })
}

export const POST: APIRoute = async ({ request, cookies, locals }) => {
  const session = locals.session
  if (!session) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 })
  }

  const body = await request.json()
  const { name, description, geojson, distance_km } = body

  if (!name || !geojson) {
    return new Response(JSON.stringify({ error: 'Faltan campos requeridos: name, geojson' }), { status: 400 })
  }

  if (geojson.type !== 'LineString' || !Array.isArray(geojson.coordinates)) {
    return new Response(JSON.stringify({ error: 'geojson debe ser un LineString válido' }), { status: 400 })
  }

  const supabase = createSupabaseServerClient({ request, cookies })

  const { data, error } = await supabase
    .from('routes')
    .insert({
      name,
      description,
      geojson,
      distance_km: distance_km ?? null,
      created_by: session.user.id,
    })
    .select()
    .single()

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  return new Response(JSON.stringify(data), { status: 201 })
}
