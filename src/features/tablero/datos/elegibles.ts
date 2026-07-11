// features/tablero/datos/elegibles.ts
// -----------------------------------------------------------------------------
// Procesos que se pueden planificar desde el botón "+" de una celda: los que
// están SIN PLANIFICAR y cuyo elemento y proyecto están en un estado activo.
// Los que tienen algún predecesor sin planificar salen marcados (se muestran
// grisados en el selector, elegibles con advertencia).
//
// Toca la base: no se testea con Vitest; se valida en pantalla.
// -----------------------------------------------------------------------------

import { supabase } from '../../../shared/lib/supabaseClient'
import type { MaquinaTablero } from '../tipos'
import type { ModoProceso } from '../../produccion/procesoTipos'

// Estados que habilitan planificar (fáciles de ampliar si el negocio suma otros).
const ESTADOS_ELEMENTO_ACTIVOS = ['Espera MP', 'Proceso']
const ESTADOS_PROYECTO_ACTIVOS = ['Pedido', 'Mantenimiento']

export type ProcesoElegible = {
  procesoId: number
  descripcion: string
  tipoProceso: string | null
  modo: ModoProceso
  cliente: string
  clienteFinal: string | null
  pedidoNro: string | null
  urgencia: string
  fotoUrl: string | null
  maquinaId: number | null
  maquinaNombre: string | null
  predecesorPendiente: boolean
  // Para meterlo en la simulación al planificarlo:
  setupMin: number
  operacionMin: number
  margenMin: number
  cantidad: number
}

/* eslint-disable @typescript-eslint/no-explicit-any */

export async function cargarProcesosElegibles(
  tiposProceso: Map<number, string>,
  maquinas: Map<number, MaquinaTablero>,
): Promise<ProcesoElegible[]> {
  // Procesos sin planificar (no eliminados) con su elemento → proyecto → empresa.
  const { data, error } = await supabase
    .from('procesos')
    .select(
      'id, tipo_proceso_id, proceso_otro, modo, setup_min, operacion_min, margen_min, maquina_id, maquina_otra, ' +
        'elemento:elementos!elemento_id ( descripcion, cantidad, foto_url, estado, ' +
        'proyecto:proyectos!proyecto_id ( estado, urgencia, pedido_nro, cliente_final_texto, ' +
        'empresa:empresas!empresa_id ( nombre ), cliente_final:empresas!cliente_final_empresa_id ( nombre ) ) )',
    )
    .eq('estado', 'sin_planificar')
    .eq('proceso_eliminado', false)
  if (error) throw new Error(error.message)

  const elegibles: ProcesoElegible[] = []
  const ids: number[] = []
  for (const r of (data ?? []) as any[]) {
    const elem = r.elemento
    if (!elem || !ESTADOS_ELEMENTO_ACTIVOS.includes(elem.estado)) continue
    const proy = elem.proyecto
    if (!proy || !ESTADOS_PROYECTO_ACTIVOS.includes(proy.estado)) continue
    const maq = r.maquina_id != null ? maquinas.get(r.maquina_id) : undefined
    elegibles.push({
      procesoId: r.id,
      descripcion: elem.descripcion ?? '',
      tipoProceso: r.tipo_proceso_id != null ? (tiposProceso.get(r.tipo_proceso_id) ?? null) : r.proceso_otro,
      modo: r.modo,
      cliente: proy.empresa?.nombre ?? '',
      clienteFinal: proy.cliente_final?.nombre ?? proy.cliente_final_texto ?? null,
      pedidoNro: proy.pedido_nro ?? null,
      urgencia: proy.urgencia ?? 'media',
      fotoUrl: elem.foto_url ?? null,
      maquinaId: r.maquina_id ?? null,
      maquinaNombre: maq?.nombre ?? r.maquina_otra ?? null,
      predecesorPendiente: false,
      setupMin: Number(r.setup_min ?? 0),
      operacionMin: Number(r.operacion_min ?? 0),
      margenMin: Number(r.margen_min ?? 0),
      cantidad: Number(elem.cantidad ?? 1),
    })
    ids.push(r.id)
  }

  // Predecesor pendiente: algún predecesor (por correlatividad) sigue sin planificar.
  if (ids.length) {
    const { data: corrs, error: e2 } = await supabase
      .from('correlatividades')
      .select('sucesor_id, predecesor:procesos!predecesor_id ( estado )')
      .in('sucesor_id', ids)
    if (e2) throw new Error(e2.message)
    const conPredPendiente = new Set<number>()
    for (const c of (corrs ?? []) as any[]) {
      if (c.predecesor?.estado === 'sin_planificar') conPredPendiente.add(c.sucesor_id)
    }
    for (const el of elegibles) {
      if (conPredPendiente.has(el.procesoId)) el.predecesorPendiente = true
    }
  }

  return elegibles
}

/* eslint-enable @typescript-eslint/no-explicit-any */
