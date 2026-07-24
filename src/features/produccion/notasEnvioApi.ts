import { supabase } from '../../shared/lib/supabaseClient'
import { cargarDetalleRemitido } from './remitidoApi'

// -----------------------------------------------------------------------------
// Notas de envío.
//
// Qué se puede mandar en una nota (regla del viejo, adaptada al árbol nuevo):
//  - Las líneas son los ELEMENTOS RAÍZ del proyecto. Un conjunto entra como UNA
//    sola línea con su cantidad, no componente por componente.
//  - Los retrabajos y los dispositivos nunca se entregan al cliente.
//  - Lo ya cubierto por un remito DIRECTO no puede ir en una nota.
//  - Se permite una nota sin líneas del proyecto (pieza de muestra), cargando
//    las líneas a mano.
// -----------------------------------------------------------------------------

export const PREFIJO_IMPRESO_NDE = '0001-0000'

export type LineaDisponible = {
  elementoId: number
  descripcion: string
  total: number
  yaRemitido: number
  porRemitoDirecto: number
  disponible: number
}

export async function cargarLineasDisponibles(
  proyectoId: number,
  excluirNotaId?: number,
): Promise<LineaDisponible[]> {
  const [{ data, error }, remitido] = await Promise.all([
    supabase
      .from('elementos')
      .select('id, descripcion, cantidad, es_retrabajo, es_dispositivo')
      .eq('proyecto_id', proyectoId)
      .is('parent_elemento_id', null)
      .order('id'),
    cargarDetalleRemitido(proyectoId, excluirNotaId),
  ])
  if (error) throw new Error(error.message)

  const out: LineaDisponible[] = []
  for (const e of data ?? []) {
    if (e.es_retrabajo || e.es_dispositivo) continue
    const total = Number(e.cantidad ?? 1)
    const yaRemitido = remitido.total[e.id] ?? 0
    const porRemitoDirecto = remitido.porRemitoDirecto[e.id] ?? 0
    out.push({
      elementoId: e.id,
      descripcion: e.descripcion ?? '',
      total,
      yaRemitido,
      porRemitoDirecto,
      // Si ya tiene remito directo, no puede ir por nota.
      disponible: porRemitoDirecto > 0 ? 0 : Math.max(0, total - yaRemitido),
    })
  }
  return out
}

export type LineaNota = {
  elementoId: number | null // null = línea cargada a mano
  descripcion: string
  cantidad: number
}

export type DatosNota = {
  proyectoId: number | null
  empresaId: number
  fecha: string
  pedidoNro: string | null
  observaciones: string | null
  esExterna: boolean
  numeroImpresoDigitos: string | null // los 4 dígitos del papel
  cliente: {
    nombre: string
    razonSocial: string
    cuit: string
    contacto: string
    direccion: string
  }
  lineas: LineaNota[]
}

async function usuarioActual(): Promise<{ id: string | null; nombre: string | null }> {
  const { data } = await supabase.auth.getUser()
  const u = data.user
  if (!u) return { id: null, nombre: null }
  const meta = (u.user_metadata ?? {}) as Record<string, unknown>
  const nombre = (meta.nombre as string) || (meta.full_name as string) || u.email || null
  return { id: u.id, nombre }
}

function numeroImpreso(digitos: string | null): string | null {
  if (!digitos) return null
  const d = digitos.replace(/\D/g, '')
  return d ? PREFIJO_IMPRESO_NDE + d.padStart(4, '0') : null
}

export async function crearNotaEnvio(
  n: DatosNota,
): Promise<{ id?: number; numero?: string; error?: string }> {
  // El número lo reserva la base (secuencia): sin condiciones de carrera.
  const { data: num, error: eNum } = await supabase.rpc('siguiente_numero_nota_envio')
  if (eNum) return { error: 'No se pudo reservar el número de nota: ' + eNum.message }

  const usuario = await usuarioActual()
  const { data: nota, error } = await supabase
    .from('notas_envio')
    .insert({
      numero: num as string,
      numero_impreso: numeroImpreso(n.numeroImpresoDigitos),
      fecha: n.fecha,
      empresa_id: n.empresaId,
      proyecto_id: n.proyectoId,
      es_externa: n.esExterna,
      pedido_nro: n.pedidoNro,
      observaciones: n.observaciones,
      cliente_nombre: n.cliente.nombre,
      cliente_razon_social: n.cliente.razonSocial,
      cliente_cuit: n.cliente.cuit,
      cliente_contacto: n.cliente.contacto,
      cliente_direccion: n.cliente.direccion,
      creado_por: usuario.id,
      creado_por_nombre: usuario.nombre,
    })
    .select('id, numero')
    .single()
  if (error) return { error: error.message }

  const err = await guardarLineas(nota.id as number, n.lineas)
  if (err) return { error: err }
  return { id: nota.id as number, numero: nota.numero as string }
}

export async function actualizarNotaEnvio(id: number, n: DatosNota): Promise<{ error?: string }> {
  const { error } = await supabase
    .from('notas_envio')
    .update({
      numero_impreso: numeroImpreso(n.numeroImpresoDigitos),
      fecha: n.fecha,
      proyecto_id: n.proyectoId,
      pedido_nro: n.pedidoNro,
      observaciones: n.observaciones,
      cliente_nombre: n.cliente.nombre,
      cliente_razon_social: n.cliente.razonSocial,
      cliente_cuit: n.cliente.cuit,
      cliente_contacto: n.cliente.contacto,
      cliente_direccion: n.cliente.direccion,
    })
    .eq('id', id)
  if (error) return { error: error.message }

  // Las líneas se reemplazan enteras: es más simple y seguro que diffear.
  const { error: eDel } = await supabase.from('notas_envio_items').delete().eq('nota_envio_id', id)
  if (eDel) return { error: eDel.message }
  const err = await guardarLineas(id, n.lineas)
  return err ? { error: err } : {}
}

async function guardarLineas(notaId: number, lineas: LineaNota[]): Promise<string | null> {
  const filas = lineas
    .filter((l) => l.cantidad > 0 && l.descripcion.trim() !== '')
    .map((l) => ({
      nota_envio_id: notaId,
      elemento_id: l.elementoId,
      descripcion: l.descripcion.trim(),
      cantidad: l.cantidad,
    }))
  if (!filas.length) return null
  const { error } = await supabase.from('notas_envio_items').insert(filas)
  return error ? error.message : null
}

// ── Editar / borrar una nota ya cargada ─────────────────────────────────────

export type NotaParaEditar = {
  id: number
  proyectoId: number | null
  empresaId: number
  numero: string
  esExterna: boolean
  fecha: string
  pedidoNro: string
  observaciones: string
  numeroImpresoDigitos: string
  cliente: { nombre: string; razonSocial: string; cuit: string; contacto: string; direccion: string }
  lineas: LineaNota[]
  cerrada: boolean // cerrada por un remito → no editable
}

// ¿Algún remito referencia esta nota? (si sí, está "cerrada").
async function notaEstaCerrada(notaId: number): Promise<boolean> {
  const { data } = await supabase
    .from('remitos_items')
    .select('id')
    .eq('nota_envio_id', notaId)
    .limit(1)
  return (data ?? []).length > 0
}

export async function cargarNotaParaEditar(notaId: number): Promise<NotaParaEditar> {
  const { data, error } = await supabase
    .from('notas_envio')
    .select(
      'id, proyecto_id, empresa_id, numero, es_externa, fecha, pedido_nro, observaciones, numero_impreso, cliente_nombre, cliente_razon_social, cliente_cuit, cliente_contacto, cliente_direccion, items:notas_envio_items ( elemento_id, descripcion, cantidad )',
    )
    .eq('id', notaId)
    .single()
  if (error) throw new Error(error.message)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const n = data as any
  return {
    id: n.id,
    proyectoId: n.proyecto_id ?? null,
    empresaId: n.empresa_id,
    numero: n.numero ?? '',
    esExterna: !!n.es_externa,
    fecha: n.fecha ?? '',
    pedidoNro: n.pedido_nro ?? '',
    observaciones: n.observaciones ?? '',
    // El número impreso se guarda como prefijo + 4 dígitos: recuperamos los 4.
    numeroImpresoDigitos: n.numero_impreso ? String(n.numero_impreso).slice(-4) : '',
    cliente: {
      nombre: n.cliente_nombre ?? '',
      razonSocial: n.cliente_razon_social ?? '',
      cuit: n.cliente_cuit ?? '',
      contacto: n.cliente_contacto ?? '',
      direccion: n.cliente_direccion ?? '',
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    lineas: ((n.items ?? []) as any[]).map((it) => ({
      elementoId: it.elemento_id ?? null,
      descripcion: it.descripcion ?? '',
      cantidad: Number(it.cantidad ?? 0),
    })),
    cerrada: await notaEstaCerrada(notaId),
  }
}

export async function eliminarNotaEnvio(notaId: number): Promise<{ error?: string }> {
  // Borrar una nota cerrada por un remito desvincularía los ítems de ese remito
  // (FK set null) y esas unidades pasarían a contar doble. Se bloquea.
  if (await notaEstaCerrada(notaId)) {
    return { error: 'La nota ya fue cerrada por un remito; no se puede borrar.' }
  }
  const { error } = await supabase.from('notas_envio').delete().eq('id', notaId)
  return error ? { error: error.message } : {}
}
