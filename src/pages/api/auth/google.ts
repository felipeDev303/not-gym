import type { APIRoute } from 'astro'
import { createSupabaseServerClient } from '../../../lib/supabase'

export const POST: APIRoute = async ({ request, cookies, redirect, url }) => {
  const supabase = createSupabaseServerClient({ request, cookies })

  const origin = process.env.PUBLIC_APP_URL ?? url.origin
  const callbackUrl = new URL('/api/auth/callback', origin).toString()

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: callbackUrl },
  })

  if (error || !data.url) {
    return redirect('/login?error=' + encodeURIComponent(error?.message ?? 'OAuth error'))
  }

  return redirect(data.url)
}
