import type { APIRoute } from 'astro'
import { createSupabaseServerClient, createSupabaseAdminClient } from '../../../../lib/supabase'

export const GET: APIRoute = async ({ params, request, cookies }) => {
  const { id } = params
  const supabase = createSupabaseServerClient({ request, cookies })

  const { data, error } = await supabase
    .from('spots')
    .select(`
      id, name, description, address, verified, created_at,
      location,
      spot_tags ( spot_categories ( slug, name, icon ) ),
      spot_photos ( id, url, created_at )
    `)
    .eq('id', id!)
    .single()

  if (error) {
    const status = error.code === 'PGRST116' ? 404 : 500
    return new Response(JSON.stringify({ error: error.message }), { status })
  }
  return new Response(JSON.stringify(data), { status: 200 })
}

export const PUT: APIRoute = async ({ params, request, cookies, locals }) => {
  const session = locals.session
  if (!session) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 })
  }

  const { id } = params
  const body = await request.json()
  const supabase = createSupabaseServerClient({ request, cookies })

  const adminClient = createSupabaseAdminClient()
  const { data: existing, error: fetchError } = await adminClient
    .from('spots')
    .select('created_by')
    .eq('id', id!)
    .single()

  if (fetchError) return new Response(JSON.stringify({ error: fetchError.message }), { status: 404 })

  const isAdmin = session.user.app_metadata?.role === 'admin'
  if (existing.created_by !== session.user.id && !isAdmin) {
    return new Response(JSON.stringify({ error: 'Prohibido' }), { status: 403 })
  }

  const allowedFields = ['name', 'description', 'category_id', 'address', 'verified']
  const updates = Object.fromEntries(
    Object.entries(body).filter(([key]) => allowedFields.includes(key))
  )

  const client = isAdmin ? adminClient : supabase

  const { data, error } = await client
    .from('spots')
    .update(updates)
    .eq('id', id!)
    .select()
    .single()

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  return new Response(JSON.stringify(data), { status: 200 })
}

export const DELETE: APIRoute = async ({ params, request, cookies, locals }) => {
  const session = locals.session
  if (!session) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 })
  }

  const { id } = params
  const supabase = createSupabaseServerClient({ request, cookies })

  const adminClient = createSupabaseAdminClient()
  const { data: existing, error: fetchError } = await adminClient
    .from('spots')
    .select('created_by')
    .eq('id', id!)
    .single()

  if (fetchError) return new Response(JSON.stringify({ error: fetchError.message }), { status: 404 })

  const isAdmin = session.user.app_metadata?.role === 'admin'
  if (existing.created_by !== session.user.id && !isAdmin) {
    return new Response(JSON.stringify({ error: 'Prohibido' }), { status: 403 })
  }

  const client = isAdmin ? adminClient : supabase

  const { error } = await client.from('spots').delete().eq('id', id!)
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  return new Response(null, { status: 204 })
}
