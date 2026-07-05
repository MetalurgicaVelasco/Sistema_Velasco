import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  fechaAISO, parseFecha, hoyISO, sumarDias, diaSemana,
  esSabado, esDomingo, esFinDeSemana, diffDias, compararFechas,
  horaAMin, minAHora,
} from './fechas'

describe('fechas — conversión ida y vuelta', () => {
  it('parseFecha y fechaAISO son inversas', () => {
    expect(fechaAISO(parseFecha('2026-07-05'))).toBe('2026-07-05')
    expect(fechaAISO(parseFecha('2026-01-01'))).toBe('2026-01-01')
    expect(fechaAISO(parseFecha('2026-12-31'))).toBe('2026-12-31')
  })

  it('parseFecha no se corre de día (mediodía local)', () => {
    expect(parseFecha('2026-07-05').getDate()).toBe(5)
    expect(parseFecha('2026-03-01').getDate()).toBe(1)
  })
})

describe('fechas — hoyISO no se adelanta de noche (bug histórico de zona horaria)', () => {
  afterEach(() => vi.useRealTimers())

  it('a las 22:30 locales devuelve la fecha de HOY, no la de mañana', () => {
    vi.useFakeTimers()
    // 5 de julio de 2026, 22:30 hora local del entorno.
    vi.setSystemTime(new Date(2026, 6, 5, 22, 30, 0))
    expect(hoyISO()).toBe('2026-07-05')
  })

  it('a las 00:30 locales devuelve el día que arranca', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 6, 5, 0, 30, 0))
    expect(hoyISO()).toBe('2026-07-05')
  })
})

describe('fechas — aritmética', () => {
  it('sumarDias cruza fin de mes', () => {
    expect(sumarDias('2026-07-31', 1)).toBe('2026-08-01')
    expect(sumarDias('2026-01-01', -1)).toBe('2025-12-31')
  })

  it('sumarDias cruza año bisiesto', () => {
    expect(sumarDias('2028-02-28', 1)).toBe('2028-02-29') // 2028 es bisiesto
  })

  it('diffDias cuenta bien', () => {
    expect(diffDias('2026-07-05', '2026-07-10')).toBe(5)
    expect(diffDias('2026-07-10', '2026-07-05')).toBe(-5)
    expect(diffDias('2026-07-05', '2026-07-05')).toBe(0)
  })

  it('compararFechas ordena', () => {
    expect(compararFechas('2026-07-05', '2026-07-10')).toBe(-1)
    expect(compararFechas('2026-07-10', '2026-07-05')).toBe(1)
    expect(compararFechas('2026-07-05', '2026-07-05')).toBe(0)
  })
})

describe('fechas — día de semana', () => {
  it('reconoce sábado y domingo', () => {
    // 2026-07-04 sábado, 2026-07-05 domingo, 2026-07-06 lunes.
    expect(esSabado('2026-07-04')).toBe(true)
    expect(esDomingo('2026-07-05')).toBe(true)
    expect(esFinDeSemana('2026-07-04')).toBe(true)
    expect(esFinDeSemana('2026-07-05')).toBe(true)
    expect(esFinDeSemana('2026-07-06')).toBe(false)
  })

  it('diaSemana: 0=domingo..6=sábado', () => {
    expect(diaSemana('2026-07-05')).toBe(0)
    expect(diaSemana('2026-07-06')).toBe(1)
    expect(diaSemana('2026-07-04')).toBe(6)
  })
})

describe('fechas — horas', () => {
  it('horaAMin parsea HH:MM y HH:MM:SS', () => {
    expect(horaAMin('06:00')).toBe(360)
    expect(horaAMin('17:30')).toBe(1050)
    expect(horaAMin('08:15:00')).toBe(495)
  })

  it('minAHora formatea con ceros', () => {
    expect(minAHora(360)).toBe('06:00')
    expect(minAHora(1050)).toBe('17:30')
    expect(minAHora(495)).toBe('08:15')
  })

  it('horaAMin y minAHora son inversas', () => {
    expect(minAHora(horaAMin('06:00'))).toBe('06:00')
    expect(minAHora(horaAMin('17:30'))).toBe('17:30')
  })
})
