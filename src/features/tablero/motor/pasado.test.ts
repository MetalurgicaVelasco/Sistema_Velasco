import { describe, it, expect } from 'vitest'
import { diaLaboralAnterior, esPasado } from './pasado'
import type { ContextoOperario, Momento } from './calendario'
import type { Tiempos } from './duraciones'

const ctx: ContextoOperario = {
  operario: {
    horarioEntrada: '06:00:00', horarioSalida: '15:00:00',
    horarioSabadoInicio: '07:00:00', horarioSabadoFin: '12:00:00',
  },
  esVacaciones: () => false,
}

const t = (o: Partial<Tiempos>): Tiempos => ({ setupMin: 0, operacionMin: 0, margenMin: 0, cantidad: 1, modo: 'manual', ...o })

describe('diaLaboralAnterior', () => {
  it('lunes → sábado (salta el domingo)', () => {
    expect(diaLaboralAnterior('2026-07-06')).toBe('2026-07-04')
  })
  it('viernes → jueves', () => {
    expect(diaLaboralAnterior('2026-07-10')).toBe('2026-07-09')
  })
  it('domingo → sábado', () => {
    expect(diaLaboralAnterior('2026-07-05')).toBe('2026-07-04')
  })
})

describe('esPasado', () => {
  const corte: '2026-07-04' = '2026-07-04' // corte de ejemplo (sábado)

  it('un proceso que arranca en/después del corte no es pasado', () => {
    const inicio: Momento = { fecha: '2026-07-06', min: 360 } // lunes
    expect(esPasado(inicio, t({ operacionMin: 120 }), ctx, corte)).toBe(false)
  })

  it('un proceso que arrancó y terminó antes del corte es pasado', () => {
    const inicio: Momento = { fecha: '2026-07-02', min: 360 } // jueves 06:00–08:00
    expect(esPasado(inicio, t({ operacionMin: 120 }), ctx, corte)).toBe(true)
  })

  it('un proceso largo que arrancó antes pero cruza el corte NO es pasado', () => {
    // Viernes 03 06:00, 1000 min → viernes + sábado + lunes 06 → fin lunes ≥ corte
    const inicio: Momento = { fecha: '2026-07-03', min: 360 }
    expect(esPasado(inicio, t({ operacionMin: 1000 }), ctx, corte)).toBe(false)
  })
})
