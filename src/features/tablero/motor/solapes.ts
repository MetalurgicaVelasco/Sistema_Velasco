// features/tablero/motor/solapes.ts
// -----------------------------------------------------------------------------
// La ÚNICA definición de "dos intervalos se pisan". El sistema viejo la tenía
// escrita de tres formas distintas (con gap, sin gap, merge con gap); acá es una
// sola fórmula, con el gap como parámetro (que sale de `configuraciones`).
//
// Esto es geometría pura de intervalos. Sobre qué recurso se compara (operario o
// máquina) y las excepciones de negocio (setup_solapable) las decide invariantes.ts.
// -----------------------------------------------------------------------------

import { diffDias, type FechaISO } from '../../../shared/lib/fechas'
import type { Momento } from './calendario'

// Un intervalo de ocupación: desde un momento hasta otro.
export type Intervalo = { inicio: Momento; fin: Momento }

// Fecha ancla para pasar un momento a "minutos absolutos" y poder comparar a
// través de días. El valor exacto no importa: se aplica igual a los dos momentos
// que se comparan, así que cualquier offset se cancela.
const ANCLA: FechaISO = '2000-01-01'

function aMinAbs(m: Momento): number {
  return diffDias(ANCLA, m.fecha) * 1440 + m.min
}

// ¿Dos intervalos se pisan? El `gap` es la separación mínima que debe quedar
// entre ellos:
//   - gap = 0  → intersección pura: se pisan solo si se superponen. Tocarse justo
//                (el fin de uno coincide con el inicio del otro) NO es pisarse.
//   - gap > 0  → además cuentan como conflicto si quedan a menos de `gap` minutos.
export function seSolapan(a: Intervalo, b: Intervalo, gap = 0): boolean {
  const aIni = aMinAbs(a.inicio)
  const aFin = aMinAbs(a.fin)
  const bIni = aMinAbs(b.inicio)
  const bFin = aMinAbs(b.fin)
  return aIni < bFin + gap && bIni < aFin + gap
}
