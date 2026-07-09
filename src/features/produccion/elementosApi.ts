import { supabase } from '../../shared/lib/supabaseClient'
import type { Elemento } from './elementoTipos'
import { DOMINIO_PROYECTO, type DominioElemento } from './dominioElemento'

// Todas las funciones de este módulo trabajan sobre un DOMINIO (proyecto o
// matriz). Por defecto, el de proyecto: así el código de Proyectos no cambia.
export const SELECT_ELEMENTO = DOMINIO_PROYECTO.columnas

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
  dom: DominioElemento = DOMINIO_PROYECTO,
): Promise<Elemento[]> {
  const base = supabase.from(dom.tabla).select(dom.columnas)
  const q = parentId != null ? base.eq('parent_elemento_id', parentId) : dom.filtroRaices(base, proyectoId)
  const { data } = await q.order('id')
  return (data as unknown as Elemento[]) ?? []
}

// ── Persistencia inmediata de elementos (alta / edición / borrado) ─────────
import { draftAGuardar } from './elementoTipos'
import type { ElementoDraft } from './elementoTipos'

// Sube la foto nueva al bucket del dominio y devuelve el path guardado, o null.
async function subirFoto(
  elementoId: number,
  archivo: File,
  dom: DominioElemento,
): Promise<string | null> {
  const ext = archivo.name.split('.').pop() || archivo.type.split('/')[1] || 'png'
  const ruta = `${dom.prefijoFoto}/${elementoId}/${Date.now()}.${ext}`
  const { error } = await supabase.storage.from(dom.bucket).upload(ruta, archivo, { upsert: true })
  return error ? null : ruta
}

// ¿El elemento tiene al menos un hijo colgado?
export async function tieneHijos(
  id: number,
  dom: DominioElemento = DOMINIO_PROYECTO,
): Promise<boolean> {
  const { count } = await supabase
    .from(dom.tabla)
    .select('id', { count: 'exact', head: true })
    .eq('parent_elemento_id', id)
  return (count ?? 0) > 0
}

// Crea un elemento hijo. El parent siempre tiene id, así que es un INSERT directo.
export async function crearElemento(
  d: ElementoDraft,
  proyectoId: number,
  parentId: number | null,
  dom: DominioElemento = DOMINIO_PROYECTO,
): Promise<number | null> {
  const payload = { ...draftAGuardar(d, parentId), ...dom.camposExtra(proyectoId, d.estado) }
  const { data } = await supabase.from(dom.tabla).insert(payload).select('id').single()
  const id = (data as { id: number } | null)?.id ?? null
  if (id != null && d.fotoArchivo) {
    const ruta = await subirFoto(id, d.fotoArchivo, dom)
    if (ruta) await supabase.from(dom.tabla).update({ foto_url: ruta }).eq('id', id)
  }
  return id
}

// Actualiza un elemento existente (no mueve de padre: parentId es el actual).
export async function actualizarElemento(
  d: ElementoDraft,
  proyectoId: number,
  parentId: number | null,
  dom: DominioElemento = DOMINIO_PROYECTO,
): Promise<void> {
  if (d.dbId == null) return
  const payload = { ...draftAGuardar(d, parentId), ...dom.camposExtra(proyectoId, d.estado) }
  await supabase.from(dom.tabla).update(payload).eq('id', d.dbId)
  if (d.fotoArchivo) {
    const ruta = await subirFoto(d.dbId, d.fotoArchivo, dom)
    if (ruta) {
      await supabase.from(dom.tabla).update({ foto_url: ruta }).eq('id', d.dbId)
    }
  }
}

// Borra un elemento (sus procesos se van en cascada por la FK).
export async function eliminarElemento(
  id: number,
  dom: DominioElemento = DOMINIO_PROYECTO,
): Promise<void> {
  await supabase.from(dom.tabla).delete().eq('id', id)
}

// Atajo "un solo item": crea un Componente raíz que hereda descripción y foto del
// proyecto (cantidad 1; el resto se completa después). Devuelve el elemento creado.
export async function crearComponenteInicial(
  proyectoId: number,
  descripcion: string,
  fotoUrl: string | null,
): Promise<Elemento | null> {
  const { data } = await supabase
    .from('elementos')
    .insert({
      proyecto_id: proyectoId,
      parent_elemento_id: null,
      tipo: 'componente',
      descripcion,
      cantidad: 1,
      foto_url: fotoUrl,
      estado: 'Espera MP',
    })
    .select(SELECT_ELEMENTO)
    .single()
  return (data as unknown as Elemento) ?? null
}

// Sube por parent_elemento_id desde un elemento hasta la raíz. Devuelve la cadena
// completa [raíz, …, elemento] para armar el breadcrumb con todos los niveles,
// entres por donde entres.
export async function cargarAncestros(
  elemento: Elemento,
  dom: DominioElemento = DOMINIO_PROYECTO,
): Promise<Elemento[]> {
  const cadena: Elemento[] = [elemento]
  let parentId = elemento.parent_elemento_id
  while (parentId != null) {
    const { data, error } = await supabase
      .from(dom.tabla)
      .select(dom.columnas)
      .eq('id', parentId)
      .single()
    if (error || !data) break
    const padre = data as unknown as Elemento
    cadena.unshift(padre)
    parentId = padre.parent_elemento_id
  }
  return cadena
}
