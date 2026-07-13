import { supabase } from '../../shared/lib/supabaseClient'
import { cargarTodos, type ElementoMatriz } from './matrizApi'

// -----------------------------------------------------------------------------
// Catálogo importable: TODO el catálogo de matriz aplanado, con facetas y datos
// de orden precalculados para el modal de importación.
// -----------------------------------------------------------------------------

export type ItemCatalogo = {
  id: number
  tipo: string
  descripcion: string
  codigoCliente: string | null
  presentacion: string | null
  createdAt: string | null
  cantProcesos: number
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

// Expande un conjunto/subconjunto a sus componentes hoja, con la cantidad total
// (multiplica por la composición). Sirve para el resumen del modal.
export type ExpandirFn = (rootId: number, mult: number) => { descripcion: string; cantidad: number }[]

type Ubic = { cliente: string; sector: string; equipo: string }

export async function cargarCatalogoImportable(): Promise<{
  items: ItemCatalogo[]
  facetas: FacetasCatalogo
  expandir: ExpandirFn
}> {
  const [elementos, ubicRows, compRows, metaRows, procRows] = await Promise.all([
    cargarTodos(),
    supabase
      .from('elementos_matriz_ubicaciones')
      .select(
        'elemento_matriz_id, equipo:equipos!equipo_id ( nombre, sector:sectores!sector_id ( nombre, empresa:empresas!empresa_id ( nombre ) ) )',
      ),
    supabase.from('composicion_matriz').select('padre_id, hijo_id, cantidad'),
    supabase.from('elementos_matriz').select('id, created_at'),
    supabase.from('procesos_matriz').select('elemento_id'),
  ])

  const porId = new Map<number, ElementoMatriz>()
  for (const e of elementos) porId.set(e.id, e)

  const createdPorId = new Map<number, string | null>()
  for (const r of (metaRows.data ?? []) as any[]) createdPorId.set(r.id, r.created_at ?? null)

  const procPorId = new Map<number, number>()
  for (const r of (procRows.data ?? []) as any[]) {
    procPorId.set(r.elemento_id, (procPorId.get(r.elemento_id) ?? 0) + 1)
  }

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
    const arr = ubicPropia.get(r.elemento_matriz_id) ?? []
    arr.push(u)
    ubicPropia.set(r.elemento_matriz_id, arr)
  }

  // Grafo de composición (con cantidad).
  const hijosDe = new Map<number, { hijoId: number; cantidad: number }[]>()
  const padresDe = new Map<number, number[]>()
  for (const r of (compRows.data ?? []) as any[]) {
    const a = hijosDe.get(r.padre_id) ?? []
    a.push({ hijoId: r.hijo_id, cantidad: Number(r.cantidad ?? 1) })
    hijosDe.set(r.padre_id, a)
    const b = padresDe.get(r.hijo_id) ?? []
    b.push(r.padre_id)
    padresDe.set(r.hijo_id, b)
  }

  // Ubicación EFECTIVA (propia + heredada de contenedores).
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
      presentacion: e.presentacion_mat_prima,
      createdAt: createdPorId.get(e.id) ?? null,
      cantProcesos: procPorId.get(e.id) ?? 0,
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

  // Expansión a componentes hoja (para el resumen del conjunto).
  const expandir: ExpandirFn = (rootId, mult) => {
    const acc = new Map<number, number>()
    const rec = (id: number, factor: number, visto: Set<number>) => {
      const hijos = hijosDe.get(id) ?? []
      if (!hijos.length) {
        acc.set(id, (acc.get(id) ?? 0) + factor)
        return
      }
      if (visto.has(id)) return
      const v = new Set(visto).add(id)
      for (const h of hijos) rec(h.hijoId, factor * h.cantidad, v)
    }
    rec(rootId, mult, new Set())
    return [...acc.entries()].map(([id, cant]) => ({
      descripcion: porId.get(id)?.descripcion ?? '?',
      cantidad: cant,
    }))
  }

  return { items, facetas, expandir }
}

function distinto(xs: string[]): string[] {
  return [...new Set(xs.filter(Boolean))].sort((a, b) => a.localeCompare(b))
}
