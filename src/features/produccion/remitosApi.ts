import { supabase } from '../../shared/lib/supabaseClient'
import { cargarDetalleRemitido } from './remitidoApi'

// -----------------------------------------------------------------------------
// Remitos. El documento válido vive en TacticaSoft: acá se registra el número,
// la fecha y qué cubre.
//
// Dos modos (como en el viejo):
//  - 'nota': cierra una o más notas de envío. Sus líneas NO suman cantidad
//    remitida, porque esas unidades ya las contó la nota.
//  - 'directo': remite sin nota previa. Sus líneas SÍ suman.
// -----------------------------------------------------------------------------

export const PREFIJO_IMPRESO_REMITO = '00001-0000'

export type ItemNotaAbierta = {
  itemId: number
  elementoId: number | null
  descripcion: string
  cantidad: number
}

export type NotaAbierta = {
  notaId: number
  numero: string
  fecha: string | null
  items: ItemNotaAbierta[]
}

// Notas de envío del proyecto que todavía ningún remito cerró.
export async function cargarNotasAbiertas(proyectoId: number): Promise<NotaAbierta[]> {
  const { data: notas, error } = await supabase
    .from('notas_envio')
    .select('id, numero, fecha, items:notas_envio_items ( id, elemento_id, descripcion, cantidad )')
    .eq('proyecto_id', proyectoId)
    .order('id')
  if (error) throw new Error(error.message)

  const { data: cerradas, error: e2 } = await supabase
    .from('remitos_items')
    .select('nota_envio_id')
    .not('nota_envio_id', 'is', null)
  if (e2) throw new Error(e2.message)
  const idsCerradas = new Set((cerradas ?? []).map((r) => r.nota_envio_id as number))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((notas ?? []) as any[])
    .filter((n) => !idsCerradas.has(n.id))
    .map((n) => ({
      notaId: n.id,
      numero: n.numero ?? '',
      fecha: n.fecha ?? null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      items: ((n.items ?? []) as any[]).map((it) => ({
        itemId: it.id,
        elementoId: it.elemento_id ?? null,
        descripcion: it.descripcion ?? '',
        cantidad: Number(it.cantidad ?? 0),
      })),
    }))
    .filter((n) => n.items.length > 0)
}

export type LineaDirecta = {
  elementoId: number
  descripcion: string
  total: number
  yaRemitido: number
  pendiente: number
}

// Elementos raíz con cantidad pendiente de remitir (para el remito directo).
export async function cargarLineasDirectas(proyectoId: number): Promise<LineaDirecta[]> {
  const [{ data, error }, remitido] = await Promise.all([
    supabase
      .from('elementos')
      .select('id, descripcion, cantidad, es_retrabajo, es_dispositivo')
      .eq('proyecto_id', proyectoId)
      .is('parent_elemento_id', null)
      .order('id'),
    cargarDetalleRemitido(proyectoId),
  ])
  if (error) throw new Error(error.message)

  const out: LineaDirecta[] = []
  for (const e of data ?? []) {
    if (e.es_retrabajo || e.es_dispositivo) continue
    const total = Number(e.cantidad ?? 1)
    const yaRemitido = remitido.total[e.id] ?? 0
    out.push({
      elementoId: e.id,
      descripcion: e.descripcion ?? '',
      total,
      yaRemitido,
      pendiente: Math.max(0, total - yaRemitido),
    })
  }
  return out
}

export type LineaRemito = {
  elementoId: number | null
  notaEnvioId: number | null // con valor = cierra esa nota (no suma remitido)
  descripcion: string
  cantidad: number
}

export type DatosRemito = {
  proyectoId: number
  empresaId: number
  numeroDigitos: string // los 4 dígitos del remito de Táctica
  fecha: string
  tipo: 'nota' | 'directo'
  lineas: LineaRemito[]
}

async function usuarioActual(): Promise<{ id: string | null; nombre: string | null }> {
  const { data } = await supabase.auth.getUser()
  const u = data.user
  if (!u) return { id: null, nombre: null }
  const meta = (u.user_metadata ?? {}) as Record<string, unknown>
  const nombre = (meta.nombre as string) || (meta.full_name as string) || u.email || null
  return { id: u.id, nombre }
}

export async function crearRemito(r: DatosRemito): Promise<{ numero?: string; error?: string }> {
  const digitos = r.numeroDigitos.replace(/\D/g, '')
  if (!digitos) return { error: 'Ingresá los últimos 4 dígitos del remito.' }
  const numero = PREFIJO_IMPRESO_REMITO + digitos.padStart(4, '0')

  const usuario = await usuarioActual()
  const { data: remito, error } = await supabase
    .from('remitos')
    .insert({
      numero,
      fecha: r.fecha,
      empresa_id: r.empresaId,
      proyecto_id: r.proyectoId,
      tipo: r.tipo,
      creado_por: usuario.id,
      creado_por_nombre: usuario.nombre,
    })
    .select('id, numero')
    .single()
  if (error) {
    // 23505 = índice único: el número ya existe.
    return { error: error.code === '23505' ? `Ya existe un remito con el número ${numero}.` : error.message }
  }

  const filas = r.lineas
    .filter((l) => l.cantidad > 0 && l.descripcion.trim() !== '')
    .map((l) => ({
      remito_id: remito.id as number,
      elemento_id: l.elementoId,
      nota_envio_id: l.notaEnvioId,
      descripcion: l.descripcion.trim(),
      cantidad: l.cantidad,
    }))
  if (filas.length) {
    const { error: eIt } = await supabase.from('remitos_items').insert(filas)
    if (eIt) return { error: eIt.message }
  }
  return { numero: remito.numero as string }
}
