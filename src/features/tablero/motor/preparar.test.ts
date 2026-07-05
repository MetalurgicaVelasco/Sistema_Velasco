import { describe, it, expect } from 'vitest'
import { contextoOperario, ensamblarBloque } from './preparar'
import type { ProcesoTablero, PersonalTablero, Vacacion } from '../tipos'

const operario: PersonalTablero = {
  id: 3, nombre: 'Test', apellido: null,
  horarioEntrada: '06:00:00', horarioSalida: '15:00:00',
  horarioSabadoInicio: '07:00:00', horarioSabadoFin: '12:00:00',
  colorBorde: null, ordenTablero: null,
}

function proc(o: Partial<ProcesoTablero>): ProcesoTablero {
  return {
    id: 1, elementoId: 1, orden: 1, tipoProcesoId: null, procesoOtro: null,
    modo: 'manual', setupMin: 60, operacionMin: 100, margenMin: 30,
    maquinaId: null, maquinaOtra: null, operarioId: null, detalleTrabajo: null,
    esRetrabajo: false,
    estado: 'planificado', planFecha: '2026-07-06', planHora: '06:00:00',
    planOperarioId: 3, planMaquinaId: 5, planAceptado: null,
    realFechaInicio: null, realHoraInicio: null, realFechaFin: null, realHoraFin: null,
    procesoEliminado: false, setupSolapable: false, grupoDivisionId: null,
    ...o,
  }
}

describe('contextoOperario — esVacaciones', () => {
  const vac: Vacacion[] = [{ id: 1, personalId: 3, desde: '2026-07-10', hasta: '2026-07-15' }]
  const ctx = contextoOperario(operario, vac)

  it('true dentro del rango (bordes incluidos)', () => {
    expect(ctx.esVacaciones('2026-07-12')).toBe(true)
    expect(ctx.esVacaciones('2026-07-10')).toBe(true)
    expect(ctx.esVacaciones('2026-07-15')).toBe(true)
  })
  it('false fuera del rango', () => {
    expect(ctx.esVacaciones('2026-07-09')).toBe(false)
    expect(ctx.esVacaciones('2026-07-16')).toBe(false)
  })
  it('ignora vacaciones de otro operario', () => {
    const ctxOtro = contextoOperario(operario, [{ id: 2, personalId: 99, desde: '2026-07-10', hasta: '2026-07-15' }])
    expect(ctxOtro.esVacaciones('2026-07-12')).toBe(false)
  })
})

describe('ensamblarBloque', () => {
  const ctx = contextoOperario(operario, [])

  it('manual: operario y máquina ocupan lo mismo (todo el bloque)', () => {
    // setup 60 + 3×100 + 30 = 390. Lunes 06:00 (360) + 390 = 12:30 (750)
    const b = ensamblarBloque(proc({ modo: 'manual' }), ctx, 3)
    expect(b.intervaloMaquina).toEqual({ inicio: { fecha: '2026-07-06', min: 360 }, fin: { fecha: '2026-07-06', min: 750 } })
    expect(b.intervaloOperario).toEqual({ inicio: { fecha: '2026-07-06', min: 360 }, fin: { fecha: '2026-07-06', min: 750 } })
    expect(b).toMatchObject({ id: 1, operarioId: 3, maquinaId: 5, modo: 'manual' })
  })

  it('automatica: el operario solo ocupa el setup; la máquina, todo', () => {
    const b = ensamblarBloque(proc({ modo: 'automatica' }), ctx, 3)
    // operario = setup 60 → 07:00 (420)
    expect(b.intervaloOperario.fin).toEqual({ fecha: '2026-07-06', min: 420 })
    // máquina = setup (jornada) + resto 24/7 → 12:30 (750)
    expect(b.intervaloMaquina.fin).toEqual({ fecha: '2026-07-06', min: 750 })
  })

  it('usa la cantidad del elemento cuando no hay snapshot', () => {
    // cantidad 5 → 60 + 5×100 + 30 = 590. Lunes 06:00: usa 540 (hasta 15:00), quedan 50 → martes 06:50
    const b = ensamblarBloque(proc({ modo: 'manual' }), ctx, 5)
    expect(b.intervaloMaquina.fin).toEqual({ fecha: '2026-07-07', min: 410 })
  })

  it('falla si el proceso no está completamente planificado', () => {
    expect(() => ensamblarBloque(proc({ planFecha: null }), ctx, 3)).toThrow()
  })
})
