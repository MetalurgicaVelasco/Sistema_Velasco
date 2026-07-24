import { supabase } from '../../shared/lib/supabaseClient'

// -----------------------------------------------------------------------------
// Cantidad REMITIDA por elemento dentro de un proyecto.
//
// Regla del negocio: lo remitido NO es un estado guardado en el elemento, es una
// cantidad DERIVADA. Suman las notas de envío y los remitos DIRECTOS; un remito
// que cierra una nota de envío NO vuelve a sumar, porque esas unidades ya las
// contó la nota (si no, se contarían dos veces).
// -----------------------------------------------------------------------------

export async function cargarRemitidoPorProyecto(
  proyectoId: number,
): Promise<Record<number, number>> {
  const [notas, remitos] = await Promise.all([
    supabase
      .from('notas_envio_items')
      .select('elemento_id, cantidad, nota:notas_envio!inner ( proyecto_id )')
      .eq('nota.proyecto_id', proyectoId),
    supabase
      .from('remitos_items')
      .select('elemento_id, cantidad, remito:remitos!inner ( proyecto_id )')
      .eq('remito.proyecto_id', proyectoId)
      .is('nota_envio_id', null), // solo los directos
  ])
  if (notas.error) throw new Error(notas.error.message)
  if (remitos.error) throw new Error(remitos.error.message)

  const acc: Record<number, number> = {}
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const f of [...(notas.data ?? []), ...(remitos.data ?? [])] as any[]) {
    if (f.elemento_id == null) continue
    acc[f.elemento_id] = (acc[f.elemento_id] ?? 0) + Number(f.cantidad ?? 0)
  }
  return acc
}
