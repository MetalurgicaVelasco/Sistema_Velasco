import { describe, it, expect } from 'vitest'
import { simular, type ItemSimulacion } from './simular'
import type { ContextoOperario } from './calendario'

// Operario 3: L-V 06:00–15:00 (sin sábado).
const ctx: ContextoOperario = {
  operario: {
    horarioEntrada: '06:00:00', horarioSalida: '15:00:00',
    horarioSabadoInicio: null, horarioSabadoFin: null,
  },
  esVacaciones: () => false,
}
const ctxs = new Map([[3, ctx]])

// Ítem manual del operario 3, en un día (por defecto lunes 2026-07-06).
function item(id: number, iniMin: number, durOp: number, o: Partial<ItemSimulacion> = {}): ItemSimulacion {
  return {
    id, operarioId: 3, maquinaId: null, setupSolapable: false,
    tiempos: { setupMin: 0, operacionMin: durOp, margenMin: 0, cantidad: 1, modo: 'manual' },
    inicio: { fecha: '2026-07-06', min: iniMin },
    ...o,
  }
}

describe('cascada por operario', () => {
  it('empuja un bloque no-ancla que se pisa con un ancla', () => {
    // id1 ancla: lunes 06:00–15:00 (dur 540). id2: lunes 10:00 → se pisa.
    const r = simular([item(1, 360, 540), item(2, 600, 60)], [1], ctxs, { gapMin: 10 })
    expect(r.ok).toBe(true)
    if (r.ok) {
      // id2 no entra el lunes (el ancla ocupa hasta las 15:00) → martes 06:00
      expect(r.items.find((i) => i.id === 2)!.inicio).toEqual({ fecha: '2026-07-07', min: 360 })
      expect(r.movidos).toEqual([2])
    }
  })

  it('no toca nada si no se pisan', () => {
    // id1: 06:00–08:00 (dur 120). id2: 10:00 → no se pisan.
    const r = simular([item(1, 360, 120), item(2, 600, 60)], [], ctxs, { gapMin: 10 })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.movidos).toEqual([])
  })

  it('con dos no-anclas que se pisan, empuja el de más tarde', () => {
    const r = simular([item(1, 360, 540), item(2, 600, 60)], [], ctxs, { gapMin: 10 })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.items.find((i) => i.id === 2)!.inicio).toEqual({ fecha: '2026-07-07', min: 360 })
      expect(r.movidos).toEqual([2])
    }
  })

  it('respeta la excepción setup_solapable (setup de automática sobre manual)', () => {
    // id1 automática solapable (solo setup 60 min de operario), id2 manual, ambas 06:00.
    const auto = item(1, 360, 0, {
      setupSolapable: true,
      tiempos: { setupMin: 60, operacionMin: 0, margenMin: 0, cantidad: 1, modo: 'automatica' },
    })
    const manual = item(2, 360, 120)
    const r = simular([auto, manual], [], ctxs, { gapMin: 10 })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.movidos).toEqual([]) // el setup se monta sobre la manual, no se cascadea
  })
})
