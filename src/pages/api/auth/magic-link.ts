import type { APIRoute } from 'astro'
import { createSupabaseServerClient } from '../../../lib/supabase'

export const POST: APIRoute = async ({ request, cookies, url }) => {
  const { email, redirect: redirectTo } = await request.json()

  if (!email) {
    return new Response(JSON.stringify({ error: 'Email requerido' }), { status: 400 })
  }

  const supabase = createSupabaseServerClient(cookies)

  const callbackUrl = new URL('/api/auth/callback', url.origin)
  callbackUrl.searchParams.set('next', redirectTo ?? '/app/map')

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: callbackUrl.toString() },
  })

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }

  return new Response(null, { status: 200 })
}
