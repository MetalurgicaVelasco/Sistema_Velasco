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

// Hijos directos de un elemento (los que cuelgan de él).
export async function cargarHijos(elementoId: number): Promise<Elemento[]> {
  const { data } = await supabase
    .from('elementos')
    .select(SELECT_ELEMENTO)
    .eq('parent_elemento_id', elementoId)
    .order('id')
  return (data as unknown as Elemento[]) ?? []
}
