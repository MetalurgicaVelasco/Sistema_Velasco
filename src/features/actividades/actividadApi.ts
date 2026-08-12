import { supabase } from '../../shared/lib/supabaseClient'
import type { Tramo } from './tiempos'

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

// Iniciar o reanudar: cierra lo que esté abierto y abre un tramo de trabajo.
export async function iniciarTrabajo(procesoId: number): Promise<{ error?: string }> {
  const ahora = new Date().toISOString()
  const err = await cerrarAbierto(procesoId, ahora)
  if (err) return { error: err }
  const u = await usuarioActual()
  const { error } = await supabase.from('actividad_tramos').insert({
    proceso_id: procesoId,
    tipo: 'trabajo',
    inicio: ahora,
    inicio_real: ahora,
    creado_por: u.id,
    creado_por_nombre: u.nombre,
  })
  return error ? { error: error.message } : {}
}

// Pausar: cierra el trabajo en curso y abre un tramo de pausa con su motivo.
export async function pausar(procesoId: number, p: DatosPausa): Promise<{ error?: string }> {
  const ahora = new Date().toISOString()
  const err = await cerrarAbierto(procesoId, ahora)
  if (err) return { error: err }
  const u = await usuarioActual()
  const { error } = await supabase.from('actividad_tramos').insert({
    proceso_id: procesoId,
    tipo: 'pausa',
    motivo: p.motivo,
    motivo_detalle: p.detalle ?? null,
    autorizado_por: p.autorizadoPor ?? null,
    inicio: ahora,
    inicio_real: ahora,
    creado_por: u.id,
    creado_por_nombre: u.nombre,
  })
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
): Promise<{ error?: string }> {
  const { error } = await supabase
    .from('actividad_tramos')
    .update({ inicio, fin, editado: true })
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
  const ahora = new Date().toISOString()
  const { error } = await supabase.from('actividad_tramos').insert({
    proceso_id: procesoId,
    tipo: datos.tipo,
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
