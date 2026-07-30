import { supabase } from '../../shared/lib/supabaseClient'

// Notas de un proyecto. El autor es el usuario logueado (snapshot del nombre,
// como en remitos y notas de envío); la fecha/hora sale del created_at.
//
// Regla de edición: solo el autor puede editar o borrar su nota. Además de
// deshabilitar los botones, lo hace cumplir la base (RLS), así no alcanza con
// saltear la pantalla.
export type NotaProyecto = {
  id: number
  contenido: string
  creado_por: string | null
  creado_por_nombre: string | null
  created_at: string
  actualizado_en: string | null
  actualizado_por_nombre: string | null
}

async function usuarioActual(): Promise<{ id: string | null; nombre: string | null }> {
  const { data } = await supabase.auth.getUser()
  const u = data.user
  if (!u) return { id: null, nombre: null }
  const meta = (u.user_metadata ?? {}) as Record<string, unknown>
  const nombre = (meta.nombre as string) || (meta.full_name as string) || u.email || null
  return { id: u.id, nombre }
}

// Id del usuario logueado, para saber qué notas puede editar.
export async function usuarioActualId(): Promise<string | null> {
  return (await usuarioActual()).id
}

export async function cargarNotasProyecto(proyectoId: number): Promise<NotaProyecto[]> {
  const { data, error } = await supabase
    .from('notas_proyecto')
    .select(
      'id, contenido, creado_por, creado_por_nombre, created_at, actualizado_en, actualizado_por_nombre',
    )
    .eq('proyecto_id', proyectoId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data as NotaProyecto[]) ?? []
}

export async function crearNotaProyecto(proyectoId: number, contenido: string): Promise<{ error?: string }> {
  const u = await usuarioActual()
  const { error } = await supabase.from('notas_proyecto').insert({
    proyecto_id: proyectoId,
    contenido: contenido.trim(),
    creado_por: u.id,
    creado_por_nombre: u.nombre,
  })
  return error ? { error: error.message } : {}
}

export async function actualizarNotaProyecto(id: number, contenido: string): Promise<{ error?: string }> {
  const u = await usuarioActual()
  const { data, error } = await supabase
    .from('notas_proyecto')
    .update({
      contenido: contenido.trim(),
      actualizado_en: new Date().toISOString(),
      actualizado_por: u.id,
      actualizado_por_nombre: u.nombre,
    })
    .eq('id', id)
    .select('id')
  if (error) return { error: error.message }
  // Si RLS bloqueó la fila, el update no falla: no devuelve ninguna.
  if (!data || data.length === 0) return { error: 'Solo el autor de la nota puede editarla.' }
  return {}
}

export async function eliminarNotaProyecto(id: number): Promise<{ error?: string }> {
  const { data, error } = await supabase.from('notas_proyecto').delete().eq('id', id).select('id')
  if (error) return { error: error.message }
  if (!data || data.length === 0) return { error: 'Solo el autor de la nota puede borrarla.' }
  return {}
}
