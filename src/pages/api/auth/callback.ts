import type { APIRoute } from 'astro'
import { createSupabaseServerClient } from '../../../lib/supabase'

export const GET: APIRoute = async ({ url, request, cookies, redirect }) => {
  const code = url.searchParams.get('code')
  const next = url.searchParams.get('next') ?? '/app/map'

  if (!code) {
    return redirect('/login?error=missing_code')
  }

  const supabase = createSupabaseServerClient({ request, cookies })
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    return redirect(`/login?error=${encodeURIComponent(error.message)}`)
  }

  return redirect(next)
}
