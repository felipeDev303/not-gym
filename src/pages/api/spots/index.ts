import type { APIRoute } from 'astro'
import { createSupabaseServerClient, createSupabaseAdminClient } from '../../../lib/supabase'

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
      query = query.contains('category_slugs', [category])
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
      spot_tags ( spot_categories ( slug, name, icon ) )
    `)
    .eq('verified', true)
    .order('created_at', { ascending: false })

  if (category) {
    query = query.eq('spot_tags.spot_categories.slug', category)
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
  const { name, description, category_ids, latitude, longitude, address } = body

  if (!name || !Array.isArray(category_ids) || category_ids.length === 0 || latitude == null || longitude == null) {
    return new Response(JSON.stringify({ error: 'Faltan campos requeridos: name, category_ids, latitude, longitude' }), { status: 400 })
  }
  if (typeof name !== 'string' || name.trim().length < 3 || name.length > 100) {
    return new Response(JSON.stringify({ error: 'El nombre debe tener entre 3 y 100 caracteres' }), { status: 400 })
  }
  if (description && (typeof description !== 'string' || description.length > 500)) {
    return new Response(JSON.stringify({ error: 'La descripción no puede superar 500 caracteres' }), { status: 400 })
  }
  if (address && (typeof address !== 'string' || address.length > 200)) {
    return new Response(JSON.stringify({ error: 'La dirección no puede superar 200 caracteres' }), { status: 400 })
  }
  const lat = parseFloat(latitude)
  const lng = parseFloat(longitude)
  if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return new Response(JSON.stringify({ error: 'Coordenadas inválidas' }), { status: 400 })
  }
  if (!Array.isArray(category_ids) || category_ids.length > 5 || category_ids.some((id: unknown) => typeof id !== 'number' || !Number.isInteger(id))) {
    return new Response(JSON.stringify({ error: 'category_ids inválidos' }), { status: 400 })
  }

  const supabase = createSupabaseAdminClient()

  const { data, error } = await supabase
    .from('spots')
    .insert({
      name,
      description,
      location: `POINT(${longitude} ${latitude})`,
      address,
      created_by: session.user.id,
      verified: false,
    })
    .select()
    .single()

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 })

  const tags = category_ids.map((cid: number) => ({ spot_id: data.id, category_id: cid }))
  const { error: tagError } = await supabase.from('spot_tags').insert(tags)
  if (tagError) return new Response(JSON.stringify({ error: tagError.message }), { status: 500 })

  return new Response(JSON.stringify(data), { status: 201 })
}
