import { describe, it, expect } from 'vitest'
import { armarPlan } from './escritura'
import type { ItemSimulacion, ResultadoSimulacion } from '../motor/simular'

const tiempos = { setupMin: 0, operacionMin: 60, margenMin: 0, cantidad: 1, modo: 'manual' as const }

function item(id: number, fecha: string, min: number, operarioId: number | null, maquinaId: number | null): ItemSimulacion {
  return { id, operarioId, maquinaId, tiempos, setupSolapable: false, inicio: { fecha, min } }
}

describe('armarPlan', () => {
  it('incluye el ancla y los reacomodados, con su posición final', () => {
    const items = [
      item(1, '2026-07-06', 360, 3, 5), // ancla
      item(2, '2026-07-07', 420, 3, null), // movido por la cascada
      item(3, '2026-07-06', 600, 4, 6), // no tocado
    ]
    const resultado: ResultadoSimulacion = { ok: true, items, movidos: [2] }
    const plan = armarPlan(resultado, [1])
    expect(plan).toEqual([
      { procesoId: 1, planFecha: '2026-07-06', planHora: '06:00', planOperarioId: 3, planMaquinaId: 5, estado: 'planificado' },
      { procesoId: 2, planFecha: '2026-07-07', planHora: '07:00', planOperarioId: 3, planMaquinaId: null, estado: 'planificado' },
    ])
  })

  it('devuelve vacío si la simulación no cerró', () => {
    const resultado: ResultadoSimulacion = { ok: false, error: 'conflicto_no_resoluble' }
    expect(armarPlan(resultado, [1])).toEqual([])
  })
})
