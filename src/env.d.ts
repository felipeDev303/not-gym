/// <reference types="astro/client" />

declare namespace App {
  interface Locals {
    supabase: import('@supabase/supabase-js').SupabaseClient
    session: import('@supabase/supabase-js').Session | null
  }
}
