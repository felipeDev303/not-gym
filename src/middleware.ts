/// <reference types="astro/client" />
import { defineMiddleware } from 'astro:middleware'
import { createSupabaseServerClient } from './lib/supabase'

const PROTECTED_ROUTES = ['/app/submit', '/admin']

export const onRequest = defineMiddleware(async (context, next) => {
  const supabase = createSupabaseServerClient(context)

  const { data: { session } } = await supabase.auth.getSession()
  context.locals.session = session
  context.locals.supabase = supabase

  const pathname = new URL(context.request.url).pathname
  const isProtected = PROTECTED_ROUTES.some(route => pathname.startsWith(route))

  if (isProtected && !session) {
    return context.redirect(`/login?redirect=${encodeURIComponent(pathname)}`)
  }

  return next()
})
