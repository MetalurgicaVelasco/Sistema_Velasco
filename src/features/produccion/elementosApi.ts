import { supabase } from '../../shared/lib/supabaseClient'
import type { Elemento } from './elementoTipos'

export const SELECT_ELEMENTO =
  'id, proyecto_id, parent_elemento_id, tipo, descripcion, cantidad, material_id, presentacion_mat_prima, codigo_cliente, fecha_fin_estipulada, foto_url, estado, es_retrabajo, es_dispositivo'

// Un elemento es "contenedor" (puede tener hijos) si es conjunto o subconjunto.
export function esContenedor(el: Elemento): boolean {
  return el.tipo === 'conjunto' || el.tipo === 'subconjunto'
}

export function tipoLabel(tipo: string): string {
  if (tipo === 'conjunto') return 'Conjunto'
  if (tipo === 'subconjunto') return 'Subconjunto'
  if (tipo === 'componente') return 'Componente'
  return tipo
}

// Hijos directos de un contenedor. Si parentId es null, devuelve los elementos
// RAÍZ del proyecto (los que no cuelgan de ningún otro); si no, los que cuelgan
// del elemento indicado.
export async function cargarHijos(
  proyectoId: number,
  parentId: number | null,
): Promise<Elemento[]> {
  const base = supabase.from('elementos').select(SELECT_ELEMENTO)
  const q =
    parentId != null
      ? base.eq('parent_elemento_id', parentId)
      : base.eq('proyecto_id', proyectoId).is('parent_elemento_id', null)
  const { data } = await q.order('id')
  return (data as unknown as Elemento[]) ?? []
}

// ── Persistencia inmediata de elementos (alta / edición / borrado) ─────────
import { draftAGuardar } from './elementoTipos'
import type { ElementoDraft } from './elementoTipos'

const BUCKET = 'proyectos-fotos'

// Sube la foto nueva a items/{id}/… y devuelve el path guardado, o null.
async function subirFoto(elementoId: number, archivo: File): Promise<string | null> {
  const ext =
    archivo.name.split('.').pop() || archivo.type.split('/')[1] || 'png'
  const ruta = `items/${elementoId}/${Date.now()}.${ext}`
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(ruta, archivo, { upsert: true })
  return error ? null : ruta
}

// ¿El elemento tiene al menos un hijo colgado?
export async function tieneHijos(id: number): Promise<boolean> {
  const { count } = await supabase
    .from('elementos')
    .select('id', { count: 'exact', head: true })
    .eq('parent_elemento_id', id)
  return (count ?? 0) > 0
}

// Crea un elemento hijo. El parent siempre tiene id, así que es un INSERT directo.
export async function crearElemento(
  d: ElementoDraft,
  proyectoId: number,
  parentId: number | null,
): Promise<void> {
  const payload = draftAGuardar(d, proyectoId, parentId)
  const { data } = await supabase
    .from('elementos')
    .insert(payload)
    .select('id')
    .single()
  const id = (data as { id: number } | null)?.id
  if (id != null && d.fotoArchivo) {
    const ruta = await subirFoto(id, d.fotoArchivo)
    if (ruta) await supabase.from('elementos').update({ foto_url: ruta }).eq('id', id)
  }
}

// Actualiza un elemento existente (no mueve de padre: parentId es el actual).
export async function actualizarElemento(
  d: ElementoDraft,
  proyectoId: number,
  parentId: number | null,
): Promise<void> {
  if (d.dbId == null) return
  const payload = draftAGuardar(d, proyectoId, parentId)
  await supabase.from('elementos').update(payload).eq('id', d.dbId)
  if (d.fotoArchivo) {
    const ruta = await subirFoto(d.dbId, d.fotoArchivo)
    if (ruta) {
      await supabase.from('elementos').update({ foto_url: ruta }).eq('id', d.dbId)
    }
  }
}

// Borra un elemento (sus procesos se van en cascada por la FK).
export async function eliminarElemento(id: number): Promise<void> {
  await supabase.from('elementos').delete().eq('id', id)
}
