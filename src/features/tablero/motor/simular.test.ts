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
const ctxs = new Map([[3, ctx], [4, ctx]])

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

describe('push por máquina', () => {
  it('empuja un bloque que se pisa en la misma máquina, aunque sea de otro operario', () => {
    // id1 op3, id2 op4 (distintos → sin conflicto de operario), pero misma máquina 5.
    const a = item(1, 360, 540, { operarioId: 3, maquinaId: 5 }) // lunes 06:00–15:00
    const b = item(2, 600, 60, { operarioId: 4, maquinaId: 5 }) // lunes 10:00 → se pisa en la máquina
    const r = simular([a, b], [], ctxs, { gapMin: 10 })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.items.find((i) => i.id === 2)!.inicio).toEqual({ fecha: '2026-07-07', min: 360 })
      expect(r.movidos).toEqual([2])
    }
  })

  it('no empuja si están en máquinas distintas', () => {
    const a = item(1, 360, 540, { operarioId: 3, maquinaId: 5 })
    const b = item(2, 600, 60, { operarioId: 4, maquinaId: 6 })
    const r = simular([a, b], [], ctxs, { gapMin: 10 })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.movidos).toEqual([])
  })

  it('si el bloque en conflicto es un ancla, mueve el otro', () => {
    const noAncla = item(1, 360, 120, { operarioId: 3, maquinaId: 5 }) // 06:00–08:00
    const ancla = item(2, 360, 540, { operarioId: 4, maquinaId: 5 }) // 06:00–15:00, ancla
    const r = simular([noAncla, ancla], [2], ctxs, { gapMin: 10 })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.items.find((i) => i.id === 2)!.inicio).toEqual({ fecha: '2026-07-06', min: 360 }) // ancla no se mueve
      expect(r.items.find((i) => i.id === 1)!.inicio).toEqual({ fecha: '2026-07-07', min: 360 }) // el otro → martes
      expect(r.movidos).toEqual([1])
    }
  })
})

describe('correlatividades', () => {
  const corr = [{ predecesorId: 1, sucesorId: 2 }]

  it('empuja el sucesor que arranca antes del fin del predecesor', () => {
    const pred = item(1, 360, 540, { operarioId: 3, maquinaId: 5 }) // lunes 06:00–15:00
    const suc = item(2, 360, 60, { operarioId: 4, maquinaId: 6 }) // lunes 06:00 (otro operario y máquina)
    const r = simular([pred, suc], [], ctxs, { gapMin: 10 }, corr)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.items.find((i) => i.id === 2)!.inicio).toEqual({ fecha: '2026-07-07', min: 360 })
      expect(r.movidos).toEqual([2])
    }
  })

  it('no toca el sucesor si ya arranca después del predecesor', () => {
    const pred = item(1, 360, 60, { operarioId: 3, maquinaId: 5 }) // 06:00–07:00
    const suc = item(2, 480, 60, { operarioId: 4, maquinaId: 6 }) // 08:00
    const r = simular([pred, suc], [], ctxs, { gapMin: 10 }, corr)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.movidos).toEqual([])
  })

  it('un sucesor ancla que viola queda como conflicto residual (no se mueve)', () => {
    const pred = item(1, 360, 540, { operarioId: 3, maquinaId: 5 })
    const suc = item(2, 360, 60, { operarioId: 4, maquinaId: 6 })
    const r = simular([pred, suc], [2], ctxs, { gapMin: 10 }, corr)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.items.find((i) => i.id === 2)!.inicio).toEqual({ fecha: '2026-07-06', min: 360 })
      expect(r.movidos).toEqual([])
    }
  })

  it('predecesor ausente no bloquea ni mueve', () => {
    const suc = item(2, 360, 60, { operarioId: 4, maquinaId: 6 })
    const r = simular([suc], [], ctxs, { gapMin: 10 }, corr)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.movidos).toEqual([])
  })
})

describe('conflicto residual', () => {
  it('dos anclas del mismo operario que se pisan → conflicto_no_resoluble', () => {
    // Ambas ancladas y superpuestas: nadie se puede mover → plan imposible.
    const r = simular([item(1, 360, 540), item(2, 400, 60)], [1, 2], ctxs, { gapMin: 10 })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toBe('conflicto_no_resoluble')
  })

  it('dos anclas en operarios y máquinas distintas que no se pisan → ok', () => {
    const r = simular(
      [item(1, 360, 120, { operarioId: 3, maquinaId: 5 }), item(2, 600, 60, { operarioId: 4, maquinaId: 6 })],
      [1, 2],
      ctxs,
      { gapMin: 10 },
    )
    expect(r.ok).toBe(true)
  })
})
