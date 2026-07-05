// features/tablero/datos/consultas.ts
// -----------------------------------------------------------------------------
// Lecturas del tablero desde Supabase. Solo LECTURA; la escritura del motor va
// por la RPC aplicar_plan_tablero (otra capa, más adelante).
//
// Patrón (igual que procesosApi): una constante COLS con las columnas, una
// función map* que pasa de snake_case (base) a camelCase (app) y convierte los
// numeric con Number(). El motor trabaja solo con estos objetos ya tipados.
// -----------------------------------------------------------------------------

import { supabase } from '../../../shared/lib/supabaseClient'
import type {
  ProcesoTablero, PlanAceptado, EstadoProceso,
  Pulmon, Vacacion, PersonalTablero, MaquinaTablero,
} from '../tipos'
import type { ModoProceso, Correlatividad } from '../../produccion/procesoTipos'

// Columnas de procesos que necesita el tablero (base + planificación).
const COLS_PROCESO =
  'id, elemento_id, orden, tipo_proceso_id, proceso_otro, modo, setup_min, ' +
  'operacion_min, margen_min, maquina_id, maquina_otra, operario_id, ' +
  'detalle_trabajo, es_retrabajo, estado, plan_fecha, plan_hora, ' +
  'plan_operario_id, plan_maquina_id, plan_aceptado, real_fecha_inicio, ' +
  'real_hora_inicio, real_fecha_fin, real_hora_fin, proceso_eliminado, ' +
  'setup_solapable, grupo_division_id'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapPlanAceptado(j: any): PlanAceptado | null {
  if (!j) return null
  return {
    setupMin: Number(j.setup_min),
    operacionMin: Number(j.operacion_min),
    margenMin: Number(j.margen_min),
    cantidad: Number(j.cantidad),
    modo: j.modo as ModoProceso,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapProcesoTablero(r: any): ProcesoTablero {
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
    esRetrabajo: r.es_retrabajo,
    estado: r.estado as EstadoProceso,
    planFecha: r.plan_fecha,
    planHora: r.plan_hora,
    planOperarioId: r.plan_operario_id,
    planMaquinaId: r.plan_maquina_id,
    planAceptado: mapPlanAceptado(r.plan_aceptado),
    realFechaInicio: r.real_fecha_inicio,
    realHoraInicio: r.real_hora_inicio,
    realFechaFin: r.real_fecha_fin,
    realHoraFin: r.real_hora_fin,
    procesoEliminado: r.proceso_eliminado,
    setupSolapable: r.setup_solapable,
    grupoDivisionId: r.grupo_division_id,
  }
}

// Procesos con plan_fecha dentro de la ventana [desde, hasta].
// (El margen para procesos automáticos largos que arrancan antes y cruzan a la
// ventana se ajusta en el render multi-día, más adelante.)
export async function cargarProcesosPlanificados(
  desde: string,
  hasta: string,
): Promise<ProcesoTablero[]> {
  const { data, error } = await supabase
    .from('procesos')
    .select(COLS_PROCESO)
    .gte('plan_fecha', desde)
    .lte('plan_fecha', hasta)
    .order('plan_fecha')
  if (error) throw new Error(error.message)
  return (data ?? []).map(mapProcesoTablero)
}

// Operarios que van al tablero (en_tablero y activo), por orden de columna.
export async function cargarPersonalTablero(): Promise<PersonalTablero[]> {
  const { data, error } = await supabase
    .from('personal')
    .select(
      'id, nombre, apellido, horario_entrada, horario_salida, ' +
        'horario_sabado_inicio, horario_sabado_fin, color_borde, orden_tablero',
    )
    .eq('en_tablero', true)
    .eq('activo', true)
    .order('orden_tablero', { nullsFirst: false })
  if (error) throw new Error(error.message)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((r: any) => ({
    id: r.id,
    nombre: r.nombre,
    apellido: r.apellido,
    horarioEntrada: r.horario_entrada,
    horarioSalida: r.horario_salida,
    horarioSabadoInicio: r.horario_sabado_inicio,
    horarioSabadoFin: r.horario_sabado_fin,
    colorBorde: r.color_borde,
    ordenTablero: r.orden_tablero,
  }))
}

// Máquinas (id, nombre, color de borde).
export async function cargarMaquinasTablero(): Promise<MaquinaTablero[]> {
  const { data, error } = await supabase
    .from('maquinas')
    .select('id, nombre, color')
    .order('nombre')
  if (error) throw new Error(error.message)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((r: any) => ({ id: r.id, nombre: r.nombre, color: r.color }))
}

// Pulmones cuya fecha cae en la ventana [desde, hasta].
export async function cargarPulmones(desde: string, hasta: string): Promise<Pulmon[]> {
  const { data, error } = await supabase
    .from('pulmones')
    .select('id, personal_id, maquina_id, fecha, hora_inicio, duracion_min')
    .gte('fecha', desde)
    .lte('fecha', hasta)
  if (error) throw new Error(error.message)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((r: any) => ({
    id: r.id,
    personalId: r.personal_id,
    maquinaId: r.maquina_id,
    fecha: r.fecha,
    horaInicio: r.hora_inicio,
    duracionMin: Number(r.duracion_min),
  }))
}

// Vacaciones que solapan la ventana [desde, hasta].
export async function cargarVacaciones(desde: string, hasta: string): Promise<Vacacion[]> {
  const { data, error } = await supabase
    .from('personal_vacaciones')
    .select('id, personal_id, desde, hasta')
    .lte('desde', hasta)
    .gte('hasta', desde)
  if (error) throw new Error(error.message)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((r: any) => ({
    id: r.id,
    personalId: r.personal_id,
    desde: r.desde,
    hasta: r.hasta,
  }))
}

// Correlatividades que tocan a un conjunto de procesos (mismo patrón que procesosApi).
export async function cargarCorrelatividadesDe(
  procesoIds: number[],
): Promise<Correlatividad[]> {
  if (!procesoIds.length) return []
  const lista = procesoIds.join(',')
  const { data, error } = await supabase
    .from('correlatividades')
    .select('id, predecesor_id, sucesor_id')
    .or(`predecesor_id.in.(${lista}),sucesor_id.in.(${lista})`)
  if (error) throw new Error(error.message)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((c: any) => ({
    id: c.id,
    predecesorId: c.predecesor_id,
    sucesorId: c.sucesor_id,
  }))
}
