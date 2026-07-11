import { supabase } from '../../shared/lib/supabaseClient'
import { cargarTodos, type ElementoMatriz } from './matrizApi'

// -----------------------------------------------------------------------------
// Catálogo importable: TODO el catálogo de matriz aplanado, con las facetas
// precalculadas para el modal de importación (buscar/filtrar cualquier nodo).
//
// Por cada elemento resolvemos:
//  - clientes/sectores/equipos EFECTIVOS: los de su ubicación propia + los que
//    hereda de sus contenedores (los componentes suelen no tener ubicación propia).
//  - conjuntos/subconjuntos que lo CONTIENEN (subiendo por la composición).
// -----------------------------------------------------------------------------

export type ItemCatalogo = {
  id: number
  tipo: string
  descripcion: string
  codigoCliente: string | null
  clientes: string[]
  sectores: string[]
  equipos: string[]
  conjuntos: string[]
  subconjuntos: string[]
}

export type FacetasCatalogo = {
  clientes: string[]
  sectores: string[]
  equipos: string[]
  conjuntos: string[]
  subconjuntos: string[]
}

type Ubic = { cliente: string; sector: string; equipo: string }

export async function cargarCatalogoImportable(): Promise<{
  items: ItemCatalogo[]
  facetas: FacetasCatalogo
}> {
  const [elementos, ubicRows, compRows] = await Promise.all([
    cargarTodos(),
    supabase
      .from('elementos_matriz_ubicaciones')
      .select(
        'elemento_id, equipo:equipos!equipo_id ( nombre, sector:sectores!sector_id ( nombre, empresa:empresas!empresa_id ( nombre ) ) )',
      ),
    supabase.from('composicion_matriz').select('padre_id, hijo_id'),
  ])

  const porId = new Map<number, ElementoMatriz>()
  for (const e of elementos) porId.set(e.id, e)

  // Ubicación PROPIA por elemento.
  const ubicPropia = new Map<number, Ubic[]>()
  for (const r of (ubicRows.data ?? []) as any[]) {
    const eq = r.equipo
    if (!eq) continue
    const u: Ubic = {
      cliente: eq.sector?.empresa?.nombre ?? '',
      sector: eq.sector?.nombre ?? '',
      equipo: eq.nombre ?? '',
    }
    const arr = ubicPropia.get(r.elemento_id) ?? []
    arr.push(u)
    ubicPropia.set(r.elemento_id, arr)
  }

  // Grafo de composición: hijos por padre, padres por hijo.
  const hijosDe = new Map<number, number[]>()
  const padresDe = new Map<number, number[]>()
  for (const r of (compRows.data ?? []) as any[]) {
    ;(hijosDe.get(r.padre_id) ?? hijosDe.set(r.padre_id, []).get(r.padre_id)!).push(r.hijo_id)
    ;(padresDe.get(r.hijo_id) ?? padresDe.set(r.hijo_id, []).get(r.hijo_id)!).push(r.padre_id)
  }

  // Ubicación EFECTIVA (propia + heredada de contenedores, subiendo por padres).
  const memoUbic = new Map<number, Ubic[]>()
  function ubicEfectiva(id: number, visto: Set<number>): Ubic[] {
    if (memoUbic.has(id)) return memoUbic.get(id)!
    if (visto.has(id)) return ubicPropia.get(id) ?? []
    visto.add(id)
    const acc: Ubic[] = [...(ubicPropia.get(id) ?? [])]
    for (const p of padresDe.get(id) ?? []) acc.push(...ubicEfectiva(p, visto))
    memoUbic.set(id, acc)
    return acc
  }

  // Conjuntos/subconjuntos que contienen a un elemento (subiendo por padres).
  function contenedores(id: number): { conjuntos: Set<string>; subconjuntos: Set<string> } {
    const conjuntos = new Set<string>()
    const subconjuntos = new Set<string>()
    const visto = new Set<number>()
    const pila = [...(padresDe.get(id) ?? [])]
    while (pila.length) {
      const pid = pila.pop() as number
      if (visto.has(pid)) continue
      visto.add(pid)
      const el = porId.get(pid)
      if (el) {
        if (el.tipo === 'conjunto') conjuntos.add(el.descripcion)
        else if (el.tipo === 'subconjunto') subconjuntos.add(el.descripcion)
      }
      for (const pp of padresDe.get(pid) ?? []) pila.push(pp)
    }
    return { conjuntos, subconjuntos }
  }

  const items: ItemCatalogo[] = elementos.map((e) => {
    const ubics = ubicEfectiva(e.id, new Set())
    const cont = contenedores(e.id)
    return {
      id: e.id,
      tipo: e.tipo,
      descripcion: e.descripcion,
      codigoCliente: e.codigo_cliente,
      clientes: [...new Set(ubics.map((u) => u.cliente).filter(Boolean))],
      sectores: [...new Set(ubics.map((u) => u.sector).filter(Boolean))],
      equipos: [...new Set(ubics.map((u) => u.equipo).filter(Boolean))],
      conjuntos: [...cont.conjuntos],
      subconjuntos: [...cont.subconjuntos],
    }
  })

  const facetas: FacetasCatalogo = {
    clientes: distinto(items.flatMap((i) => i.clientes)),
    sectores: distinto(items.flatMap((i) => i.sectores)),
    equipos: distinto(items.flatMap((i) => i.equipos)),
    conjuntos: distinto(items.filter((i) => i.tipo === 'conjunto').map((i) => i.descripcion)),
    subconjuntos: distinto(items.filter((i) => i.tipo === 'subconjunto').map((i) => i.descripcion)),
  }

  return { items, facetas }
}

function distinto(xs: string[]): string[] {
  return [...new Set(xs.filter(Boolean))].sort((a, b) => a.localeCompare(b))
}
