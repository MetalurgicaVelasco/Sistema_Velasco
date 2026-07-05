// features/tablero/motor/pasado.ts
// -----------------------------------------------------------------------------
// Filtro de pasado: el motor solo opera sobre presente y futuro. Un proceso que
// ya terminó antes del "corte" (el último día laboral anterior a hoy) es
// historia: no se recalcula, no se mueve y no genera conflictos al reacomodar.
//
// Se mira la fecha de FIN, no la de inicio: un proceso largo que arrancó antes
// del corte pero sigue vigente NO es pasado.
// -----------------------------------------------------------------------------

import { sumarDias, parseFecha, type FechaISO } from '../../../shared/lib/fechas'
import { finMaquina, type ContextoOperario, type Momento } from './calendario'
import type { Tiempos } from './duraciones'

// Día laboral anterior a `fecha`: el día previo, saltando domingos.
// (lunes → sábado, viernes → jueves, domingo → sábado)
export function diaLaboralAnterior(fecha: FechaISO): FechaISO {
  let f = sumarDias(fecha, -1)
  while (parseFecha(f).getDay() === 0) f = sumarDias(f, -1)
  return f
}

// ¿El proceso ya es historia respecto del corte? Verdadero solo si arrancó antes
// del corte Y su fin de máquina también cae antes del corte.
export function esPasado(
  inicio: Momento,
  tiempos: Tiempos,
  ctx: ContextoOperario,
  corte: FechaISO,
): boolean {
  if (inicio.fecha >= corte) return false
  return finMaquina(inicio, tiempos, ctx).fecha < corte
}
