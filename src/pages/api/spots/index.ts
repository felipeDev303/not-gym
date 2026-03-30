import type { APIRoute } from 'astro'
import { createSupabaseServerClient } from '../../../lib/supabase'

export const GET: APIRoute = async ({ url, request, cookies }) => {
  const lat = url.searchParams.get('lat')
  const lng = url.searchParams.get('lng')
  const radius = url.searchParams.get('radius') ?? '5000'
  const category = url.searchParams.get('category')

  const supabase = createSupabaseServerClient({ request, cookies })

  if (lat && lng) {
    let query = supabase.rpc('spots_near', {
      lat: parseFloat(lat),
      lng: parseFloat(lng),
      radius: parseInt(radius),
    })
    if (category) {
      query = query.eq('category_slug', category)
    }
    const { data, error } = await query
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 })
    return new Response(JSON.stringify(data), { status: 200 })
  }

  let query = supabase
    .from('spots')
    .select(`
      id, name, description, address, verified, created_at,
      location,
      spot_categories ( slug, name, icon )
    `)
    .eq('verified', true)
    .order('created_at', { ascending: false })

  if (category) {
    query = query.eq('spot_categories.slug', category)
  }

  const { data, error } = await query
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  return new Response(JSON.stringify(data), { status: 200 })
}

export const POST: APIRoute = async ({ request, cookies, locals }) => {
  const session = locals.session
  if (!session) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 })
  }

  const body = await request.json()
  const { name, description, category_id, latitude, longitude, address } = body

  if (!name || !category_id || latitude == null || longitude == null) {
    return new Response(JSON.stringify({ error: 'Faltan campos requeridos: name, category_id, latitude, longitude' }), { status: 400 })
  }

  const supabase = createSupabaseServerClient({ request, cookies })

  const { data, error } = await supabase
    .from('spots')
    .insert({
      name,
      description,
      category_id,
      location: `POINT(${longitude} ${latitude})`,
      address,
      created_by: session.user.id,
      verified: false,
    })
    .select()
    .single()

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  return new Response(JSON.stringify(data), { status: 201 })
}
