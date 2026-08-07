import { describe, it, expect } from 'vitest'
import {
  msTramo,
  totales,
  tramoAbierto,
  comoReloj,
  comoDuracion,
  horaDe,
  haySolape,
  type Tramo,
} from './tiempos'

function tramo(o: Partial<Tramo>): Tramo {
  return { id: 1, tipo: 'trabajo', inicio: '2026-08-05T10:00:00.000Z', fin: null, ...o }
}

const AHORA = Date.parse('2026-08-05T12:00:00.000Z')

describe('msTramo', () => {
  it('mide un tramo cerrado', () => {
    const t = tramo({ inicio: '2026-08-05T10:00:00.000Z', fin: '2026-08-05T10:30:00.000Z' })
    expect(msTramo(t, AHORA)).toBe(30 * 60000)
  })

  it('mide un tramo abierto contra ahora', () => {
    const t = tramo({ inicio: '2026-08-05T11:00:00.000Z', fin: null })
    expect(msTramo(t, AHORA)).toBe(60 * 60000)
  })

  it('nunca da negativo si el fin quedó antes del inicio', () => {
    const t = tramo({ inicio: '2026-08-05T11:00:00.000Z', fin: '2026-08-05T10:00:00.000Z' })
    expect(msTramo(t, AHORA)).toBe(0)
  })

  it('devuelve 0 con fechas inválidas', () => {
    expect(msTramo(tramo({ inicio: 'no-es-fecha' }), AHORA)).toBe(0)
  })
})

describe('totales', () => {
  it('separa trabajo de pausa', () => {
    const ts: Tramo[] = [
      tramo({ id: 1, tipo: 'trabajo', inicio: '2026-08-05T10:00:00.000Z', fin: '2026-08-05T10:40:00.000Z' }),
      tramo({ id: 2, tipo: 'pausa', inicio: '2026-08-05T10:40:00.000Z', fin: '2026-08-05T10:55:00.000Z' }),
      tramo({ id: 3, tipo: 'trabajo', inicio: '2026-08-05T10:55:00.000Z', fin: '2026-08-05T11:25:00.000Z' }),
    ]
    const r = totales(ts, AHORA)
    expect(r.trabajoMs).toBe(70 * 60000)
    expect(r.pausaMs).toBe(15 * 60000)
    expect(r.totalMs).toBe(85 * 60000)
    expect(r.hayAbierto).toBe(false)
  })

  it('marca que hay un tramo abierto y lo suma', () => {
    const ts: Tramo[] = [
      tramo({ id: 1, tipo: 'trabajo', inicio: '2026-08-05T11:30:00.000Z', fin: null }),
    ]
    const r = totales(ts, AHORA)
    expect(r.hayAbierto).toBe(true)
    expect(r.trabajoMs).toBe(30 * 60000)
  })

  it('sin tramos da todo en cero', () => {
    expect(totales([], AHORA)).toEqual({ trabajoMs: 0, pausaMs: 0, totalMs: 0, hayAbierto: false })
  })
})

describe('tramoAbierto', () => {
  it('encuentra el que no tiene fin', () => {
    const abierto = tramo({ id: 9, fin: null })
    expect(tramoAbierto([tramo({ id: 1, fin: '2026-08-05T10:30:00.000Z' }), abierto])?.id).toBe(9)
  })

  it('devuelve null si están todos cerrados', () => {
    expect(tramoAbierto([tramo({ fin: '2026-08-05T10:30:00.000Z' })])).toBeNull()
  })
})

describe('formatos', () => {
  it('comoReloj arma HH:MM:SS', () => {
    expect(comoReloj(0)).toBe('00:00:00')
    expect(comoReloj(65 * 1000)).toBe('00:01:05')
    expect(comoReloj((2 * 3600 + 3 * 60 + 9) * 1000)).toBe('02:03:09')
  })

  it('comoDuracion muestra horas y minutos', () => {
    expect(comoDuracion(45 * 60000)).toBe('45m')
    expect(comoDuracion((2 * 60 + 5) * 60000)).toBe('2h 05m')
  })

  it('horaDe tolera null y basura', () => {
    expect(horaDe(null)).toBe('--:--')
    expect(horaDe('cualquier cosa')).toBe('--:--')
  })
})

describe('haySolape', () => {
  it('no hay solape si van uno atrás del otro', () => {
    const ts: Tramo[] = [
      tramo({ id: 1, inicio: '2026-08-05T10:00:00.000Z', fin: '2026-08-05T10:30:00.000Z' }),
      tramo({ id: 2, inicio: '2026-08-05T10:30:00.000Z', fin: '2026-08-05T11:00:00.000Z' }),
    ]
    expect(haySolape(ts)).toBe(false)
  })

  it('detecta cuando se pisan', () => {
    const ts: Tramo[] = [
      tramo({ id: 1, inicio: '2026-08-05T10:00:00.000Z', fin: '2026-08-05T10:45:00.000Z' }),
      tramo({ id: 2, inicio: '2026-08-05T10:30:00.000Z', fin: '2026-08-05T11:00:00.000Z' }),
    ]
    expect(haySolape(ts)).toBe(true)
  })

  it('ignora los tramos abiertos', () => {
    const ts: Tramo[] = [
      tramo({ id: 1, inicio: '2026-08-05T10:00:00.000Z', fin: '2026-08-05T10:45:00.000Z' }),
      tramo({ id: 2, inicio: '2026-08-05T10:00:00.000Z', fin: null }),
    ]
    expect(haySolape(ts)).toBe(false)
  })
})
