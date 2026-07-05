// features/tablero/motor/calendario.ts
// -----------------------------------------------------------------------------
// El "caminar" del tiempo: dado un inicio y una cantidad de minutos, calcular
// dónde termina. Es UNA sola implementación (el viejo la tenía copiada ~8 veces).
//
// Dos formas de avanzar:
//   - caminarJornada: respeta la jornada del operario (noches, sábados parciales,
//     domingos y vacaciones NO cuentan). La usan el setup, las semi y las manuales.
//   - caminar247: suma minutos de calendario de corrido (la máquina no para). La
//     usa la parte de máquina de una automática.
//
// Funciones puras: el operario y sus vacaciones se pasan como parámetro (ctx),
// no se leen de la base. Si un cálculo no cierra, lanza error (no trunca).
// -----------------------------------------------------------------------------

import { jornada, type HorarioOperario } from '../../../shared/lib/jornada'
import { sumarDias, type FechaISO } from '../../../shared/lib/fechas'
import { reglaDe } from './modos'
import { duracionMaquina, duracionOperario, type Tiempos } from './duraciones'

// Un instante del calendario: una fecha y un minuto del día (desde medianoche).
export type Momento = { fecha: FechaISO; min: number }

// Contexto del operario para el caminar. `esVacaciones` se inyecta (se arma
// desde personal_vacaciones); así el motor no sabe de dónde salen los datos.
export type ContextoOperario = {
  operario: HorarioOperario
  esVacaciones: (fecha: FechaISO) => boolean
}

// Tope de días que el walk puede recorrer antes de asumir que hay un bug. Muy
// generoso; un proceso jamás debería acercarse. Si se supera, se lanza error en
// vez de truncar en silencio (lo que hacía el sistema viejo con `safe < 20`).
const MAX_DIAS = 366

function trabajaEse(ctx: ContextoOperario, fecha: FechaISO): boolean {
  return jornada(ctx.operario, fecha).trabaja && !ctx.esVacaciones(fecha)
}

// Primer día ESTRICTAMENTE posterior a `fecha` en que el operario trabaja.
function proximoDiaLaboral(ctx: ContextoOperario, fecha: FechaISO): FechaISO {
  let f = sumarDias(fecha, 1)
  let guarda = 0
  while (!trabajaEse(ctx, f)) {
    f = sumarDias(f, 1)
    if (++guarda > MAX_DIAS) {
      throw new Error(`No se encontró día laboral en ${MAX_DIAS} días desde ${fecha}`)
    }
  }
  return f
}

// Camina `minutos` de trabajo desde `inicio`, respetando la jornada del operario.
export function caminarJornada(
  inicio: Momento,
  minutos: number,
  ctx: ContextoOperario,
): Momento {
  let fecha = inicio.fecha
  let min = inicio.min
  let rem = minutos

  // Si arranca en un día no laboral, saltar al próximo laboral (al inicio de su jornada).
  if (!trabajaEse(ctx, fecha)) {
    fecha = proximoDiaLaboral(ctx, fecha)
    min = jornada(ctx.operario, fecha).inicioMin
  }

  let guarda = 0
  while (rem > 0) {
    if (++guarda > MAX_DIAS) {
      throw new Error(`El proceso no cerró en ${MAX_DIAS} días laborales (posible bug del motor)`)
    }
    const t = jornada(ctx.operario, fecha)
    if (min < t.inicioMin) min = t.inicioMin
    const disp = t.finMin - min
    if (disp <= 0) {
      fecha = proximoDiaLaboral(ctx, fecha)
      min = jornada(ctx.operario, fecha).inicioMin
      continue
    }
    const usa = Math.min(rem, disp)
    rem -= usa
    if (rem > 0) {
      fecha = proximoDiaLaboral(ctx, fecha)
      min = jornada(ctx.operario, fecha).inicioMin
    } else {
      min += usa
    }
  }
  return { fecha, min }
}

// Camina `minutos` de calendario de corrido (24/7): la máquina no para de noche
// ni el fin de semana.
export function caminar247(inicio: Momento, minutos: number): Momento {
  let total = inicio.min + minutos
  let fecha = inicio.fecha
  while (total >= 1440) {
    fecha = sumarDias(fecha, 1)
    total -= 1440
  }
  return { fecha, min: total }
}

// Fin de la ocupación de la MÁQUINA a partir de `inicio`.
export function finMaquina(inicio: Momento, t: Tiempos, ctx: ContextoOperario): Momento {
  if (reglaDe(t.modo).maquina247) {
    // El setup respeta la jornada; después la máquina corre sola 24/7.
    const finSetup = caminarJornada(inicio, t.setupMin, ctx)
    const restoMaquina = duracionMaquina(t) - t.setupMin
    return restoMaquina > 0 ? caminar247(finSetup, restoMaquina) : finSetup
  }
  // Semi / manual: todo respeta la jornada.
  return caminarJornada(inicio, duracionMaquina(t), ctx)
}

// Fin de la ocupación del OPERARIO a partir de `inicio` (siempre respeta la jornada).
export function finOperario(inicio: Momento, t: Tiempos, ctx: ContextoOperario): Momento {
  return caminarJornada(inicio, duracionOperario(t), ctx)
}
