// features/produccion/matrizApi.ts
// -----------------------------------------------------------------------------
// Capa de datos de la Matriz de Productos: el catálogo de piezas fabricables.
//
// Modelo (distinto al de Proyectos, a propósito):
//   - `elementos_matriz`: la PIEZA en sí, reutilizable. No tiene padre ni cantidad.
//   - `composicion_matriz` (padre, hijo, cantidad): de qué está hecho un conjunto.
//     Un mismo hijo participa en VARIOS padres, con cantidades distintas: el
//     "Manguito Ø50" puede ir 4 veces en un conjunto y 1 vez en otro.
//   - `elementos_matriz_ubicaciones` (elemento, equipo): dónde se INSTALA. Son las
//     ubicaciones PROPIAS; un elemento sin ubicación propia hereda las de sus padres.
//
// Es un grafo, no un árbol: por eso no reusa el DominioElemento de Proyectos.
// -----------------------------------------------------------------------------

import { supabase } from '../../shared/lib/supabaseClient'

/* eslint-disable @typescript-eslint/no-explicit-any */

// Una pieza del catálogo.
export type ElementoMatriz = {
  id: number
  tipo: string // conjunto | subconjunto | componente
  descripcion: string
  material_id: number | null
  presentacion_mat_prima: string | null
  codigo_cliente: string | null
  foto_url: string | null
  es_dispositivo: boolean
  activo: boolean
}

// Un hijo dentro de un conjunto: la pieza + cuántas van.
export type HijoComposicion = ElementoMatriz & { cantidad: number; composicionId: number }

export type EquipoNodo = {
  id: number
  nombre: string
  esGeneral: boolean
  elementos: ElementoMatriz[] // los ubicados acá (ubicación propia)
}
export type SectorNodo = {
  id: number
  nombre: string
  esGeneral: boolean
  equipos: EquipoNodo[]
}
export type ClienteNodo = {
  id: number
  nombre: string
  codigo: string | null
  fotoUrl: string | null
  sectores: SectorNodo[]
  totalElementos: number
}

const COLS =
  'id, tipo, descripcion, material_id, presentacion_mat_prima, codigo_cliente, ' +
  'foto_url, es_dispositivo, activo'

// ── Lectura ────────────────────────────────────────────────────────────────

// El catálogo agrupado por dónde se instala: Cliente → Sector → Equipo → piezas.
// Solo aparecen los clientes/sectores/equipos que tienen algo ubicado.
export async function cargarMatriz(): Promise<ClienteNodo[]> {
  const { data, error } = await supabase.from('elementos_matriz_ubicaciones').select(
    `elemento:elementos_matriz!elemento_matriz_id ( ${COLS} ),
     equipo:equipos!equipo_id (
       id, nombre, es_general,
       sector:sectores!sector_id (
         id, nombre, es_general,
         empresa:empresas!empresa_id ( id, nombre, codigo, foto_url )
       )
     )`,
  )
  if (error) throw new Error(error.message)

  const clientes = new Map<number, ClienteNodo>()
  for (const fila of (data ?? []) as any[]) {
    const el = fila.elemento
    const eq = fila.equipo
    const sec = eq?.sector
    const emp = sec?.empresa
    if (!el || !eq || !sec || !emp || el.activo === false) continue

    let cliente = clientes.get(emp.id)
    if (!cliente) {
      cliente = {
        id: emp.id,
        nombre: emp.nombre,
        codigo: emp.codigo ?? null,
        fotoUrl: emp.foto_url ?? null,
        sectores: [],
        totalElementos: 0,
      }
      clientes.set(emp.id, cliente)
    }
    let sector = cliente.sectores.find((s) => s.id === sec.id)
    if (!sector) {
      sector = { id: sec.id, nombre: sec.nombre, esGeneral: sec.es_general, equipos: [] }
      cliente.sectores.push(sector)
    }
    let equipo = sector.equipos.find((e) => e.id === eq.id)
    if (!equipo) {
      equipo = { id: eq.id, nombre: eq.nombre, esGeneral: eq.es_general, elementos: [] }
      sector.equipos.push(equipo)
    }
    equipo.elementos.push(el as ElementoMatriz)
    cliente.totalElementos += 1
  }

  const porNombre = <T extends { nombre: string }>(a: T, b: T) => a.nombre.localeCompare(b.nombre)
  const porGeneral = <T extends { nombre: string; esGeneral: boolean }>(a: T, b: T) =>
    Number(b.esGeneral) - Number(a.esGeneral) || porNombre(a, b)

  const lista = [...clientes.values()].sort(porNombre)
  for (const c of lista) {
    c.sectores.sort(porGeneral)
    for (const s of c.sectores) {
      s.equipos.sort(porGeneral)
      for (const e of s.equipos) e.elementos.sort((a, b) => a.descripcion.localeCompare(b.descripcion))
    }
  }
  return lista
}

// Los hijos de un conjunto, con su cantidad.
export async function cargarComposicion(padreId: number): Promise<HijoComposicion[]> {
  const { data, error } = await supabase
    .from('composicion_matriz')
    .select(`id, cantidad, hijo:elementos_matriz!hijo_id ( ${COLS} )`)
    .eq('padre_id', padreId)
  if (error) throw new Error(error.message)
  return ((data ?? []) as any[])
    .filter((r) => r.hijo)
    .map((r) => ({ ...(r.hijo as ElementoMatriz), cantidad: Number(r.cantidad), composicionId: r.id }))
    .sort((a, b) => a.descripcion.localeCompare(b.descripcion))
}

// Todo el catálogo (para el buscador de "agregar elemento existente").
export async function cargarTodos(): Promise<ElementoMatriz[]> {
  const { data, error } = await supabase.from('elementos_matriz').select(COLS).eq('activo', true).order('descripcion')
  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as ElementoMatriz[]
}

// Los padres directos de un elemento (para saber si está en uso y heredar ubicación).
export async function cargarPadres(hijoId: number): Promise<number[]> {
  const { data, error } = await supabase.from('composicion_matriz').select('padre_id').eq('hijo_id', hijoId)
  if (error) throw new Error(error.message)
  return (data ?? []).map((r) => r.padre_id as number)
}

// ── Ubicaciones ────────────────────────────────────────────────────────────

// Ubicaciones PROPIAS de un elemento (los equipos donde está instalado).
export async function cargarUbicaciones(elementoId: number): Promise<number[]> {
  const { data, error } = await supabase
    .from('elementos_matriz_ubicaciones')
    .select('equipo_id')
    .eq('elemento_matriz_id', elementoId)
  if (error) throw new Error(error.message)
  return (data ?? []).map((r) => r.equipo_id as number)
}

// Ubicaciones EFECTIVAS: las propias; si no tiene, las heredadas de sus padres
// (subiendo por la composición). Así todo elemento tiene una ubicación conocida.
export async function ubicacionesEfectivas(elementoId: number, vistos = new Set<number>()): Promise<number[]> {
  if (vistos.has(elementoId)) return [] // corta ciclos
  vistos.add(elementoId)
  const propias = await cargarUbicaciones(elementoId)
  if (propias.length) return propias
  const padres = await cargarPadres(elementoId)
  const heredadas: number[] = []
  for (const p of padres) heredadas.push(...(await ubicacionesEfectivas(p, vistos)))
  return [...new Set(heredadas)]
}

// Reemplaza las ubicaciones propias de un elemento por la lista dada.
export async function guardarUbicaciones(elementoId: number, equipoIds: number[]): Promise<void> {
  const { error: eDel } = await supabase
    .from('elementos_matriz_ubicaciones')
    .delete()
    .eq('elemento_matriz_id', elementoId)
  if (eDel) throw new Error(eDel.message)
  if (!equipoIds.length) return // sin ubicación propia: hereda de sus padres
  const filas = equipoIds.map((equipo_id) => ({ elemento_matriz_id: elementoId, equipo_id }))
  const { error } = await supabase.from('elementos_matriz_ubicaciones').insert(filas)
  if (error) throw new Error(error.message)
}

// ── Escritura del catálogo ─────────────────────────────────────────────────

export type ElementoMatrizInput = {
  tipo: string
  descripcion: string
  materialId: number | null
  presentacionMatPrima: string | null
  codigoCliente: string | null
  esDispositivo: boolean
  fotoUrl: string | null
}

function payload(i: ElementoMatrizInput) {
  return {
    tipo: i.tipo,
    descripcion: i.descripcion.trim(),
    material_id: i.materialId,
    presentacion_mat_prima: i.presentacionMatPrima?.trim() || null,
    codigo_cliente: i.codigoCliente?.trim() || null,
    es_dispositivo: i.esDispositivo,
    foto_url: i.fotoUrl,
  }
}

export async function crearElementoMatriz(i: ElementoMatrizInput): Promise<number> {
  const { data, error } = await supabase.from('elementos_matriz').insert(payload(i)).select('id').single()
  if (error) throw new Error(error.message)
  return data.id as number
}

export async function actualizarElementoMatriz(id: number, i: ElementoMatrizInput): Promise<void> {
  const { error } = await supabase.from('elementos_matriz').update(payload(i)).eq('id', id)
  if (error) throw new Error(error.message)
}

// Baja lógica: la pieza deja de aparecer, pero no se pierde el historial.
export async function desactivarElementoMatriz(id: number): Promise<void> {
  const { error } = await supabase.from('elementos_matriz').update({ activo: false }).eq('id', id)
  if (error) throw new Error(error.message)
}

// ── Composición ────────────────────────────────────────────────────────────

// Agrega un hijo a un conjunto (o cambia su cantidad si ya estaba).
export async function agregarHijo(padreId: number, hijoId: number, cantidad: number): Promise<void> {
  if (padreId === hijoId) throw new Error('Un elemento no puede contenerse a sí mismo.')
  if (cantidad <= 0) throw new Error('La cantidad debe ser mayor a cero.')
  const { error } = await supabase
    .from('composicion_matriz')
    .upsert({ padre_id: padreId, hijo_id: hijoId, cantidad }, { onConflict: 'padre_id,hijo_id' })
  if (error) throw new Error(error.message)
}

export async function cambiarCantidad(composicionId: number, cantidad: number): Promise<void> {
  if (cantidad <= 0) throw new Error('La cantidad debe ser mayor a cero.')
  const { error } = await supabase.from('composicion_matriz').update({ cantidad }).eq('id', composicionId)
  if (error) throw new Error(error.message)
}

// Saca un hijo de un conjunto (la pieza sigue existiendo en el catálogo).
export async function quitarHijo(composicionId: number): Promise<void> {
  const { error } = await supabase.from('composicion_matriz').delete().eq('id', composicionId)
  if (error) throw new Error(error.message)
}

// Ruta legible de una ubicación: "Cliente › Sector › Equipo". Sirve para el
// breadcrumb de la vista de elemento y para los chips del selector.
export type RutaUbicacion = {
  equipoId: number
  clienteId: number
  clienteNombre: string
  sectorNombre: string
  equipoNombre: string
  texto: string
}

export async function cargarRutas(equipoIds: number[]): Promise<RutaUbicacion[]> {
  if (!equipoIds.length) return []
  const { data, error } = await supabase
    .from('equipos')
    .select('id, nombre, sector:sectores!sector_id ( nombre, empresa:empresas!empresa_id ( id, nombre ) )')
    .in('id', equipoIds)
  if (error) throw new Error(error.message)
  return ((data ?? []) as any[])
    .filter((r) => r.sector?.empresa)
    .map((r) => ({
      equipoId: r.id,
      clienteId: r.sector.empresa.id,
      clienteNombre: r.sector.empresa.nombre,
      sectorNombre: r.sector.nombre,
      equipoNombre: r.nombre,
      texto: `${r.sector.empresa.nombre} › ${r.sector.nombre} › ${r.nombre}`,
    }))
}

// Un elemento del catálogo por id (para entrar a su vista).
export async function cargarElementoMatriz(id: number): Promise<ElementoMatriz | null> {
  const { data, error } = await supabase.from('elementos_matriz').select(COLS).eq('id', id).maybeSingle()
  if (error) throw new Error(error.message)
  return (data as unknown as ElementoMatriz) ?? null
}
