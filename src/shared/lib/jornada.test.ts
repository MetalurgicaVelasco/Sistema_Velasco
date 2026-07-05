import { describe, it, expect } from 'vitest'
import { jornada, type HorarioOperario } from './jornada'

const conSabado: HorarioOperario = {
  horario_entrada: '06:00:00',
  horario_salida: '15:00:00',
  horario_sabado_inicio: '07:00:00',
  horario_sabado_fin: '12:00:00',
}

const sinSabado: HorarioOperario = {
  horario_entrada: '08:00:00',
  horario_salida: '17:00:00',
  horario_sabado_inicio: null,
  horario_sabado_fin: null,
}

describe('jornada — días de semana', () => {
  it('lunes usa el horario de semana', () => {
    // 2026-07-06 es lunes
    expect(jornada(conSabado, '2026-07-06')).toEqual({ trabaja: true, inicioMin: 360, finMin: 900 })
  })
})

describe('jornada — sábado', () => {
  it('con horario de sábado, usa ese horario (no el de semana)', () => {
    // 2026-07-04 es sábado
    expect(jornada(conSabado, '2026-07-04')).toEqual({ trabaja: true, inicioMin: 420, finMin: 720 })
  })

  it('sin horario de sábado cargado, no trabaja', () => {
    expect(jornada(sinSabado, '2026-07-04').trabaja).toBe(false)
  })
})

describe('jornada — domingo', () => {
  it('nadie trabaja el domingo', () => {
    // 2026-07-05 es domingo
    expect(jornada(conSabado, '2026-07-05').trabaja).toBe(false)
    expect(jornada(sinSabado, '2026-07-05').trabaja).toBe(false)
  })
})
