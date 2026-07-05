// features/tablero/motor/divergencias.ts
// -----------------------------------------------------------------------------
// Detecta si Oficina Técnica cambió, desde Proyectos, algo que el planificador
// había aceptado. Compara los valores ACTUALES del proceso contra el snapshot
// `plan_aceptado`. Cada campo distinto es una divergencia (el ⚠ amarillo).
//
// Si el proceso todavía no tiene snapshot (nunca fue aceptado), no hay
// divergencia: no hay contra qué comparar.
//
// Por ahora compara los 5 campos que afectan el bloque (setup, operación,
// margen, cantidad, modo). El operario y la máquina sugeridos se agregarán
// cuando se amplíe plan_aceptado (no cambian el tamaño del bloque).
// -----------------------------------------------------------------------------

import type { ModoProceso } from '../../produccion/procesoTipos'
import type { ProcesoTablero } from '../tipos'

export type CampoDivergente = 'setup' | 'operacion' | 'margen' | 'cantidad' | 'modo'

export type Divergencia = {
  campo: CampoDivergente
  aceptado: number | ModoProceso // lo que el planificador aceptó
  actual: number | ModoProceso // lo que hay ahora (desde Proyectos)
}

// Diferencia numérica con tolerancia a errores de punto flotante.
function difNum(a: number, b: number): boolean {
  return Math.abs(a - b) > 1e-6
}

export function divergencias(proceso: ProcesoTablero, cantidadElemento: number): Divergencia[] {
  const ack = proceso.planAceptado
  if (!ack) return []

  const out: Divergencia[] = []
  const cant = cantidadElemento > 0 ? cantidadElemento : 1

  if (difNum(proceso.setupMin, ack.setupMin)) {
    out.push({ campo: 'setup', aceptado: ack.setupMin, actual: proceso.setupMin })
  }
  if (difNum(proceso.operacionMin, ack.operacionMin)) {
    out.push({ campo: 'operacion', aceptado: ack.operacionMin, actual: proceso.operacionMin })
  }
  if (difNum(proceso.margenMin, ack.margenMin)) {
    out.push({ campo: 'margen', aceptado: ack.margenMin, actual: proceso.margenMin })
  }
  if (cant !== ack.cantidad) {
    out.push({ campo: 'cantidad', aceptado: ack.cantidad, actual: cant })
  }
  if (proceso.modo !== ack.modo) {
    out.push({ campo: 'modo', aceptado: ack.modo, actual: proceso.modo })
  }

  return out
}

export function hayDivergencia(proceso: ProcesoTablero, cantidadElemento: number): boolean {
  return divergencias(proceso, cantidadElemento).length > 0
}
