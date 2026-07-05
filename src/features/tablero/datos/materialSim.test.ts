import { describe, it, expect } from 'vitest'
import { materialSimulacion } from './materialSim'
import type { ProcesoTablero, PersonalTablero } from '../tipos'

const operario: PersonalTablero = {
  id: 3, nombre: 'Juan', apellido: 'Pérez',
  horarioEntrada: '06:00:00', horarioSalida: '15:00:00',
  horarioSabadoInicio: '07:00:00', horarioSabadoFin: '12:00:00',
  colorBorde: null, ordenTablero: 1,
}
const personal = new Map([[3, operario]])

function proc(o: Partial<ProcesoTablero>): ProcesoTablero {
  return {
    id: 1, elementoId: 10, orden: 1, tipoProcesoId: null, procesoOtro: null,
    modo: 'manual', setupMin: 0, operacionMin: 120, margenMin: 0,
    maquinaId: 5, maquinaOtra: null, operarioId: 3, detalleTrabajo: null,
    esRetrabajo: false,
    estado: 'planificado', planFecha: '2026-07-06', planHora: '06:00:00',
    planOperarioId: 3, planMaquinaId: 5, planAceptado: null,
    realFechaInicio: null, realHoraInicio: null, realFechaFin: null, realHoraFin: null,
    procesoEliminado: false, setupSolapable: false, grupoDivisionId: null,
    ...o,
  }
}

const corte = '2026-07-04' // sábado

describe('materialSimulacion', () => {
  it('convierte un proceso planificado de presente/futuro en un item', () => {
    const mat = materialSimulacion([proc({})], new Map([[10, 1]]), personal, [], corte)
    expect(mat.items).toHaveLength(1)
    expect(mat.items[0]).toMatchObject({
      id: 1, operarioId: 3, maquinaId: 5, inicio: { fecha: '2026-07-06', min: 360 },
    })
  })

  it('arma un contexto por cada operario del tablero', () => {
    const mat = materialSimulacion([], new Map(), personal, [], corte)
    expect(mat.ctxs.has(3)).toBe(true)
  })

  it('excluye los procesos pasados (terminaron antes del corte)', () => {
    // Miércoles 01 06:00–08:00, todo antes del corte del sábado 04
    const mat = materialSimulacion([proc({ planFecha: '2026-07-01' })], new Map([[10, 1]]), personal, [], corte)
    expect(mat.items).toHaveLength(0)
  })

  it('excluye los procesos sin planificar', () => {
    const mat = materialSimulacion([proc({ planFecha: null })], new Map([[10, 1]]), personal, [], corte)
    expect(mat.items).toHaveLength(0)
  })
})
