import { supabase } from './supabaseClient'

// -----------------------------------------------------------------------------
// Preferencias de UI por usuario (tabla `preferencias_ui`).
//
// Clave-valor genérico: `clave` identifica qué se guarda (ej.
// 'proyectos.f2.columnas') y `valor` es un JSON libre. Sirve para la config de
// columnas de las franjas y para cualquier preferencia futura sin migraciones.
//
// La RLS ya limita cada fila a su dueño, así que no hace falta filtrar por
// usuario al leer: la base solo devuelve las propias.
// -----------------------------------------------------------------------------

export async function cargarPreferencia<T>(clave: string): Promise<T | null> {
  const { data, error } = await supabase
    .from('preferencias_ui')
    .select('valor')
    .eq('clave', clave)
    .maybeSingle()
  if (error || !data) return null
  return (data as { valor: T }).valor
}

export async function guardarPreferencia(clave: string, valor: unknown): Promise<string | null> {
  const { data: sesion } = await supabase.auth.getUser()
  const usuarioId = sesion.user?.id
  if (!usuarioId) return 'No hay sesión activa.'

  const { error } = await supabase
    .from('preferencias_ui')
    .upsert(
      { usuario_id: usuarioId, clave, valor, actualizado_en: new Date().toISOString() },
      { onConflict: 'usuario_id,clave' },
    )
  return error ? error.message : null
}
