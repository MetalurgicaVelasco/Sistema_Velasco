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
// setup, operación, cantidad, margen → duracionMaquina
const t = (o: Partial<Tiempos>): Tiempos => ({ setupMin: 0, operacionMin: 0, margenMin: 0, cantidad: 1, modo: 'manual', ...o })

describe('fragmentos — manual', () => {
  it('cabe en un día → un solo fragmento', () => {
    // 120 min desde lunes 06:00 → 06:00–08:00
    const f = fragmentos(lun6, t({ operacionMin: 120, modo: 'manual' }), ctx)
    expect(f).toEqual([{ fecha: '2026-07-06', inicioMin: 360, finMin: 480, parte: 1, totalPartes: 1 }])
  })

  it('cruza días → varios fragmentos numerados N/M', () => {
    // 600 min: lunes 06:00–15:00 (540) + martes 06:00–07:00 (60)
    const f = fragmentos(lun6, t({ operacionMin: 600, modo: 'manual' }), ctx)
    expect(f).toEqual([
      { fecha: '2026-07-06', inicioMin: 360, finMin: 900, parte: 1, totalPartes: 2 },
      { fecha: '2026-07-07', inicioMin: 360, finMin: 420, parte: 2, totalPartes: 2 },
    ])
  })

  it('saltea el domingo', () => {
    // Sábado 07:00 + 400: sábado 07:00–12:00 (300) + lunes 06:00–07:40 (100)
    const sab7: Momento = { fecha: '2026-07-11', min: 420 }
    const f = fragmentos(sab7, t({ operacionMin: 400, modo: 'manual' }), ctx)
    expect(f).toEqual([
      { fecha: '2026-07-11', inicioMin: 420, finMin: 720, parte: 1, totalPartes: 2 },
      { fecha: '2026-07-13', inicioMin: 360, finMin: 460, parte: 2, totalPartes: 2 },
    ])
  })
})

describe('fragmentos — automática', () => {
  it('dentro de la jornada: setup y máquina se fusionan en un fragmento', () => {
    // setup 60 + 3×100 = 360 min de máquina. Lunes 06:00–12:00
    const f = fragmentos(lun6, t({ setupMin: 60, operacionMin: 100, cantidad: 3, modo: 'automatica' }), ctx)
    expect(f).toEqual([{ fecha: '2026-07-06', inicioMin: 360, finMin: 720, parte: 1, totalPartes: 1 }])
  })

  it('la parte 24/7 que corre de noche solo se dibuja dentro de la jornada', () => {
    // setup 60 + máquina 1200 (total 1260). Lunes: setup+máquina hasta 15:00; el
    // resto corre de noche y termina de madrugada (no visible). Un fragmento lunes.
    const f = fragmentos(lun6, t({ setupMin: 60, operacionMin: 1200, cantidad: 1, modo: 'automatica' }), ctx)
    expect(f).toEqual([{ fecha: '2026-07-06', inicioMin: 360, finMin: 900, parte: 1, totalPartes: 1 }])
  })
})
