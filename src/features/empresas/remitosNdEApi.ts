import { supabase } from '../../shared/lib/supabaseClient'

// -----------------------------------------------------------------------------
// Documentos de envío de una empresa: notas de envío + remitos, en una sola
// lista para la solapa "Remitos y NdE".
//
// Recordatorio de la dinámica (NEGOCIO): la cantidad remitida es DERIVADA, no un
// estado del elemento. Suman las notas de envío y los remitos DIRECTOS; un
// remito que cierra una nota no vuelve a sumar (la nota ya contó esas unidades).
// -----------------------------------------------------------------------------

export type DocumentoEnvio = {
  clave: string // 'ne:12' | 'rm:5' — único entre ambos tipos
  tipo: 'Nota de envío' | 'Remito'
  numero: string
  fecha: string | null
  responsable: string | null
  proyecto: string | null
  pedido: string | null
  estado: string
  origen: string
}

// Fecha ISO → dd/mm/aaaa (sin depender de otro módulo).
function fmtFecha(iso: string | null): string | null {
  if (!iso) return null
  const [a, m, d] = iso.split('-')
  return d && m && a ? `${d}/${m}/${a}` : iso
}

// Supabase tipa las relaciones to-one como array; en runtime viene objeto.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function uno(v: any) {
  return Array.isArray(v) ? v[0] : v
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function etiquetaProyecto(p: any): string | null {
  const pr = uno(p)
  if (!pr) return null
  return `#${pr.id} — ${pr.descripcion ?? ''}`.trim()
}

export async function cargarDocumentosEnvio(empresaId: number): Promise<DocumentoEnvio[]> {
  const selProyecto = 'proyecto:proyectos!proyecto_id ( id, descripcion, pedido_nro )'

  const [notasRes, remitosRes] = await Promise.all([
    supabase
      .from('notas_envio')
      .select(
        `id, numero, numero_impreso, fecha, es_externa, pedido_nro, creado_por_nombre, ${selProyecto}`,
      )
      .eq('empresa_id', empresaId),
    supabase
      .from('remitos')
      .select(`id, numero, fecha, tipo, creado_por_nombre, ${selProyecto}`)
      .eq('empresa_id', empresaId),
  ])
  if (notasRes.error) throw new Error(notasRes.error.message)
  if (remitosRes.error) throw new Error(remitosRes.error.message)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const notas = (notasRes.data ?? []) as any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const remitos = (remitosRes.data ?? []) as any[]

  // Vínculos nota ↔ remito: sirven para saber qué nota ya está cerrada y, del
  // otro lado, qué notas cierra cada remito.
  const notaCerradaPor = new Map<number, string>() // nota id → nº de remito
  const notasDeRemito = new Map<number, string[]>() // remito id → nº de notas
  const remitoIds = remitos.map((r) => r.id as number)
  if (remitoIds.length) {
    const { data, error } = await supabase
      .from('remitos_items')
      .select('remito_id, nota_envio_id, nota:notas_envio!nota_envio_id ( numero ), remito:remitos!remito_id ( numero )')
      .in('remito_id', remitoIds)
      .not('nota_envio_id', 'is', null)
    if (error) throw new Error(error.message)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const r of (data ?? []) as any[]) {
      const numRemito = uno(r.remito)?.numero ?? ''
      const numNota = uno(r.nota)?.numero ?? ''
      if (r.nota_envio_id != null) notaCerradaPor.set(r.nota_envio_id, numRemito)
      const acc = notasDeRemito.get(r.remito_id) ?? []
      if (numNota && !acc.includes(numNota)) acc.push(numNota)
      notasDeRemito.set(r.remito_id, acc)
    }
  }

  const docs: DocumentoEnvio[] = []

  for (const n of notas) {
    const cerrada = notaCerradaPor.get(n.id)
    docs.push({
      clave: 'ne:' + n.id,
      tipo: 'Nota de envío',
      numero: n.numero ?? '',
      fecha: n.fecha ?? null,
      responsable: n.creado_por_nombre ?? null,
      proyecto: etiquetaProyecto(n.proyecto),
      pedido: n.pedido_nro ?? uno(n.proyecto)?.pedido_nro ?? null,
      estado: cerrada ? `Cerrada por remito ${cerrada}` : 'Pendiente de remito',
      origen: n.es_externa
        ? 'Externa (Word)' + (n.numero_impreso ? ` · Nº ${n.numero_impreso}` : '')
        : 'Generada en el sistema',
    })
  }

  for (const r of remitos) {
    const cierra = notasDeRemito.get(r.id) ?? []
    docs.push({
      clave: 'rm:' + r.id,
      tipo: 'Remito',
      numero: r.numero ?? '',
      fecha: r.fecha ?? null,
      responsable: r.creado_por_nombre ?? null,
      proyecto: etiquetaProyecto(r.proyecto),
      pedido: uno(r.proyecto)?.pedido_nro ?? null,
      estado:
        r.tipo === 'nota'
          ? cierra.length
            ? `Cierra nota ${cierra.join(', ')}`
            : 'Cierra nota de envío'
          : 'Directo',
      origen: 'TacticaSoft',
    })
  }

  // Más nuevos arriba (por fecha; a igual fecha, por número).
  docs.sort((a, b) => (b.fecha ?? '').localeCompare(a.fecha ?? '') || b.numero.localeCompare(a.numero))
  return docs
}

export { fmtFecha }
