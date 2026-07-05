// features/tablero/motor/preparar.ts
// -----------------------------------------------------------------------------
// El "pegamento" entre los datos y el motor: convierte un proceso planificado en
// un BloqueCalculado (con sus dos intervalos de ocupación ya resueltos), que es
// lo que consumen las invariantes y la cascada.
//
// Todo lo que el motor necesita del operario (horarios, vacaciones) se inyecta
// como contexto; el motor no lee la base.
// -----------------------------------------------------------------------------

import { horaAMin, type FechaISO } from '../../../shared/lib/fechas'
import { finMaquina, finOperario, type ContextoOperario, type Momento } from './calendario'
import { tiemposDe } from './duraciones'
import type { BloqueCalculado } from './invariantes'
import type { ProcesoTablero, PersonalTablero, Vacacion } from '../tipos'

// Arma el contexto de un operario: sus horarios (PersonalTablero ya trae los
// campos que jornada() necesita) + una función que dice si está de vacaciones un
// día, a partir de sus rangos de personal_vacaciones.
export function contextoOperario(
  operario: PersonalTablero,
  vacaciones: Vacacion[],
): ContextoOperario {
  const rangos = vacaciones.filter((v) => v.personalId === operario.id)
  return {
    operario,
    esVacaciones: (fecha: FechaISO) => rangos.some((v) => v.desde <= fecha && fecha <= v.hasta),
  }
}

// Convierte un proceso planificado en su bloque con los dos intervalos ya
// calculados. `ctx` debe ser el del operario asignado en el plan.
export function ensamblarBloque(
  proceso: ProcesoTablero,
  ctx: ContextoOperario,
  cantidadElemento: number,
): BloqueCalculado {
  if (!proceso.planFecha || !proceso.planHora || proceso.planOperarioId == null) {
    throw new Error(`ensamblarBloque: el proceso ${proceso.id} no está completamente planificado`)
  }
  const inicio: Momento = { fecha: proceso.planFecha, min: horaAMin(proceso.planHora) }
  const tiempos = tiemposDe(proceso, cantidadElemento)
  return {
    id: proceso.id,
    operarioId: proceso.planOperarioId,
    maquinaId: proceso.planMaquinaId,
    modo: tiempos.modo,
    setupSolapable: proceso.setupSolapable,
    intervaloOperario: { inicio, fin: finOperario(inicio, tiempos, ctx) },
    intervaloMaquina: { inicio, fin: finMaquina(inicio, tiempos, ctx) },
  }
}
