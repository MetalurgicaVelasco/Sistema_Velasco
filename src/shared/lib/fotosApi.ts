import { supabase } from './supabaseClient'

// -----------------------------------------------------------------------------
// Fotos de un proyecto o de un elemento. En la base se guarda el PATH dentro del
// bucket, no la URL.
//
// Límites: 10 fotos por proyecto, 5 por elemento.
//
// La columna vieja `foto_url` (en proyectos y elementos) se mantiene
// sincronizada con la foto PRINCIPAL: el tablero, la carpeta impresa, el mail y
// la etiqueta la siguen leyendo, así que no se toca.
// -----------------------------------------------------------------------------

const BUCKET = 'proyectos-fotos'

export const MAX_FOTOS_PROYECTO = 10
export const MAX_FOTOS_ELEMENTO = 5

export type Foto = {
  id: number
  path: string
  posicion: number
  url: string
}

export type Duenio = { proyectoId: number } | { elementoId: number }

function columna(d: Duenio): 'proyecto_id' | 'elemento_id' {
  return 'proyectoId' in d ? 'proyecto_id' : 'elemento_id'
}
function valor(d: Duenio): number {
  return 'proyectoId' in d ? d.proyectoId : d.elementoId
}
function tabla(d: Duenio): 'proyectos' | 'elementos' {
  return 'proyectoId' in d ? 'proyectos' : 'elementos'
}
export function maximo(d: Duenio): number {
  return 'proyectoId' in d ? MAX_FOTOS_PROYECTO : MAX_FOTOS_ELEMENTO
}

export function urlPublica(path: string | null): string | null {
  if (!path) return null
  // Tolera datos viejos que guardaron la URL completa.
  if (path.startsWith('http://') || path.startsWith('https://')) return path
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
}

// Al crear un proyecto o elemento la foto se sube por el camino viejo y queda
// solo en `foto_url`. La primera vez que se abre la galería, esa foto se adopta
// como principal para que no queden dos verdades.
async function adoptarFotoVieja(d: Duenio): Promise<boolean> {
  const { data } = await supabase.from(tabla(d)).select('foto_url').eq('id', valor(d)).maybeSingle()
  const path = (data as { foto_url?: string | null } | null)?.foto_url
  if (!path) return false
  const { error } = await supabase
    .from('fotos')
    .insert({ [columna(d)]: valor(d), path, posicion: 1 })
  return !error
}

export async function cargarFotos(d: Duenio): Promise<Foto[]> {
  const { data, error } = await supabase
    .from('fotos')
    .select('id, path, posicion')
    .eq(columna(d), valor(d))
    .order('posicion')
  if (error) throw new Error(error.message)

  // Sin fotos registradas pero con foto vieja: se adopta y se relee.
  if ((data ?? []).length === 0 && (await adoptarFotoVieja(d))) {
    return cargarFotos(d)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((f) => ({
    id: f.id,
    path: f.path,
    posicion: f.posicion,
    url: urlPublica(f.path) as string,
  }))
}

// La principal es la de posición más baja. Se copia a foto_url para que lo que
// ya existe (tablero, carpeta impresa, mail, etiqueta) siga funcionando.
async function sincronizarPrincipal(d: Duenio): Promise<void> {
  const { data } = await supabase
    .from('fotos')
    .select('path')
    .eq(columna(d), valor(d))
    .order('posicion')
    .limit(1)
  const principal = (data ?? [])[0]?.path ?? null
  await supabase
    .from(tabla(d))
    .update({ foto_url: principal })
    .eq('id', valor(d))
}

async function usuarioActual(): Promise<{ id: string | null; nombre: string | null }> {
  const { data } = await supabase.auth.getUser()
  const u = data.user
  if (!u) return { id: null, nombre: null }
  const meta = (u.user_metadata ?? {}) as Record<string, unknown>
  return { id: u.id, nombre: (meta.nombre as string) || (meta.full_name as string) || u.email || null }
}

export async function subirFoto(d: Duenio, file: File): Promise<{ error?: string }> {
  const actuales = await cargarFotos(d)
  const tope = maximo(d)
  if (actuales.length >= tope) {
    return { error: `Ya hay ${tope} fotos cargadas, que es el máximo. Quitá alguna para agregar otra.` }
  }

  const ext = file.name.split('.').pop() || file.type.split('/')[1] || 'png'
  const carpeta = 'proyectoId' in d ? 'proyectos' : 'items'
  const ruta = `${carpeta}/${valor(d)}/${Date.now()}.${ext}`
  const { error: eUp } = await supabase.storage.from(BUCKET).upload(ruta, file, { upsert: true })
  if (eUp) return { error: eUp.message }

  const u = await usuarioActual()
  const posicion = actuales.length ? Math.max(...actuales.map((f) => f.posicion)) + 1 : 1
  const { error } = await supabase.from('fotos').insert({
    [columna(d)]: valor(d),
    path: ruta,
    posicion,
    creado_por: u.id,
    creado_por_nombre: u.nombre,
  })
  if (error) {
    // Si no se pudo registrar, no dejamos el archivo colgado en el bucket.
    await supabase.storage.from(BUCKET).remove([ruta])
    return { error: error.message }
  }
  await sincronizarPrincipal(d)
  return {}
}

export async function borrarFoto(d: Duenio, foto: Foto): Promise<{ error?: string }> {
  const { error } = await supabase.from('fotos').delete().eq('id', foto.id)
  if (error) return { error: error.message }
  await supabase.storage.from(BUCKET).remove([foto.path])
  await sincronizarPrincipal(d)
  return {}
}

// Marcar como principal: pasa al primer lugar y las demás corren una posición.
export async function marcarPrincipal(d: Duenio, fotoId: number): Promise<{ error?: string }> {
  const actuales = await cargarFotos(d)
  const orden = [
    ...actuales.filter((f) => f.id === fotoId),
    ...actuales.filter((f) => f.id !== fotoId),
  ]
  for (let i = 0; i < orden.length; i++) {
    const { error } = await supabase
      .from('fotos')
      .update({ posicion: i + 1 })
      .eq('id', orden[i].id)
    if (error) return { error: error.message }
  }
  await sincronizarPrincipal(d)
  return {}
}


// ── Fotos para VER (carpeta y actividad) ────────────────────────────────────
// Primero las del elemento (arrancando por la principal) y después las del
// proyecto, marcadas como tales. Es el orden en que le sirven al operario: lo
// suyo primero, el contexto general después.

export type FotoVista = Foto & { origen: 'item' | 'proyecto' }

export async function cargarFotosVista(
  elementoId: number,
  proyectoId: number | null,
): Promise<FotoVista[]> {
  const [delItem, delProyecto] = await Promise.all([
    cargarFotos({ elementoId }),
    proyectoId != null ? cargarFotos({ proyectoId }) : Promise.resolve([]),
  ])
  return [
    ...delItem.map((f) => ({ ...f, origen: 'item' as const })),
    ...delProyecto.map((f) => ({ ...f, origen: 'proyecto' as const })),
  ]
}
