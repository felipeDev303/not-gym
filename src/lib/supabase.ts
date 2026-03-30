/// <reference types="astro/client" />
import { createServerClient, createBrowserClient } from '@supabase/ssr'
import type { AstroCookies } from 'astro'

export function createSupabaseServerClient(cookies: AstroCookies) {
  return createServerClient(
    process.env.PUBLIC_SUPABASE_URL ?? import.meta.env.PUBLIC_SUPABASE_URL,
    process.env.PUBLIC_SUPABASE_ANON_KEY ?? import.meta.env.PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        get(name: string) { return cookies.get(name)?.value },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        set(name: string, value: string, options: any) { cookies.set(name, value, options) },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        remove(name: string, options: any) { cookies.delete(name, options) },
      },
    }
  )
}

export function createSupabaseAdminClient() {
  return createServerClient(
    process.env.PUBLIC_SUPABASE_URL ?? import.meta.env.PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? import.meta.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      cookies: { getAll: () => [], setAll: () => {} },
      auth: { persistSession: false },
    }
  )
}

export function createSupabaseBrowserClient() {
  return createBrowserClient(
    import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.PUBLIC_SUPABASE_ANON_KEY
  )
}
