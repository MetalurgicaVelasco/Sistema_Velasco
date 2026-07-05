// features/tablero/motor/duraciones.ts
// -----------------------------------------------------------------------------
// Cuánto ocupa un proceso, en minutos. Dos ocupaciones distintas:
//   - la MÁQUINA: todo el bloque (setup + cantidad×operación + margen).
//   - el OPERARIO: depende del modo (solo el setup en auto/semi; todo en manual).
//
// Funciones puras: reciben los números ya resueltos, no leen la base ni globals.
// -----------------------------------------------------------------------------

import type { ModoProceso } from '../../produccion/procesoTipos'
import type { ProcesoTablero } from '../tipos'
import { reglaDe } from './modos'

// Los números que definen el tamaño de un bloque.
export type Tiempos = {
  setupMin: number
  operacionMin: number
  margenMin: number
  cantidad: number
  modo: ModoProceso
}

// Ocupación de la MÁQUINA: setup + cantidad×operación + margen.
export function duracionMaquina(t: Tiempos): number {
  const cant = t.cantidad > 0 ? t.cantidad : 1
  return t.setupMin + cant * t.operacionMin + t.margenMin
}

// Ocupación del OPERARIO: solo el setup si el modo lo libera tras el setup
// (auto/semi), o todo el bloque si es manual.
export function duracionOperario(t: Tiempos): number {
  return reglaDe(t.modo).operarioSoloSetup ? t.setupMin : duracionMaquina(t)
}

// Los tiempos que valen para el tablero: los que el planificador ACEPTÓ
// (plan_aceptado). Si todavía no hay snapshot (proceso recién planificado), usa
// los valores actuales del proceso con la cantidad del elemento. Así el bloque
// no cambia de tamaño solo porque Oficina Técnica editó algo: recién cambia
// cuando el planificador aplica el cambio (y con eso se actualiza el snapshot).
export function tiemposDe(p: ProcesoTablero, cantidadElemento: number): Tiempos {
  if (p.planAceptado) {
    return {
      setupMin: p.planAceptado.setupMin,
      operacionMin: p.planAceptado.operacionMin,
      margenMin: p.planAceptado.margenMin,
      cantidad: p.planAceptado.cantidad,
      modo: p.planAceptado.modo,
    }
  }
  return {
    setupMin: p.setupMin,
    operacionMin: p.operacionMin,
    margenMin: p.margenMin,
    cantidad: cantidadElemento > 0 ? cantidadElemento : 1,
    modo: p.modo,
  }
}
