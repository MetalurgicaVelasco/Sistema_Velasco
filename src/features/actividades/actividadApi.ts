import { supabase } from '../../shared/lib/supabaseClient'
import type { Tramo } from './tiempos'
import { esProductivo, admiteAutomatico, tipoDePausa, type TipoOperacion } from './tiposOperacion'

// -----------------------------------------------------------------------------
// Una actividad concreta: la orden de trabajo digital y sus tramos de tiempo.
// -----------------------------------------------------------------------------

export type DetalleActividad = {
  procesoId: number
  elementoId: number
  proyectoId: number | null
  estado: 'sin_planificar' | 'planificado' | 'hecho_operario' | 'hecho'
  proceso: string
  ordenTexto: string // "Orden de trabajo 2/5"
  urgencia: string
  cliente: string
  responsable: string | null
  proyectoDescripcion: string
  pedidoNro: string | null
  descripcion: string
  cantidad: number
  fechaIngreso: string | null
  material: string | null
  presentacion: string | null
  detalleTrabajo: string | null
  maquina: string | null
  // Lo planificado: se usa como valor por defecto al registrar los tramos.
  planOperarioId: number | null
  planMaquinaId: number | null
  modoAutomatico: boolean
  minutosEstimados: number
  materialUtilizado: string | null
  observacionesOperario: string | null
  fotoElemento: string | null
  fotoProyecto: string | null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function uno(v: any) {
  return Array.isArray(v) ? v[0] : v
}

export async function cargarDetalleActividad(procesoId: number): Promise<DetalleActividad> {
  const { data, error } = await supabase
    .from('procesos')
    .select(
      `id, elemento_id, orden, proceso_otro, estado, setup_min, operacion_min, margen_min,
       detalle_trabajo, material_utilizado, observaciones_operario, maquina_otra,
       plan_operario_id, plan_maquina_id, modo,
       tipo:tipos_proceso!tipo_proceso_id ( nombre ),
       maquina:maquinas!plan_maquina_id ( nombre ),
       elemento:elementos!elemento_id (
         id, descripcion, cantidad, foto_url, presentacion_mat_prima, proyecto_id,
         material:materiales!material_id ( nombre ),
         proyecto:proyectos!proyecto_id (
           id, descripcion, pedido_nro, urgencia, fecha_ingreso, foto_url,
           empresa:empresas!empresa_id ( nombre ),
           contacto:empresa_contactos!contacto_id ( nombre, apellido )
         )
       )`,
    )
    .eq('id', procesoId)
    .single()
  if (error || !data) throw new Error(error?.message ?? 'Actividad no encontrada.')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = data as any
  const el = uno(r.elemento)
  const proy = el ? uno(el.proyecto) : null
  const emp = proy ? uno(proy.empresa) : null
  const cont = proy ? uno(proy.contacto) : null

  // "Orden de trabajo N/total": posición de este proceso entre los del elemento.
  const { data: hermanos } = await supabase
    .from('procesos')
    .select('id, orden')
    .eq('elemento_id', r.elemento_id)
    .eq('proceso_eliminado', false)
    .order('orden')
  const lista = (hermanos ?? []) as { id: number; orden: number }[]
  const pos = lista.findIndex((p) => p.id === procesoId) + 1
  const ordenTexto = pos > 0 ? `Orden de trabajo ${pos}/${lista.length}` : ''

  return {
    procesoId: r.id,
    elementoId: r.elemento_id,
    proyectoId: el?.proyecto_id ?? null,
    estado: r.estado,
    proceso: uno(r.tipo)?.nombre || r.proceso_otro || '(sin proceso)',
    ordenTexto,
    urgencia: proy?.urgencia ?? 'media',
    cliente: emp?.nombre ?? '',
    responsable: cont ? [cont.nombre, cont.apellido].filter(Boolean).join(' ') : null,
    proyectoDescripcion: proy?.descripcion ?? '',
    pedidoNro: proy?.pedido_nro ?? null,
    descripcion: el?.descripcion ?? '',
    cantidad: Number(el?.cantidad ?? 1),
    fechaIngreso: proy?.fecha_ingreso ?? null,
    material: el ? (uno(el.material)?.nombre ?? null) : null,
    presentacion: el?.presentacion_mat_prima ?? null,
    detalleTrabajo: r.detalle_trabajo ?? null,
    maquina: uno(r.maquina)?.nombre ?? r.maquina_otra ?? null,
    planOperarioId: r.plan_operario_id ?? null,
    planMaquinaId: r.plan_maquina_id ?? null,
    modoAutomatico: r.modo === 'automatica',
    minutosEstimados:
      Number(r.setup_min ?? 0) + Number(r.operacion_min ?? 0) + Number(r.margen_min ?? 0),
    materialUtilizado: r.material_utilizado ?? null,
    observacionesOperario: r.observaciones_operario ?? null,
    fotoElemento: el?.foto_url ?? null,
    fotoProyecto: proy?.foto_url ?? null,
  }
}

// ── Tramos ──────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapTramo(r: any): Tramo {
  return {
    id: r.id,
    tipo: r.tipo,
    inicio: r.inicio,
    fin: r.fin ?? null,
    motivo: r.motivo ?? null,
    motivoDetalle: r.motivo_detalle ?? null,
    autorizadoPor: r.autorizado_por ?? null,
    editado: !!r.editado,
    tipoOperacion: (r.tipo_operacion ?? undefined) as TipoOperacion | undefined,
    automatico: !!r.automatico,
    finMaquina: r.fin_maquina ?? null,
    maquinaId: r.maquina_id ?? null,
  }
}

// Datos de planificación que se usan como valores por defecto del tramo: la
// máquina y si el proceso es automático. La idea es que planificar le ahorre
// toques al operario.
async function defectosDelProceso(
  procesoId: number,
): Promise<{ personalId: number | null; maquinaId: number | null; automatico: boolean }> {
  const { data } = await supabase
    .from('procesos')
    .select('plan_operario_id, plan_maquina_id, modo')
    .eq('id', procesoId)
    .maybeSingle()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = data as any
  return {
    personalId: p?.plan_operario_id ?? null,
    maquinaId: p?.plan_maquina_id ?? null,
    automatico: p?.modo === 'automatica',
  }
}

export async function cargarTramos(procesoId: number): Promise<Tramo[]> {
  const { data, error } = await supabase
    .from('actividad_tramos')
    .select('*')
    .eq('proceso_id', procesoId)
    .order('inicio')
  if (error) throw new Error(error.message)
  return (data ?? []).map(mapTramo)
}

// Máquinas para el selector de la actividad.
export type MaquinaOpcion = { id: number; nombre: string }

export async function cargarMaquinas(): Promise<MaquinaOpcion[]> {
  const { data, error } = await supabase.from('maquinas').select('id, nombre').order('nombre')
  if (error) throw new Error(error.message)
  return (data ?? []) as MaquinaOpcion[]
}

// Otra actividad del mismo operario que sigue en marcha (un tramo manual abierto
// que no es una pausa). Si la hay, no se puede arrancar esta: un operario no
// hace dos cosas manuales a la vez. Las pausas abiertas en otras actividades no
// cuentan: se cierran solas al arrancar (ver iniciarOperacion).
export type ActividadEnCurso = {
  procesoId: number
  proceso: string
  descripcion: string
  tipoOperacion: TipoOperacion
  inicio: string
}

export async function actividadEnCurso(
  procesoId: number,
  personalId: number,
): Promise<ActividadEnCurso | null> {
  const { data, error } = await supabase
    .from('actividad_tramos')
    .select(
      `proceso_id, tipo_operacion, inicio,
       proceso:procesos!proceso_id (
         proceso_otro,
         tipo:tipos_proceso!tipo_proceso_id ( nombre ),
         elemento:elementos!elemento_id ( descripcion )
       )`,
    )
    .eq('personal_id', personalId)
    .is('fin', null)
    .eq('automatico', false)
    .neq('proceso_id', procesoId)
    .not('tipo_operacion', 'in', '(PA,DE)')
    .limit(1)
  if (error) throw new Error(error.message)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = (data ?? [])[0] as any
  if (!r) return null
  const proc = uno(r.proceso)
  return {
    procesoId: r.proceso_id,
    proceso: uno(proc?.tipo)?.nombre || proc?.proceso_otro || '(sin proceso)',
    descripcion: uno(proc?.elemento)?.descripcion ?? '',
    tipoOperacion: r.tipo_operacion,
    inicio: r.inicio,
  }
}

// Cierra las pausas que el operario dejó abiertas en OTRAS actividades. Es el
// flujo natural: pausa X ("me mandaron a otra cosa"), arranca Y, y la pausa de X
// mide justo el tiempo que estuvo parado.
async function cerrarPausasAjenas(
  procesoId: number,
  personalId: number,
  cuando: string,
): Promise<string | null> {
  const { error } = await supabase
    .from('actividad_tramos')
    .update({ fin: cuando, fin_real: cuando })
    .eq('personal_id', personalId)
    .is('fin', null)
    .neq('proceso_id', procesoId)
    .in('tipo_operacion', ['PA', 'DE'])
  return error ? error.message : null
}

async function usuarioActual(): Promise<{ id: string | null; nombre: string | null }> {
  const { data } = await supabase.auth.getUser()
  const u = data.user
  if (!u) return { id: null, nombre: null }
  const meta = (u.user_metadata ?? {}) as Record<string, unknown>
  return { id: u.id, nombre: (meta.nombre as string) || (meta.full_name as string) || u.email || null }
}

// Cierra el tramo abierto (si hay) con la hora indicada.
async function cerrarAbierto(procesoId: number, cuando: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('actividad_tramos')
    .select('id')
    .eq('proceso_id', procesoId)
    .is('fin', null)
    .eq('automatico', false) // el automático sigue corriendo solo
    .limit(1)
  if (error) return error.message
  const abierto = (data ?? [])[0]
  if (!abierto) return null
  const { error: e2 } = await supabase
    .from('actividad_tramos')
    .update({ fin: cuando, fin_real: cuando })
    .eq('id', abierto.id)
  return e2 ? e2.message : null
}

export type MotivoPausa =
  | 'cambio_planificacion'
  | 'problema_tecnico'
  | 'falta_herramienta'
  | 'descanso'
  | 'otro'

export type DatosPausa = {
  motivo: MotivoPausa
  detalle?: string | null
  autorizadoPor?: string | null
}

// Empezar (o cambiar el tipo de lo que se está haciendo) en UN toque: cierra el
// tramo abierto y abre uno nuevo del tipo elegido.
//
// El tramo AUTOMÁTICO no se cierra al pasar a otra cosa: la máquina sigue sola y
// su tiempo se cuenta hasta `fin_maquina`.
export async function iniciarOperacion(
  procesoId: number,
  tipo: TipoOperacion,
  opciones?: {
    automatico?: boolean
    maquinaId?: number | null
    motivo?: MotivoPausa | null
    detalle?: string | null
    autorizadoPor?: string | null
  },
): Promise<{ error?: string }> {
  const ahora = new Date().toISOString()
  const err = await cerrarAbierto(procesoId, ahora)
  if (err) return { error: err }

  const def = await defectosDelProceso(procesoId)
  if (def.personalId == null) return { error: 'La actividad no tiene operario planificado.' }
  const err2 = await cerrarPausasAjenas(procesoId, def.personalId, ahora)
  if (err2) return { error: err2 }

  const u = await usuarioActual()
  // Solo una operación puede quedar andando sola en la máquina.
  const automatico = admiteAutomatico(tipo) && (opciones?.automatico ?? def.automatico)
  const { error } = await supabase.from('actividad_tramos').insert({
    proceso_id: procesoId,
    tipo: esProductivo(tipo) ? 'trabajo' : 'pausa',
    tipo_operacion: tipo,
    personal_id: def.personalId,
    maquina_id: opciones?.maquinaId !== undefined ? opciones.maquinaId : def.maquinaId,
    automatico,
    motivo: opciones?.motivo ?? null,
    motivo_detalle: opciones?.detalle ?? null,
    autorizado_por: opciones?.autorizadoPor ?? null,
    inicio: ahora,
    inicio_real: ahora,
    creado_por: u.id,
    creado_por_nombre: u.nombre,
  })
  return error ? { error: error.message } : {}
}

// Marcar cuándo terminó la máquina de un tramo automático (puede ser al otro
// día). Ahí se cierra el tramo: su tiempo va del inicio al fin de máquina.
// `fin_real` guarda cuándo se cargó el dato.
export async function marcarFinMaquina(
  tramoId: number,
  finMaquina: string,
): Promise<{ error?: string }> {
  const { error } = await supabase
    .from('actividad_tramos')
    .update({ fin_maquina: finMaquina, fin: finMaquina, fin_real: new Date().toISOString() })
    .eq('id', tramoId)
  return error ? { error: error.message } : {}
}

// Pasar la operación en curso de manual a automática o al revés (un toque).
export async function cambiarModoOperacion(
  tramoId: number,
  automatico: boolean,
): Promise<{ error?: string }> {
  const { error } = await supabase
    .from('actividad_tramos')
    .update({ automatico, fin_maquina: null })
    .eq('id', tramoId)
  return error ? { error: error.message } : {}
}

// Cambiar la máquina del tramo en curso (si el operario usó otra que la planificada).
export async function cambiarMaquinaTramo(
  tramoId: number,
  maquinaId: number | null,
): Promise<{ error?: string }> {
  const { error } = await supabase
    .from('actividad_tramos')
    .update({ maquina_id: maquinaId })
    .eq('id', tramoId)
  return error ? { error: error.message } : {}
}

// Finalizar: cierra lo abierto (sea trabajo o pausa) y marca hecho_operario.
export async function finalizar(procesoId: number): Promise<{ error?: string }> {
  const ahora = new Date().toISOString()
  const err = await cerrarAbierto(procesoId, ahora)
  if (err) return { error: err }
  const { error } = await supabase
    .from('procesos')
    .update({ estado: 'hecho_operario', finalizado_operario_en: ahora })
    .eq('id', procesoId)
  return error ? { error: error.message } : {}
}

// Reabrir: vuelve a 'planificado' para poder corregir y sumar tramos.
export async function reabrir(procesoId: number): Promise<{ error?: string }> {
  const { error } = await supabase
    .from('procesos')
    .update({ estado: 'planificado', finalizado_operario_en: null })
    .eq('id', procesoId)
  return error ? { error: error.message } : {}
}

// Campos que completa el operario (se guardan solos mientras escribe).
export async function guardarCamposOperario(
  procesoId: number,
  campos: { materialUtilizado?: string | null; observacionesOperario?: string | null },
): Promise<{ error?: string }> {
  const patch: Record<string, string | null> = {}
  if (campos.materialUtilizado !== undefined) patch.material_utilizado = campos.materialUtilizado
  if (campos.observacionesOperario !== undefined)
    patch.observaciones_operario = campos.observacionesOperario
  if (!Object.keys(patch).length) return {}
  const { error } = await supabase.from('procesos').update(patch).eq('id', procesoId)
  return error ? { error: error.message } : {}
}

// Corregir a mano el horario de un tramo. Los *_real no se tocan nunca: queda
// registrado cuándo se apretó el botón realmente.
export async function corregirTramo(
  tramoId: number,
  inicio: string,
  fin: string | null,
  automatico = false,
): Promise<{ error?: string }> {
  // En un automático, el fin del tramo ES el fin de la máquina.
  const patch = automatico
    ? { inicio, fin, fin_maquina: fin, editado: true }
    : { inicio, fin, editado: true }
  const { error } = await supabase
    .from('actividad_tramos')
    .update(patch)
    .eq('id', tramoId)
  return error ? { error: error.message } : {}
}

// Cargar a mano un tramo que no se registró en el momento (se olvidó de tocar
// los botones). Queda marcado como editado: los *_real guardan cuándo se cargó,
// no cuándo ocurrió, así que la distinción entre lo registrado en vivo y lo
// cargado después no se pierde.
export async function agregarTramo(
  procesoId: number,
  datos: {
    tipo: 'trabajo' | 'pausa'
    inicio: string
    fin: string
    motivo?: MotivoPausa | null
    detalle?: string | null
    autorizadoPor?: string | null
  },
): Promise<{ error?: string }> {
  const u = await usuarioActual()
  const def = await defectosDelProceso(procesoId)
  if (def.personalId == null) return { error: 'La actividad no tiene operario planificado.' }
  const ahora = new Date().toISOString()
  const { error } = await supabase.from('actividad_tramos').insert({
    proceso_id: procesoId,
    tipo: datos.tipo,
    // Cargado a mano: trabajo cuenta como Operando y la pausa según su motivo.
    tipo_operacion: datos.tipo === 'trabajo' ? 'OP' : tipoDePausa(datos.motivo ?? ''),
    personal_id: def.personalId,
    maquina_id: def.maquinaId,
    motivo: datos.tipo === 'pausa' ? (datos.motivo ?? null) : null,
    motivo_detalle: datos.tipo === 'pausa' ? (datos.detalle ?? null) : null,
    autorizado_por: datos.tipo === 'pausa' ? (datos.autorizadoPor ?? null) : null,
    inicio: datos.inicio,
    fin: datos.fin,
    inicio_real: ahora,
    fin_real: ahora,
    editado: true,
    creado_por: u.id,
    creado_por_nombre: u.nombre,
  })
  return error ? { error: error.message } : {}
}

export async function borrarTramo(tramoId: number): Promise<{ error?: string }> {
  const { error } = await supabase.from('actividad_tramos').delete().eq('id', tramoId)
  return error ? { error: error.message } : {}
}
