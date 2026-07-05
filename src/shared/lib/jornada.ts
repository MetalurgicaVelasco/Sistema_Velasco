// shared/lib/jornada.ts
// -----------------------------------------------------------------------------
// Turno de trabajo de un operario en una fecha concreta.
//
// La función SIEMPRE recibe la fecha. El mismo operario tiene un turno distinto
// un sábado que un martes, y calcular el sábado con el horario de semana (por no
// pasar la fecha) era uno de los bugs del sistema viejo.
// -----------------------------------------------------------------------------

import { esDomingo, esSabado, horaAMin, type FechaISO } from './fechas'

/**
 * Los campos de horario que la función necesita del operario. Cualquier objeto
 * que los tenga sirve (p. ej. un PersonalTablero). Las horas van en camelCase
 * como el resto del código de la app ('HH:MM:SS' o null si no están cargadas).
 */
export interface HorarioOperario {
  horarioEntrada: string | null
  horarioSalida: string | null
  horarioSabadoInicio: string | null
  horarioSabadoFin: string | null
}

/** Turno de un operario en un día, en minutos desde medianoche. */
export interface Turno {
  trabaja: boolean
  inicioMin: number
  finMin: number
}

const NO_TRABAJA: Turno = { trabaja: false, inicioMin: 0, finMin: 0 }

/**
 * Turno del operario en esa fecha.
 *  - Domingo: no trabaja.
 *  - Sábado: usa el horario de sábado; si está vacío, no trabaja ese sábado.
 *  - Lunes a viernes: usa entrada/salida; si faltan, no trabaja.
 */
export function jornada(op: HorarioOperario, fecha: FechaISO): Turno {
  if (esDomingo(fecha)) return NO_TRABAJA

  if (esSabado(fecha)) {
    if (!op.horarioSabadoInicio || !op.horarioSabadoFin) return NO_TRABAJA
    return {
      trabaja: true,
      inicioMin: horaAMin(op.horarioSabadoInicio),
      finMin: horaAMin(op.horarioSabadoFin),
    }
  }

  if (!op.horarioEntrada || !op.horarioSalida) return NO_TRABAJA
  return {
    trabaja: true,
    inicioMin: horaAMin(op.horarioEntrada),
    finMin: horaAMin(op.horarioSalida),
  }
}
