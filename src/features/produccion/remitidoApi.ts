import { supabase } from '../../shared/lib/supabaseClient'

// -----------------------------------------------------------------------------
// Cantidad REMITIDA por elemento dentro de un proyecto.
//
// Regla del negocio: lo remitido NO es un estado guardado en el elemento, es una
// cantidad DERIVADA. Suman las notas de envío y los remitos DIRECTOS; un remito
// que cierra una nota de envío NO vuelve a sumar, porque esas unidades ya las
// contó la nota (si no, se contarían dos veces).
// -----------------------------------------------------------------------------

// Detalle de lo remitido, separando qué parte vino por remito DIRECTO: un
// elemento ya cubierto por un remito directo no puede volver a mandarse en una
// nota de envío. `excluirNotaId` sirve al editar una nota (no se cuenta a sí
// misma).
export async function cargarDetalleRemitido(
  proyectoId: number,
  excluirNotaId?: number,
): Promise<{ total: Record<number, number>; porRemitoDirecto: Record<number, number> }> {
  let qNotas = supabase
    .from('notas_envio_items')
    .select('elemento_id, cantidad, nota:notas_envio!inner ( proyecto_id )')
    .eq('nota.proyecto_id', proyectoId)
  if (excluirNotaId != null) qNotas = qNotas.neq('nota_envio_id', excluirNotaId)

  const [notas, remitos] = await Promise.all([
    qNotas,
    supabase
      .from('remitos_items')
      .select('elemento_id, cantidad, remito:remitos!inner ( proyecto_id )')
      .eq('remito.proyecto_id', proyectoId)
      .is('nota_envio_id', null), // solo los directos
  ])
  if (notas.error) throw new Error(notas.error.message)
  if (remitos.error) throw new Error(remitos.error.message)

  const total: Record<number, number> = {}
  const porRemitoDirecto: Record<number, number> = {}
  const sumar = (acc: Record<number, number>, id: number, cant: number) => {
    acc[id] = (acc[id] ?? 0) + cant
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const f of (notas.data ?? []) as any[]) {
    if (f.elemento_id == null) continue
    sumar(total, f.elemento_id, Number(f.cantidad ?? 0))
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const f of (remitos.data ?? []) as any[]) {
    if (f.elemento_id == null) continue
    sumar(total, f.elemento_id, Number(f.cantidad ?? 0))
    sumar(porRemitoDirecto, f.elemento_id, Number(f.cantidad ?? 0))
  }
  return { total, porRemitoDirecto }
}

export async function cargarRemitidoPorProyecto(
  proyectoId: number,
): Promise<Record<number, number>> {
  return (await cargarDetalleRemitido(proyectoId)).total
}
