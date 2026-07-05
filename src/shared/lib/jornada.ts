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
 * que los tenga sirve (no hace falta el tipo Personal completo). Las horas son
 * 'HH:MM:SS' como las devuelve Supabase, o null si no están cargadas.
 */
export interface HorarioOperario {
  horario_entrada: string | null
  horario_salida: string | null
  horario_sabado_inicio: string | null
  horario_sabado_fin: string | null
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
 *  - Sábado: usa horario_sabado_*; si están vacíos, no trabaja ese sábado.
 *  - Lunes a viernes: usa horario_entrada/salida; si faltan, no trabaja.
 */
export function jornada(op: HorarioOperario, fecha: FechaISO): Turno {
  if (esDomingo(fecha)) return NO_TRABAJA

  if (esSabado(fecha)) {
    if (!op.horario_sabado_inicio || !op.horario_sabado_fin) return NO_TRABAJA
    return {
      trabaja: true,
      inicioMin: horaAMin(op.horario_sabado_inicio),
      finMin: horaAMin(op.horario_sabado_fin),
    }
  }

  if (!op.horario_entrada || !op.horario_salida) return NO_TRABAJA
  return {
    trabaja: true,
    inicioMin: horaAMin(op.horario_entrada),
    finMin: horaAMin(op.horario_salida),
  }
}
