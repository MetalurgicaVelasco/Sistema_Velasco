import { supabase } from '../../shared/lib/supabaseClient'
import type { Proceso, Correlatividad, ModoProceso } from './procesoTipos'
import { DOMINIO_PROCESO_PROYECTO, type DominioProceso } from './dominioProceso'

// Todas las funciones trabajan sobre un DOMINIO (proyecto o matriz). Por defecto,
// el de proyecto: así el código de Proyectos no cambia.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapProceso(r: any): Proceso {
  return {
    id: r.id,
    elementoId: r.elemento_id,
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
    esRetrabajo: r.es_retrabajo ?? false, // la matriz no tiene esta columna
  }
}

// Carga los procesos de un elemento (ordenados) + las correlatividades que tocan a
// esos procesos (incluye las que van hacia/desde procesos de otros elementos).
export async function cargarProcesosDeElemento(
  elementoId: number,
  dom: DominioProceso = DOMINIO_PROCESO_PROYECTO,
): Promise<{ procesos: Proceso[]; correlatividades: Correlatividad[] }> {
  const { data, error } = await supabase
    .from(dom.tabla)
    .select(dom.columnas)
    .eq('elemento_id', elementoId)
    .order('orden')
  if (error) throw new Error(error.message)
  const procesos = (data ?? []).map(mapProceso)

  const ids = procesos.map((p) => p.id)
  let correlatividades: Correlatividad[] = []
  if (ids.length) {
    const lista = ids.join(',')
    const { data: corr, error: e2 } = await supabase
      .from(dom.tablaCorrelatividades)
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

// Cuenta procesos por elemento (para el "N proceso(s)" de la lista de elementos).
export async function contarProcesosPorElementos(
  elementoIds: number[],
  dom: DominioProceso = DOMINIO_PROCESO_PROYECTO,
): Promise<Record<number, number>> {
  const out: Record<number, number> = {}
  if (!elementoIds.length) return out
  const { data, error } = await supabase
    .from(dom.tabla)
    .select('elemento_id')
    .in('elemento_id', elementoIds)
  if (error) throw new Error(error.message)
  for (const r of data ?? []) out[r.elemento_id] = (out[r.elemento_id] ?? 0) + 1
  return out
}

export type GuardarProcesoInput = {
  id: number | null
  elementoId: number
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

function payloadDe(input: GuardarProcesoInput, dom: DominioProceso) {
  const base: Record<string, unknown> = {
    elemento_id: input.elementoId,
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
  }
  // La receta del catálogo no tiene "es retrabajo": eso es una desviación que
  // ocurre en un proyecto concreto, no en la plantilla.
  if (dom.tieneRetrabajo) base.es_retrabajo = input.esRetrabajo
  return base
}

// Inserta (al final del elemento, encadenado al anterior) o actualiza un proceso.
export async function guardarProceso(
  input: GuardarProcesoInput,
  dom: DominioProceso = DOMINIO_PROCESO_PROYECTO,
): Promise<{ error?: string }> {
  if (input.id != null) {
    const { error } = await supabase
      .from(dom.tabla)
      .update(payloadDe(input, dom))
      .eq('id', input.id)
    return error ? { error: error.message } : {}
  }

  // Nuevo: orden = max + 1 entre los hermanos del elemento.
  const { data: hermanos, error: eH } = await supabase
    .from(dom.tabla)
    .select('id, orden')
    .eq('elemento_id', input.elementoId)
    .order('orden', { ascending: false })
  if (eH) return { error: eH.message }
  const previo = hermanos && hermanos.length ? hermanos[0] : null
  const maxOrden = previo ? previo.orden ?? 0 : 0

  const { data: nuevo, error } = await supabase
    .from(dom.tabla)
    .insert({ ...payloadDe(input, dom), orden: maxOrden + 1 })
    .select('id')
    .single()
  if (error) return { error: error.message }

  // Auto-correlatividad lineal: el proceso previo (mayor orden) → el nuevo.
  if (previo) {
    await supabase
      .from(dom.tablaCorrelatividades)
      .insert({ predecesor_id: previo.id, sucesor_id: nuevo.id })
  }
  return {}
}

// Borra un proceso (la cascade se lleva sus correlatividades).
export async function eliminarProceso(
  id: number,
  dom: DominioProceso = DOMINIO_PROCESO_PROYECTO,
): Promise<{ error?: string }> {
  const { error } = await supabase.from(dom.tabla).delete().eq('id', id)
  return error ? { error: error.message } : {}
}

// Sube/baja un proceso intercambiando el orden con su vecino.
export async function moverProceso(
  elementoId: number,
  id: number,
  delta: number,
  dom: DominioProceso = DOMINIO_PROCESO_PROYECTO,
): Promise<{ error?: string }> {
  const { data, error } = await supabase
    .from(dom.tabla)
    .select('id, orden')
    .eq('elemento_id', elementoId)
    .order('orden')
  if (error) return { error: error.message }
  const lista = data ?? []
  const idx = lista.findIndex((p) => p.id === id)
  const nidx = idx + delta
  if (idx < 0 || nidx < 0 || nidx >= lista.length) return {}
  const a = lista[idx]
  const b = lista[nidx]
  const e1 = await supabase.from(dom.tabla).update({ orden: b.orden }).eq('id', a.id)
  if (e1.error) return { error: e1.error.message }
  const e2 = await supabase.from(dom.tabla).update({ orden: a.orden }).eq('id', b.id)
  return e2.error ? { error: e2.error.message } : {}
}

// Mueve un proceso a una posición puntual (1..N) reasignando orden 1..N a todos
// los procesos del elemento. Más directo que apretar las flechitas varias veces.
export async function moverProcesoAPos(
  elementoId: number,
  id: number,
  posNueva: number,
  dom: DominioProceso = DOMINIO_PROCESO_PROYECTO,
): Promise<{ error?: string }> {
  const { data, error } = await supabase
    .from(dom.tabla)
    .select('id, orden')
    .eq('elemento_id', elementoId)
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
      supabase.from(dom.tabla).update({ orden: i + 1 }).eq('id', p.id),
    ),
  )
  const conError = updates.find((u) => u.error)
  return conError?.error ? { error: conError.error.message } : {}
}

// Duplica un proceso al final del elemento, sin correlatividades. Si asRetrabajo,
// lo marca como retrabajo.
export async function duplicarProceso(
  id: number,
  asRetrabajo: boolean,
  dom: DominioProceso = DOMINIO_PROCESO_PROYECTO,
): Promise<{ error?: string }> {
  const { data, error } = await supabase
    .from(dom.tabla)
    .select(dom.columnas)
    .eq('id', id)
    .single()
  if (error) return { error: error.message }
  const orig = mapProceso(data)
  const { data: hermanos } = await supabase
    .from(dom.tabla)
    .select('orden')
    .eq('elemento_id', orig.elementoId)
    .order('orden', { ascending: false })
  const maxOrden = hermanos && hermanos.length ? hermanos[0].orden ?? 0 : 0
  const copia: Record<string, unknown> = {
    elemento_id: orig.elementoId,
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
  }
  if (dom.tieneRetrabajo) copia.es_retrabajo = asRetrabajo
  const { error: eIns } = await supabase.from(dom.tabla).insert(copia)
  return eIns ? { error: eIns.message } : {}
}

// Borra las correlatividades INTERNAS del elemento y las recrea lineales según el
// orden actual (1→2→3…). Las que van a otros elementos no se tocan.
export async function redefinirPredecesores(
  elementoId: number,
  dom: DominioProceso = DOMINIO_PROCESO_PROYECTO,
): Promise<{ error?: string }> {
  const { data: procs, error } = await supabase
    .from(dom.tabla)
    .select('id')
    .eq('elemento_id', elementoId)
    .order('orden')
  if (error) return { error: error.message }
  const ids = (procs ?? []).map((p) => p.id)
  if (ids.length < 2) return {}

  const lista = ids.join(',')
  const { data: corr, error: e2 } = await supabase
    .from(dom.tablaCorrelatividades)
    .select('id, predecesor_id, sucesor_id')
    .or(`predecesor_id.in.(${lista}),sucesor_id.in.(${lista})`)
  if (e2) return { error: e2.message }
  const internas = (corr ?? [])
    .filter((c) => ids.includes(c.predecesor_id) && ids.includes(c.sucesor_id))
    .map((c) => c.id)
  if (internas.length) {
    const eDel = await supabase.from(dom.tablaCorrelatividades).delete().in('id', internas)
    if (eDel.error) return { error: eDel.error.message }
  }
  const inserts = []
  for (let i = 1; i < ids.length; i++) {
    inserts.push({ predecesor_id: ids[i - 1], sucesor_id: ids[i] })
  }
  const eIns = await supabase.from(dom.tablaCorrelatividades).insert(inserts)
  return eIns.error ? { error: eIns.error.message } : {}
}

export async function agregarCorrelatividad(
  predecesorId: number,
  sucesorId: number,
  dom: DominioProceso = DOMINIO_PROCESO_PROYECTO,
): Promise<{ error?: string }> {
  const { error } = await supabase
    .from(dom.tablaCorrelatividades)
    .insert({ predecesor_id: predecesorId, sucesor_id: sucesorId })
  return error ? { error: error.message } : {}
}

export async function quitarCorrelatividad(
  id: number,
  dom: DominioProceso = DOMINIO_PROCESO_PROYECTO,
): Promise<{ error?: string }> {
  const { error } = await supabase.from(dom.tablaCorrelatividades).delete().eq('id', id)
  return error ? { error: error.message } : {}
}
