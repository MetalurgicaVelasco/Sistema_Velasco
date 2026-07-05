import { describe, it, expect } from 'vitest'
import { caminarJornada, caminar247, finMaquina, finOperario, type ContextoOperario } from './calendario'
import type { HorarioOperario } from '../../../shared/lib/jornada'
import type { Tiempos } from './duraciones'

// Operario: L-V 06:00–15:00 (540 min/día), sábado 07:00–12:00 (300 min).
const operario: HorarioOperario = {
  horarioEntrada: '06:00:00', horarioSalida: '15:00:00',
  horarioSabadoInicio: '07:00:00', horarioSabadoFin: '12:00:00',
}
const ctx: ContextoOperario = { operario, esVacaciones: () => false }

// Referencias: 2026-07-05 domingo, 07-06 lunes … 07-10 viernes, 07-11 sábado.

describe('caminarJornada', () => {
  it('cabe en el mismo día', () => {
    // Lunes 06:00 + 120 = 08:00
    expect(caminarJornada({ fecha: '2026-07-06', min: 360 }, 120, ctx)).toEqual({ fecha: '2026-07-06', min: 480 })
  })

  it('cruza al día siguiente al agotar la jornada', () => {
    // Lunes 06:00 + 600: usa 540 (hasta 15:00), quedan 60 → martes 07:00
    expect(caminarJornada({ fecha: '2026-07-06', min: 360 }, 600, ctx)).toEqual({ fecha: '2026-07-07', min: 420 })
  })

  it('salta el domingo (empieza en día no laboral)', () => {
    // Domingo → arranca lunes 06:00; + 60 = 07:00
    expect(caminarJornada({ fecha: '2026-07-05', min: 360 }, 60, ctx)).toEqual({ fecha: '2026-07-06', min: 420 })
  })

  it('usa el horario de sábado (parcial)', () => {
    // Viernes 14:00 + 120: viernes deja 60 (hasta 15:00), quedan 60 → sábado 07:00 + 60 = 08:00
    expect(caminarJornada({ fecha: '2026-07-10', min: 840 }, 120, ctx)).toEqual({ fecha: '2026-07-11', min: 480 })
  })

  it('saltea un día de vacaciones', () => {
    // De vacaciones el martes 07-07. Lunes 06:00 + 600: usa 540 lunes, quedan 60,
    // salta el martes (vacaciones) → miércoles 06:00 + 60 = 07:00
    const ctxVac: ContextoOperario = { operario, esVacaciones: (f) => f === '2026-07-07' }
    expect(caminarJornada({ fecha: '2026-07-06', min: 360 }, 600, ctxVac)).toEqual({ fecha: '2026-07-08', min: 420 })
  })
})

describe('caminar247', () => {
  it('suma minutos de calendario cruzando la medianoche', () => {
    // Lunes 22:00 (1320) + 300 = 03:00 del martes
    expect(caminar247({ fecha: '2026-07-06', min: 1320 }, 300)).toEqual({ fecha: '2026-07-07', min: 180 })
  })
  it('cruza varios días', () => {
    // Lunes 12:00 (720) + 2 días (2880) = miércoles 12:00
    expect(caminar247({ fecha: '2026-07-06', min: 720 }, 2880)).toEqual({ fecha: '2026-07-08', min: 720 })
  })
})

// setup 60, operación 100, cantidad 3, margen 30 → máquina = 390
const t = (modo: Tiempos['modo']): Tiempos => ({ setupMin: 60, operacionMin: 100, margenMin: 30, cantidad: 3, modo })

describe('finMaquina', () => {
  it('manual: todo respeta la jornada', () => {
    // Lunes 06:00 + 390 = 12:30
    expect(finMaquina({ fecha: '2026-07-06', min: 360 }, t('manual'), ctx)).toEqual({ fecha: '2026-07-06', min: 750 })
  })
  it('automatica: setup por jornada, resto 24/7 (mismo día)', () => {
    // setup 60 → lunes 07:00 (420); resto 330 en 24/7 → 12:30 (750)
    expect(finMaquina({ fecha: '2026-07-06', min: 360 }, t('automatica'), ctx)).toEqual({ fecha: '2026-07-06', min: 750 })
  })
  it('automatica: el resto 24/7 cruza la noche', () => {
    // setup 60 → lunes 07:00 (420); resto 1100 en 24/7 → 420+1100 = 1520 → martes 01:20 (80)
    const tt: Tiempos = { setupMin: 60, operacionMin: 1100, margenMin: 0, cantidad: 1, modo: 'automatica' }
    expect(finMaquina({ fecha: '2026-07-06', min: 360 }, tt, ctx)).toEqual({ fecha: '2026-07-07', min: 80 })
  })
})

describe('finOperario', () => {
  it('manual: ocupa todo (por jornada)', () => {
    expect(finOperario({ fecha: '2026-07-06', min: 360 }, t('manual'), ctx)).toEqual({ fecha: '2026-07-06', min: 750 })
  })
  it('automatica: solo el setup (por jornada)', () => {
    // setup 60 → lunes 07:00 (420)
    expect(finOperario({ fecha: '2026-07-06', min: 360 }, t('automatica'), ctx)).toEqual({ fecha: '2026-07-06', min: 420 })
  })
})
