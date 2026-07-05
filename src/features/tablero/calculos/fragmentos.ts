// features/tablero/calculos/fragmentos.ts
// -----------------------------------------------------------------------------
// Parte un proceso planificado en los TRAMOS VISIBLES por día — lo que se dibuja
// en cada celda del tablero. Un bloque que cruza días se muestra como varios
// fragmentos, numerados parte/totalPartes. (Porta computeVB del sistema viejo.)
//
// Dos casos:
//   - Manual/semi: todo respeta la jornada; un tramo por día usado.
//   - Automática: el setup respeta la jornada; la parte de máquina corre 24/7
//     pero SOLO se dibuja donde hay jornada (de noche la máquina sigue, pero no
//     hay dónde pintarla). Los tramos contiguos del mismo día se fusionan.
// -----------------------------------------------------------------------------

import { jornada } from '../../../shared/lib/jornada'
import { sumarDias, type FechaISO } from '../../../shared/lib/fechas'
import { reglaDe } from '../motor/modos'
import { duracionMaquina, type Tiempos } from '../motor/duraciones'
import { proximoDiaLaboral, type ContextoOperario, type Momento } from '../motor/calendario'

// Un tramo visible de un bloque en un día.
export type Fragmento = {
  fecha: FechaISO
  inicioMin: number
  finMin: number
  parte: number
  totalPartes: number
}

const MAX_DIAS = 366

function trabaja(ctx: ContextoOperario, fecha: FechaISO): boolean {
  return jornada(ctx.operario, fecha).trabaja && !ctx.esVacaciones(fecha)
}

// Tramos de trabajo respetando la jornada del operario (uno por día usado).
// DEUDA: comparte la mecánica del walk con calendario.caminarJornada (que da
// solo el fin); a futuro conviene que ambas salgan de una sola primitiva.
function tramosJornada(inicio: Momento, minutos: number, ctx: ContextoOperario): Fragmento[] {
  const out: Fragmento[] = []
  let fecha = inicio.fecha
  let min = inicio.min
  if (!trabaja(ctx, fecha)) {
    fecha = proximoDiaLaboral(ctx, fecha)
    min = jornada(ctx.operario, fecha).inicioMin
  }
  let rem = minutos
  let guarda = 0
  while (rem > 0) {
    if (++guarda > MAX_DIAS) throw new Error('fragmentos: el bloque no cerró')
    const t = jornada(ctx.operario, fecha)
    if (min < t.inicioMin) min = t.inicioMin
    const disp = t.finMin - min
    if (disp <= 0) {
      fecha = proximoDiaLaboral(ctx, fecha)
      min = jornada(ctx.operario, fecha).inicioMin
      continue
    }
    const usa = Math.min(rem, disp)
    out.push({ fecha, inicioMin: min, finMin: min + usa, parte: 0, totalPartes: 0 })
    rem -= usa
    if (rem > 0) {
      fecha = proximoDiaLaboral(ctx, fecha)
      min = jornada(ctx.operario, fecha).inicioMin
    } else {
      min += usa
    }
  }
  return out
}

// Tramos visibles de la parte de máquina 24/7 (automáticas): la máquina corre de
// corrido (noches y fines de semana incluidos), pero solo se dibuja la
// intersección con la jornada del operario.
function tramos247(desde: Momento, minutos: number, ctx: ContextoOperario): Fragmento[] {
  const out: Fragmento[] = []
  let fecha = desde.fecha
  let min = desde.min
  let rem = minutos
  let guarda = 0
  while (rem > 0) {
    if (++guarda > MAX_DIAS) throw new Error('fragmentos 24/7: el bloque no cerró')
    const disponibleHoy = 1440 - min
    const consumeHoy = Math.min(rem, disponibleHoy)
    const finMaquinaHoy = min + consumeHoy
    const t = jornada(ctx.operario, fecha)
    if (t.trabaja) {
      const visIni = Math.max(min, t.inicioMin)
      const visFin = Math.min(finMaquinaHoy, t.finMin)
      if (visFin > visIni) out.push({ fecha, inicioMin: visIni, finMin: visFin, parte: 0, totalPartes: 0 })
    }
    rem -= consumeHoy
    if (rem > 0) {
      fecha = sumarDias(fecha, 1)
      min = 0
    }
  }
  return out
}

// Une tramos contiguos del mismo día (el fin de uno coincide con el inicio del otro).
function fusionar(tramos: Fragmento[]): Fragmento[] {
  const orden = [...tramos].sort((a, b) =>
    a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : a.inicioMin - b.inicioMin,
  )
  const out: Fragmento[] = []
  for (const f of orden) {
    const ult = out[out.length - 1]
    if (ult && ult.fecha === f.fecha && Math.abs(ult.finMin - f.inicioMin) < 1) {
      ult.finMin = f.finMin
    } else {
      out.push({ ...f })
    }
  }
  return out
}

// Parte un proceso en los tramos visibles por día, numerados parte/totalPartes.
export function fragmentos(inicio: Momento, tiempos: Tiempos, ctx: ContextoOperario): Fragmento[] {
  let tramos: Fragmento[]

  if (reglaDe(tiempos.modo).maquina247) {
    const setup = tramosJornada(inicio, tiempos.setupMin, ctx)
    const finSetup: Momento = setup.length
      ? { fecha: setup[setup.length - 1].fecha, min: setup[setup.length - 1].finMin }
      : inicio
    const restoMaquina = duracionMaquina(tiempos) - tiempos.setupMin
    const maquina = restoMaquina > 0 ? tramos247(finSetup, restoMaquina, ctx) : []
    tramos = fusionar([...setup, ...maquina])
  } else {
    tramos = tramosJornada(inicio, duracionMaquina(tiempos), ctx)
  }

  tramos.sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : a.inicioMin - b.inicioMin))
  const total = tramos.length
  return tramos.map((f, i) => ({ ...f, parte: i + 1, totalPartes: total }))
}
