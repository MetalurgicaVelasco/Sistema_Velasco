import { supabase } from '../../shared/lib/supabaseClient'
import type { Proceso, Correlatividad, ModoProceso } from './procesoTipos'

const COLS =
  'id, item_id, orden, tipo_proceso_id, proceso_otro, modo, setup_min, ' +
  'operacion_min, margen_min, maquina_id, maquina_otra, operario_id, ' +
  'detalle_trabajo, es_retrabajo'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapProceso(r: any): Proceso {
  return {
    id: r.id,
    itemId: r.item_id,
    orden: r.orden,
    tipoProcesoId: r.tipo_proceso_id,
    procesoOtro: r.proceso_otro,
    modo: r.modo as ModoProceso,
    setupMin: Number(r.setup_min),
    operacionMin: Number(r.operacion_min),
    margenMin: Number(r.margen_min),
    maquinaId: r.maquina_id,
    maquinaOtra: r.maquina_otra,
    operarioId: r.operario_id,
    detalleTrabajo: r.detalle_trabajo,
    esRetrabajo: r.es_retrabajo,
  }
}

// Carga los procesos de un item (ordenados) + las correlatividades que tocan a
// esos procesos (incluye las que van hacia/desde procesos de otros items).
export async function cargarProcesosDeItem(
  itemId: number,
): Promise<{ procesos: Proceso[]; correlatividades: Correlatividad[] }> {
  const { data, error } = await supabase
    .from('procesos')
    .select(COLS)
    .eq('item_id', itemId)
    .order('orden')
  if (error) throw new Error(error.message)
  const procesos = (data ?? []).map(mapProceso)

  const ids = procesos.map((p) => p.id)
  let correlatividades: Correlatividad[] = []
  if (ids.length) {
    const lista = ids.join(',')
    const { data: corr, error: e2 } = await supabase
      .from('correlatividades')
      .select('id, predecesor_id, sucesor_id')
      .or(`predecesor_id.in.(${lista}),sucesor_id.in.(${lista})`)
    if (e2) throw new Error(e2.message)
    correlatividades = (corr ?? []).map((c) => ({
      id: c.id,
      predecesorId: c.predecesor_id,
      sucesorId: c.sucesor_id,
    }))
  }
  return { procesos, correlatividades }
}

// Cuenta procesos por item (para el "N proceso(s)" de la lista de items).
export async function contarProcesosPorItems(
  itemIds: number[],
): Promise<Record<number, number>> {
  const out: Record<number, number> = {}
  if (!itemIds.length) return out
  const { data, error } = await supabase
    .from('procesos')
    .select('item_id')
    .in('item_id', itemIds)
  if (error) throw new Error(error.message)
  for (const r of data ?? []) out[r.item_id] = (out[r.item_id] ?? 0) + 1
  return out
}

export type GuardarProcesoInput = {
  id: number | null
  itemId: number
  tipoProcesoId: number | null
  procesoOtro: string | null
  modo: ModoProceso
  setupMin: number
  operacionMin: number
  margenMin: number
  maquinaId: number | null
  maquinaOtra: string | null
  operarioId: number | null
  detalleTrabajo: string | null
  esRetrabajo: boolean
}

function payloadDe(input: GuardarProcesoInput) {
  return {
    item_id: input.itemId,
    tipo_proceso_id: input.tipoProcesoId,
    proceso_otro: input.procesoOtro,
    modo: input.modo,
    setup_min: input.setupMin,
    operacion_min: input.operacionMin,
    margen_min: input.margenMin,
    maquina_id: input.maquinaId,
    maquina_otra: input.maquinaOtra,
    operario_id: input.operarioId,
    detalle_trabajo: input.detalleTrabajo,
    es_retrabajo: input.esRetrabajo,
  }
}

// Inserta (al final del item, encadenado al anterior) o actualiza un proceso.
export async function guardarProceso(
  input: GuardarProcesoInput,
): Promise<{ error?: string }> {
  if (input.id != null) {
    const { error } = await supabase
      .from('procesos')
      .update(payloadDe(input))
      .eq('id', input.id)
    return error ? { error: error.message } : {}
  }

  // Nuevo: orden = max + 1 entre los hermanos del item.
  const { data: hermanos, error: eH } = await supabase
    .from('procesos')
    .select('id, orden')
    .eq('item_id', input.itemId)
    .order('orden', { ascending: false })
  if (eH) return { error: eH.message }
  const previo = hermanos && hermanos.length ? hermanos[0] : null
  const maxOrden = previo ? previo.orden ?? 0 : 0

  const { data: nuevo, error } = await supabase
    .from('procesos')
    .insert({ ...payloadDe(input), orden: maxOrden + 1 })
    .select('id')
    .single()
  if (error) return { error: error.message }

  // Auto-correlatividad lineal: el proceso previo (mayor orden) → el nuevo.
  if (previo) {
    await supabase
      .from('correlatividades')
      .insert({ predecesor_id: previo.id, sucesor_id: nuevo.id })
  }
  return {}
}

// Borra un proceso (la cascade se lleva sus correlatividades).
export async function eliminarProceso(id: number): Promise<{ error?: string }> {
  const { error } = await supabase.from('procesos').delete().eq('id', id)
  return error ? { error: error.message } : {}
}

// Sube/baja un proceso intercambiando el orden con su vecino.
export async function moverProceso(
  itemId: number,
  id: number,
  delta: number,
): Promise<{ error?: string }> {
  const { data, error } = await supabase
    .from('procesos')
    .select('id, orden')
    .eq('item_id', itemId)
    .order('orden')
  if (error) return { error: error.message }
  const lista = data ?? []
  const idx = lista.findIndex((p) => p.id === id)
  const nidx = idx + delta
  if (idx < 0 || nidx < 0 || nidx >= lista.length) return {}
  const a = lista[idx]
  const b = lista[nidx]
  const e1 = await supabase.from('procesos').update({ orden: b.orden }).eq('id', a.id)
  if (e1.error) return { error: e1.error.message }
  const e2 = await supabase.from('procesos').update({ orden: a.orden }).eq('id', b.id)
  return e2.error ? { error: e2.error.message } : {}
}

// Mueve un proceso a una posición puntual (1..N) reasignando orden 1..N a todos
// los procesos del item. Más directo que apretar las flechitas varias veces.
export async function moverProcesoAPos(
  itemId: number,
  id: number,
  posNueva: number,
): Promise<{ error?: string }> {
  const { data, error } = await supabase
    .from('procesos')
    .select('id, orden')
    .eq('item_id', itemId)
    .order('orden')
  if (error) return { error: error.message }
  const lista = data ?? []
  const total = lista.length
  const idxActual = lista.findIndex((p) => p.id === id)
  if (idxActual < 0) return {}
  if (!Number.isFinite(posNueva) || posNueva < 1 || posNueva > total) {
    return { error: `La posición debe estar entre 1 y ${total}.` }
  }
  if (posNueva === idxActual + 1) return {} // sin cambios
  const arr = lista.slice()
  const [movido] = arr.splice(idxActual, 1)
  arr.splice(posNueva - 1, 0, movido)
  const updates = await Promise.all(
    arr.map((p, i) =>
      supabase.from('procesos').update({ orden: i + 1 }).eq('id', p.id),
    ),
  )
  const conError = updates.find((u) => u.error)
  return conError?.error ? { error: conError.error.message } : {}
}

// Duplica un proceso al final del item, sin correlatividades. Si asRetrabajo,
// lo marca como retrabajo.
export async function duplicarProceso(
  id: number,
  asRetrabajo: boolean,
): Promise<{ error?: string }> {
  const { data, error } = await supabase
    .from('procesos')
    .select(COLS)
    .eq('id', id)
    .single()
  if (error) return { error: error.message }
  const orig = mapProceso(data)
  const { data: hermanos } = await supabase
    .from('procesos')
    .select('orden')
    .eq('item_id', orig.itemId)
    .order('orden', { ascending: false })
  const maxOrden = hermanos && hermanos.length ? hermanos[0].orden ?? 0 : 0
  const copia = {
    item_id: orig.itemId,
    orden: maxOrden + 1,
    tipo_proceso_id: orig.tipoProcesoId,
    proceso_otro: orig.procesoOtro,
    modo: orig.modo,
    setup_min: orig.setupMin,
    operacion_min: orig.operacionMin,
    margen_min: orig.margenMin,
    maquina_id: orig.maquinaId,
    maquina_otra: orig.maquinaOtra,
    operario_id: orig.operarioId,
    detalle_trabajo: orig.detalleTrabajo,
    es_retrabajo: asRetrabajo,
  }
  const { error: eIns } = await supabase.from('procesos').insert(copia)
  return eIns ? { error: eIns.message } : {}
}

// Borra las correlatividades INTERNAS del item y las recrea lineales según el
// orden actual (1→2→3…). Las que van a otros items no se tocan.
export async function redefinirPredecesores(
  itemId: number,
): Promise<{ error?: string }> {
  const { data: procs, error } = await supabase
    .from('procesos')
    .select('id')
    .eq('item_id', itemId)
    .order('orden')
  if (error) return { error: error.message }
  const ids = (procs ?? []).map((p) => p.id)
  if (ids.length < 2) return {}

  const lista = ids.join(',')
  const { data: corr, error: e2 } = await supabase
    .from('correlatividades')
    .select('id, predecesor_id, sucesor_id')
    .or(`predecesor_id.in.(${lista}),sucesor_id.in.(${lista})`)
  if (e2) return { error: e2.message }
  const internas = (corr ?? [])
    .filter((c) => ids.includes(c.predecesor_id) && ids.includes(c.sucesor_id))
    .map((c) => c.id)
  if (internas.length) {
    const eDel = await supabase.from('correlatividades').delete().in('id', internas)
    if (eDel.error) return { error: eDel.error.message }
  }
  const inserts = []
  for (let i = 1; i < ids.length; i++) {
    inserts.push({ predecesor_id: ids[i - 1], sucesor_id: ids[i] })
  }
  const eIns = await supabase.from('correlatividades').insert(inserts)
  return eIns.error ? { error: eIns.error.message } : {}
}

export async function agregarCorrelatividad(
  predecesorId: number,
  sucesorId: number,
): Promise<{ error?: string }> {
  const { error } = await supabase
    .from('correlatividades')
    .insert({ predecesor_id: predecesorId, sucesor_id: sucesorId })
  return error ? { error: error.message } : {}
}

export async function quitarCorrelatividad(id: number): Promise<{ error?: string }> {
  const { error } = await supabase.from('correlatividades').delete().eq('id', id)
  return error ? { error: error.message } : {}
}
