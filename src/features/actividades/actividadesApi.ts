import { supabase } from '../../shared/lib/supabaseClient'

// -----------------------------------------------------------------------------
// Actividades del operario: lo que tiene planificado para un día.
//
// Se lee de `procesos` por plan_fecha + plan_operario_id (lo mismo que muestra
// el tablero), y se resuelven los datos que el operario necesita ver: qué pieza,
// de qué proyecto y de qué cliente.
// -----------------------------------------------------------------------------

export type EstadoActividad = 'planificado' | 'hecho_operario' | 'hecho'

export type Actividad = {
  procesoId: number
  elementoId: number
  proyectoId: number | null
  orden: number
  proceso: string // nombre del tipo de proceso (o el texto libre)
  descripcion: string // la pieza
  cantidad: number
  cliente: string
  pedidoNro: string | null
  urgencia: string
  planFecha: string
  planHora: string | null
  maquina: string | null
  estado: EstadoActividad
  esRetrabajo: boolean
  // Tiempo estimado por la planificación (setup + operación + margen).
  minutosEstimados: number
  // Hay un tramo abierto = la actividad está corriendo o en pausa ahora mismo.
  enCurso: boolean
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function uno(v: any) {
  return Array.isArray(v) ? v[0] : v
}

const SELECT_ACTIVIDAD = `
  id, elemento_id, orden, proceso_otro, es_retrabajo, estado,
  plan_fecha, plan_hora, setup_min, operacion_min, margen_min,
  tipo:tipos_proceso!tipo_proceso_id ( nombre ),
  maquina:maquinas!plan_maquina_id ( nombre ),
  elemento:elementos!elemento_id (
    id, descripcion, cantidad, proyecto_id,
    proyecto:proyectos!proyecto_id (
      id, pedido_nro, urgencia,
      empresa:empresas!empresa_id ( nombre )
    )
  )
`

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapActividad(r: any, abiertos: Set<number>): Actividad {
  const el = uno(r.elemento)
  const proy = el ? uno(el.proyecto) : null
  const emp = proy ? uno(proy.empresa) : null
  return {
    procesoId: r.id,
    elementoId: r.elemento_id,
    proyectoId: el?.proyecto_id ?? null,
    orden: Number(r.orden ?? 0),
    proceso: uno(r.tipo)?.nombre || r.proceso_otro || '(sin proceso)',
    descripcion: el?.descripcion ?? '',
    cantidad: Number(el?.cantidad ?? 1),
    cliente: emp?.nombre ?? '',
    pedidoNro: proy?.pedido_nro ?? null,
    urgencia: proy?.urgencia ?? 'media',
    planFecha: r.plan_fecha,
    planHora: r.plan_hora ? String(r.plan_hora).slice(0, 5) : null,
    maquina: uno(r.maquina)?.nombre ?? null,
    estado: (r.estado ?? 'planificado') as EstadoActividad,
    esRetrabajo: !!r.es_retrabajo,
    minutosEstimados:
      Number(r.setup_min ?? 0) + Number(r.operacion_min ?? 0) + Number(r.margen_min ?? 0),
    enCurso: abiertos.has(r.id),
  }
}

// Procesos con algún tramo sin cerrar (corriendo o en pausa).
async function procesosEnCurso(ids: number[]): Promise<Set<number>> {
  if (!ids.length) return new Set()
  const { data, error } = await supabase
    .from('actividad_tramos')
    .select('proceso_id')
    .in('proceso_id', ids)
    .is('fin', null)
  if (error) throw new Error(error.message)
  return new Set((data ?? []).map((t) => t.proceso_id as number))
}

// Actividades de un operario para una fecha.
export async function cargarActividadesDelDia(
  personalId: number,
  fecha: string,
): Promise<Actividad[]> {
  const { data, error } = await supabase
    .from('procesos')
    .select(SELECT_ACTIVIDAD)
    .eq('plan_operario_id', personalId)
    .eq('plan_fecha', fecha)
    .eq('proceso_eliminado', false)
    .order('plan_hora', { nullsFirst: false })
  if (error) throw new Error(error.message)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const filas = (data ?? []) as any[]
  const abiertos = await procesosEnCurso(filas.map((r) => r.id))
  return filas.map((r) => mapActividad(r, abiertos))
}

// Actividades de días ANTERIORES que quedaron sin terminar: son las que hay que
// acomodar. Se avisan aparte para que no se pierdan de vista.
export async function cargarAtrasadas(personalId: number, hoy: string): Promise<Actividad[]> {
  const { data, error } = await supabase
    .from('procesos')
    .select(SELECT_ACTIVIDAD)
    .eq('plan_operario_id', personalId)
    .lt('plan_fecha', hoy)
    .eq('proceso_eliminado', false)
    .in('estado', ['planificado'])
    .order('plan_fecha')
  if (error) throw new Error(error.message)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const filas = (data ?? []) as any[]
  const abiertos = await procesosEnCurso(filas.map((r) => r.id))
  return filas.map((r) => mapActividad(r, abiertos))
}

// Operarios que pueden elegirse al mirar la agenda de otro (solo supervisores).
export type OperarioOpcion = { id: number; nombre: string }

export async function cargarOperarios(): Promise<OperarioOpcion[]> {
  const { data, error } = await supabase
    .from('personal')
    .select('id, nombre, apellido')
    .eq('activo', true)
    .eq('en_tablero', true)
    .order('nombre')
  if (error) throw new Error(error.message)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((r: any) => ({
    id: r.id,
    nombre: [r.nombre, r.apellido].filter(Boolean).join(' '),
  }))
}
