import { supabase } from '../../shared/lib/supabaseClient'
import { cargarRemitidoPorProyecto } from './remitidoApi'

// Al cerrar un proyecto se avisa si quedan ítems sin remitir del todo. Mismo
// criterio que el resto: se miran los ELEMENTOS RAÍZ (un conjunto cuenta como
// una línea), sin retrabajos ni dispositivos. Lo remitido es la cantidad
// derivada de notas + remitos directos.
export type ItemIncompleto = {
  descripcion: string
  total: number
  remitido: number
  faltante: number
}

export async function itemsConRemitoIncompleto(proyectoId: number): Promise<ItemIncompleto[]> {
  const [{ data, error }, remitido] = await Promise.all([
    supabase
      .from('elementos')
      .select('id, descripcion, cantidad, es_retrabajo, es_dispositivo')
      .eq('proyecto_id', proyectoId)
      .is('parent_elemento_id', null)
      .order('id'),
    cargarRemitidoPorProyecto(proyectoId),
  ])
  if (error) throw new Error(error.message)

  const out: ItemIncompleto[] = []
  for (const e of data ?? []) {
    if (e.es_retrabajo || e.es_dispositivo) continue
    const total = Number(e.cantidad ?? 1)
    const rem = remitido[e.id] ?? 0
    if (rem < total) {
      out.push({ descripcion: e.descripcion ?? '(sin descripción)', total, remitido: rem, faltante: total - rem })
    }
  }
  return out
}
