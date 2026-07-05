import { describe, it, expect } from 'vitest'
import { divergencias, hayDivergencia } from './divergencias'
import type { ProcesoTablero, PlanAceptado } from '../tipos'

const ACK: PlanAceptado = { setupMin: 60, operacionMin: 100, margenMin: 30, cantidad: 3, modo: 'manual' }

function proc(o: Partial<ProcesoTablero>): ProcesoTablero {
  return {
    id: 1, elementoId: 1, orden: 1, tipoProcesoId: null, procesoOtro: null,
    modo: 'manual', setupMin: 60, operacionMin: 100, margenMin: 30,
    maquinaId: null, maquinaOtra: null, operarioId: null, detalleTrabajo: null,
    esRetrabajo: false,
    estado: 'planificado', planFecha: '2026-07-06', planHora: '06:00:00',
    planOperarioId: 3, planMaquinaId: 5, planAceptado: { ...ACK },
    realFechaInicio: null, realHoraInicio: null, realFechaFin: null, realHoraFin: null,
    procesoEliminado: false, setupSolapable: false, grupoDivisionId: null,
    ...o,
  }
}

describe('divergencias', () => {
  it('sin snapshot no hay divergencia', () => {
    expect(divergencias(proc({ planAceptado: null }), 3)).toEqual([])
    expect(hayDivergencia(proc({ planAceptado: null }), 3)).toBe(false)
  })

  it('valores iguales al snapshot → sin divergencia', () => {
    expect(divergencias(proc({}), 3)).toEqual([])
    expect(hayDivergencia(proc({}), 3)).toBe(false)
  })

  it('detecta cambio de setup', () => {
    const d = divergencias(proc({ setupMin: 90 }), 3)
    expect(d).toEqual([{ campo: 'setup', aceptado: 60, actual: 90 }])
  })

  it('detecta cambio de operación y de margen', () => {
    const d = divergencias(proc({ operacionMin: 120, margenMin: 45 }), 3)
    expect(d.map((x) => x.campo).sort()).toEqual(['margen', 'operacion'])
  })

  it('detecta cambio de cantidad (viene del elemento)', () => {
    const d = divergencias(proc({}), 5) // el snapshot tenía cantidad 3
    expect(d).toEqual([{ campo: 'cantidad', aceptado: 3, actual: 5 }])
  })

  it('detecta cambio de modo', () => {
    const d = divergencias(proc({ modo: 'automatica' }), 3)
    expect(d).toEqual([{ campo: 'modo', aceptado: 'manual', actual: 'automatica' }])
  })

  it('acumula varias divergencias', () => {
    const d = divergencias(proc({ setupMin: 90, modo: 'semi_automatica' }), 4)
    expect(d.map((x) => x.campo).sort()).toEqual(['cantidad', 'modo', 'setup'])
    expect(hayDivergencia(proc({ setupMin: 90 }), 4)).toBe(true)
  })
})
