import type { APIRoute } from 'astro'
import { createSupabaseServerClient } from '../../../../lib/supabase'

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp']
const MAX_SIZE_BYTES = 5 * 1024 * 1024

export const POST: APIRoute = async ({ params, request, cookies, locals }) => {
  const session = locals.session
  if (!session) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 })
  }

  const { id: spotId } = params
  const formData = await request.formData()
  const file = formData.get('photo') as File | null

  if (!file) {
    return new Response(JSON.stringify({ error: 'No se recibió ningún archivo' }), { status: 400 })
  }
  if (!ALLOWED_MIME.includes(file.type)) {
    return new Response(JSON.stringify({ error: 'Tipo de archivo no permitido. Usar JPEG, PNG o WebP.' }), { status: 415 })
  }
  if (file.size > MAX_SIZE_BYTES) {
    return new Response(JSON.stringify({ error: 'El archivo supera el límite de 5 MB.' }), { status: 413 })
  }

  const supabase = createSupabaseServerClient({ request, cookies })

  const ext = file.type.split('/')[1]
  const filename = `${spotId}/${crypto.randomUUID()}.${ext}`
  const buffer = await file.arrayBuffer()

  const { error: uploadError } = await supabase.storage
    .from('spot-photos')
    .upload(filename, buffer, { contentType: file.type })

  if (uploadError) {
    return new Response(JSON.stringify({ error: uploadError.message }), { status: 500 })
  }

  const { data: { publicUrl } } = supabase.storage
    .from('spot-photos')
    .getPublicUrl(filename)

  const { data, error: dbError } = await supabase
    .from('spot_photos')
    .insert({ spot_id: spotId, url: publicUrl, uploaded_by: session.user.id })
    .select()
    .single()

  if (dbError) return new Response(JSON.stringify({ error: dbError.message }), { status: 500 })
  return new Response(JSON.stringify(data), { status: 201 })
}
