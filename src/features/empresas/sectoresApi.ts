// features/empresas/sectoresApi.ts
// -----------------------------------------------------------------------------
// Capa de datos de la jerarquía de ubicaciones del CLIENTE: Sector → Equipo.
// Es donde se instalan las piezas del catálogo (matriz de productos).
//
// Reglas del negocio que viven acá (única puerta a Supabase para este dominio):
//  - Cada empresa cliente tiene un "Sector General" (es_general).
//  - Cada sector tiene un "Sin equipo específico" (es_general).
//  - Los generales NO se borran ni se renombran: garantizan que siempre haya una
//    ubicación válida.
//  - No se borra un sector con equipos propios (hay que vaciarlo antes).
//  - No se borra un equipo con elementos de catálogo asignados.
// -----------------------------------------------------------------------------

import { supabase } from '../../shared/lib/supabaseClient'

export const NOMBRE_SECTOR_GENERAL = 'Sector General'
export const NOMBRE_EQUIPO_GENERAL = 'Sin equipo específico'

export type Equipo = {
  id: number
  sector_id: number
  nombre: string
  es_general: boolean
}

export type Sector = {
  id: number
  empresa_id: number
  nombre: string
  es_general: boolean
  equipos: Equipo[]
}

// Árbol completo de una empresa: sus sectores, cada uno con sus equipos.
// El sector general va primero; después, alfabético. Igual con los equipos.
export async function cargarSectores(empresaId: number): Promise<Sector[]> {
  const { data: secs, error } = await supabase
    .from('sectores')
    .select('id, empresa_id, nombre, es_general')
    .eq('empresa_id', empresaId)
  if (error) throw new Error(error.message)
  const sectores = (secs ?? []) as Omit<Sector, 'equipos'>[]
  if (!sectores.length) return []

  const { data: eqs, error: e2 } = await supabase
    .from('equipos')
    .select('id, sector_id, nombre, es_general')
    .in(
      'sector_id',
      sectores.map((s) => s.id),
    )
  if (e2) throw new Error(e2.message)
  const equipos = (eqs ?? []) as Equipo[]

  const ordenar = <T extends { nombre: string; es_general: boolean }>(a: T, b: T) =>
    Number(b.es_general) - Number(a.es_general) || a.nombre.localeCompare(b.nombre)

  return sectores
    .map((s) => ({
      ...s,
      equipos: equipos.filter((e) => e.sector_id === s.id).sort(ordenar),
    }))
    .sort(ordenar)
}

// Crea un sector y, con él, su equipo general (así siempre hay dónde ubicar).
export async function crearSector(empresaId: number, nombre: string): Promise<void> {
  const { data, error } = await supabase
    .from('sectores')
    .insert({ empresa_id: empresaId, nombre: nombre.trim(), es_general: false })
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  await crearEquipoGeneral(data.id)
}

// El "Sin equipo específico" de un sector. Se llama al crear cualquier sector.
async function crearEquipoGeneral(sectorId: number): Promise<void> {
  const { error } = await supabase
    .from('equipos')
    .insert({ sector_id: sectorId, nombre: NOMBRE_EQUIPO_GENERAL, es_general: true })
  if (error) throw new Error(error.message)
}

// El "Sector General" de una empresa cliente, con su equipo general adentro.
// Se llama al dar de alta una empresa cliente.
export async function crearSectorGeneral(empresaId: number): Promise<void> {
  const { data, error } = await supabase
    .from('sectores')
    .insert({ empresa_id: empresaId, nombre: NOMBRE_SECTOR_GENERAL, es_general: true })
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  await crearEquipoGeneral(data.id)
}

export async function renombrarSector(id: number, nombre: string): Promise<void> {
  const { error } = await supabase.from('sectores').update({ nombre: nombre.trim() }).eq('id', id)
  if (error) throw new Error(error.message)
}

export async function crearEquipo(sectorId: number, nombre: string): Promise<void> {
  const { error } = await supabase
    .from('equipos')
    .insert({ sector_id: sectorId, nombre: nombre.trim(), es_general: false })
  if (error) throw new Error(error.message)
}

export async function renombrarEquipo(id: number, nombre: string): Promise<void> {
  const { error } = await supabase.from('equipos').update({ nombre: nombre.trim() }).eq('id', id)
  if (error) throw new Error(error.message)
}

// Borra un sector. No se permite si es general, ni si tiene equipos propios
// (los que no son el general): hay que vaciarlo antes.
export async function borrarSector(sector: Sector): Promise<{ error?: string }> {
  if (sector.es_general) {
    return { error: 'El Sector General no se puede borrar.' }
  }
  const propios = sector.equipos.filter((e) => !e.es_general)
  if (propios.length) {
    return {
      error: `Este sector tiene ${propios.length} equipo(s) cargado(s). Borralos antes de borrar el sector.`,
    }
  }
  // Solo queda su equipo general: el cascade se lo lleva.
  const { error } = await supabase.from('sectores').delete().eq('id', sector.id)
  return error ? { error: error.message } : {}
}

// Borra un equipo. No se permite si es general, ni si tiene elementos de
// catálogo ubicados en él.
export async function borrarEquipo(equipo: Equipo): Promise<{ error?: string }> {
  if (equipo.es_general) {
    return { error: 'El equipo "Sin equipo específico" no se puede borrar.' }
  }
  const usos = await contarElementosEnEquipo(equipo.id)
  if (usos > 0) {
    return {
      error: `Este equipo tiene ${usos} elemento(s) del catálogo ubicados. Movelos o borralos antes.`,
    }
  }
  const { error } = await supabase.from('equipos').delete().eq('id', equipo.id)
  return error ? { error: error.message } : {}
}

// Cuántos elementos del catálogo están ubicados en un equipo. La tabla de
// ubicaciones todavía no existe (llega con la matriz): mientras tanto, 0.
async function contarElementosEnEquipo(equipoId: number): Promise<number> {
  const { count, error } = await supabase
    .from('elementos_matriz_ubicaciones')
    .select('equipo_id', { count: 'exact', head: true })
    .eq('equipo_id', equipoId)
  // Si la tabla aún no existe, no bloqueamos el borrado.
  if (error) return 0
  return count ?? 0
}
