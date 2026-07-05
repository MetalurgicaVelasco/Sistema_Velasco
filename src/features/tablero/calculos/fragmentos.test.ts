import { describe, it, expect } from 'vitest'
import { fragmentos } from './fragmentos'
import type { ContextoOperario, Momento } from '../motor/calendario'
import type { Tiempos } from '../motor/duraciones'

// Operario: L-V 06:00–15:00 (540 min/día), sábado 07:00–12:00 (300 min).
const ctx: ContextoOperario = {
  operario: {
    horarioEntrada: '06:00:00', horarioSalida: '15:00:00',
    horarioSabadoInicio: '07:00:00', horarioSabadoFin: '12:00:00',
  },
  esVacaciones: () => false,
}

const lun6: Momento = { fecha: '2026-07-06', min: 360 }
const t = (o: Partial<Tiempos>): Tiempos => ({ setupMin: 0, operacionMin: 0, margenMin: 0, cantidad: 1, modo: 'manual', ...o })

describe('fragmentos — manual', () => {
  it('cabe en un día → un solo fragmento (sin setup)', () => {
    const f = fragmentos(lun6, t({ operacionMin: 120, modo: 'manual' }), ctx)
    expect(f).toEqual([{ fecha: '2026-07-06', inicioMin: 360, finMin: 480, setupMin: 0, parte: 1, totalPartes: 1 }])
  })

  it('cruza días → varios fragmentos numerados N/M', () => {
    const f = fragmentos(lun6, t({ operacionMin: 600, modo: 'manual' }), ctx)
    expect(f).toEqual([
      { fecha: '2026-07-06', inicioMin: 360, finMin: 900, setupMin: 0, parte: 1, totalPartes: 2 },
      { fecha: '2026-07-07', inicioMin: 360, finMin: 420, setupMin: 0, parte: 2, totalPartes: 2 },
    ])
  })

  it('saltea el domingo', () => {
    const sab7: Momento = { fecha: '2026-07-11', min: 420 }
    const f = fragmentos(sab7, t({ operacionMin: 400, modo: 'manual' }), ctx)
    expect(f).toEqual([
      { fecha: '2026-07-11', inicioMin: 420, finMin: 720, setupMin: 0, parte: 1, totalPartes: 2 },
      { fecha: '2026-07-13', inicioMin: 360, finMin: 460, setupMin: 0, parte: 2, totalPartes: 2 },
    ])
  })
})

describe('fragmentos — automática', () => {
  it('dentro de la jornada: setup y máquina se fusionan; setupMin marca la porción de setup', () => {
    const f = fragmentos(lun6, t({ setupMin: 60, operacionMin: 100, cantidad: 3, modo: 'automatica' }), ctx)
    expect(f).toEqual([{ fecha: '2026-07-06', inicioMin: 360, finMin: 720, setupMin: 60, parte: 1, totalPartes: 1 }])
  })

  it('la parte 24/7 que corre de noche solo se dibuja dentro de la jornada; el setup queda marcado', () => {
    const f = fragmentos(lun6, t({ setupMin: 60, operacionMin: 1200, cantidad: 1, modo: 'automatica' }), ctx)
    expect(f).toEqual([{ fecha: '2026-07-06', inicioMin: 360, finMin: 900, setupMin: 60, parte: 1, totalPartes: 1 }])
  })
})

describe('fragmentos — semi', () => {
  it('respeta la jornada y marca los primeros minutos como setup', () => {
    // setup 20 + 20 + margen 60 = 100 min, desde lunes 10:00 (600)
    const inicio: Momento = { fecha: '2026-07-06', min: 600 }
    const f = fragmentos(inicio, t({ setupMin: 20, operacionMin: 20, margenMin: 60, cantidad: 1, modo: 'semi_automatica' }), ctx)
    expect(f).toEqual([{ fecha: '2026-07-06', inicioMin: 600, finMin: 700, setupMin: 20, parte: 1, totalPartes: 1 }])
  })
})
