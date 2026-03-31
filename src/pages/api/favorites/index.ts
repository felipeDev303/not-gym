import type { APIRoute } from 'astro'
import { createSupabaseAdminClient, createSupabaseServerClient } from '../../../lib/supabase'

export const GET: APIRoute = async ({ locals, request, cookies }) => {
  let session = locals.session
  if (!session) {
    const supabase = createSupabaseServerClient({ request, cookies })
    const { data } = await supabase.auth.getSession()
    session = data.session
  }
  if (!session) return new Response(JSON.stringify([]), { status: 200 })
  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase
    .from('spot_favorites').select('spot_id').eq('user_id', session.user.id)
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  return new Response(JSON.stringify(data.map(r => r.spot_id)), { status: 200 })
}

export const POST: APIRoute = async ({ request, locals }) => {
  const session = locals.session
  if (!session) return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 })
  const { spot_id } = await request.json()
  if (!spot_id) return new Response(JSON.stringify({ error: 'spot_id requerido' }), { status: 400 })
  const supabase = createSupabaseAdminClient()
  const { error } = await supabase.from('spot_favorites').insert({ user_id: session.user.id, spot_id })
  if (error && error.code !== '23505') return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  return new Response(null, { status: 201 })
}

export const DELETE: APIRoute = async ({ request, locals }) => {
  const session = locals.session
  if (!session) return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 })
  const { spot_id } = await request.json()
  const supabase = createSupabaseAdminClient()
  const { error } = await supabase.from('spot_favorites')
    .delete().eq('user_id', session.user.id).eq('spot_id', spot_id)
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  return new Response(null, { status: 204 })
}
