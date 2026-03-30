import type { APIRoute } from 'astro'
import { createSupabaseServerClient } from '../../../lib/supabase'

export const POST: APIRoute = async ({ cookies, redirect, url }) => {
  const supabase = createSupabaseServerClient(cookies)

  const callbackUrl = new URL('/api/auth/callback', url.origin).toString()

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: callbackUrl },
  })

  if (error || !data.url) {
    return redirect('/login?error=' + encodeURIComponent(error?.message ?? 'OAuth error'))
  }

  return redirect(data.url)
}
