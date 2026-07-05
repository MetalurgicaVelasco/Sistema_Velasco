import { describe, it, expect } from 'vitest'
import { duracionMaquina, duracionOperario, tiemposDe, type Tiempos } from './duraciones'
import type { ProcesoTablero } from '../tipos'

// setup 60, operación 100, cantidad 3, margen 30 → máquina = 60 + 300 + 30 = 390
const base: Tiempos = { setupMin: 60, operacionMin: 100, margenMin: 30, cantidad: 3, modo: 'manual' }

describe('duracionMaquina', () => {
  it('setup + cantidad×operación + margen', () => {
    expect(duracionMaquina(base)).toBe(390)
  })
  it('cantidad 0 cuenta como 1', () => {
    expect(duracionMaquina({ ...base, cantidad: 0 })).toBe(60 + 100 + 30)
  })
})

describe('duracionOperario', () => {
  it('manual: ocupa todo el bloque', () => {
    expect(duracionOperario({ ...base, modo: 'manual' })).toBe(390)
  })
  it('semi: solo el setup', () => {
    expect(duracionOperario({ ...base, modo: 'semi_automatica' })).toBe(60)
  })
  it('automatica: solo el setup', () => {
    expect(duracionOperario({ ...base, modo: 'automatica' })).toBe(60)
  })
})

// Factory de un ProcesoTablero completo para probar tiemposDe.
function proc(overrides: Partial<ProcesoTablero>): ProcesoTablero {
  return {
    id: 1, elementoId: 1, orden: 1, tipoProcesoId: null, procesoOtro: null,
    modo: 'manual', setupMin: 10, operacionMin: 20, margenMin: 5,
    maquinaId: null, maquinaOtra: null, operarioId: null, detalleTrabajo: null,
    esRetrabajo: false,
    estado: 'planificado', planFecha: null, planHora: null,
    planOperarioId: null, planMaquinaId: null, planAceptado: null,
    realFechaInicio: null, realHoraInicio: null, realFechaFin: null, realHoraFin: null,
    procesoEliminado: false, setupSolapable: false, grupoDivisionId: null,
    ...overrides,
  }
}

describe('tiemposDe', () => {
  it('sin snapshot usa los valores actuales + la cantidad del elemento', () => {
    const t = tiemposDe(proc({ setupMin: 10, operacionMin: 20, margenMin: 5, modo: 'manual' }), 4)
    expect(t).toEqual({ setupMin: 10, operacionMin: 20, margenMin: 5, cantidad: 4, modo: 'manual' })
  })
  it('con snapshot usa el plan_aceptado e ignora los valores actuales', () => {
    const t = tiemposDe(
      proc({
        setupMin: 999, operacionMin: 999, margenMin: 999, modo: 'manual',
        planAceptado: { setupMin: 10, operacionMin: 20, margenMin: 5, cantidad: 3, modo: 'automatica' },
      }),
      4,
    )
    expect(t).toEqual({ setupMin: 10, operacionMin: 20, margenMin: 5, cantidad: 3, modo: 'automatica' })
  })
})
