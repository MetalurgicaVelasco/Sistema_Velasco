import { describe, it, expect } from 'vitest'
import { snapearInsercion, type Ocupacion } from './insercion'

const JORNADA = 360 // 06:00
const GAP = 10

describe('snapearInsercion', () => {
  it('celda vacía → inicio de jornada', () => {
    expect(snapearInsercion(500, [], JORNADA, GAP)).toBe(360)
  })

  describe('antes del primer bloque (bloque 08:00–10:00)', () => {
    const ocup: Ocupacion[] = [{ inicio: 480, fin: 600 }]
    it('primera mitad del hueco → inicio de jornada', () => {
      expect(snapearInsercion(400, ocup, JORNADA, GAP)).toBe(360)
    })
    it('segunda mitad del hueco → inicio del bloque', () => {
      expect(snapearInsercion(450, ocup, JORNADA, GAP)).toBe(480)
    })
  })

  describe('dentro de un bloque (08:00–10:00)', () => {
    const ocup: Ocupacion[] = [{ inicio: 480, fin: 600 }]
    it('primera mitad → inicio del bloque', () => {
      expect(snapearInsercion(510, ocup, JORNADA, GAP)).toBe(480) // 08:30
    })
    it('segunda mitad → fin del bloque + gap', () => {
      expect(snapearInsercion(570, ocup, JORNADA, GAP)).toBe(610) // 09:30 → 10:10
    })
  })

  describe('en el hueco entre dos bloques (08:00–09:00 y 10:00–11:00)', () => {
    const ocup: Ocupacion[] = [
      { inicio: 480, fin: 540 },
      { inicio: 600, fin: 660 },
    ]
    it('primera mitad → fin del anterior + gap', () => {
      expect(snapearInsercion(560, ocup, JORNADA, GAP)).toBe(550)
    })
    it('segunda mitad → inicio del siguiente', () => {
      expect(snapearInsercion(580, ocup, JORNADA, GAP)).toBe(600)
    })
  })

  it('después del último bloque → fin + gap', () => {
    const ocup: Ocupacion[] = [{ inicio: 480, fin: 600 }]
    expect(snapearInsercion(700, ocup, JORNADA, GAP)).toBe(610)
  })
})
