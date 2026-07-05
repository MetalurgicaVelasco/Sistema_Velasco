import { describe, it, expect } from 'vitest'
import { seSolapan, type Intervalo } from './solapes'

// Helper: intervalo dentro de un mismo día por defecto.
function iv(iniMin: number, finMin: number, fecha = '2026-07-06'): Intervalo {
  return { inicio: { fecha, min: iniMin }, fin: { fecha, min: finMin } }
}

describe('seSolapan — gap 0 (intersección pura)', () => {
  it('se superponen', () => {
    expect(seSolapan(iv(100, 200), iv(150, 250))).toBe(true)
  })
  it('uno contiene al otro', () => {
    expect(seSolapan(iv(100, 300), iv(150, 200))).toBe(true)
  })
  it('tocarse justo NO es pisarse', () => {
    // A termina en 200, B empieza en 200
    expect(seSolapan(iv(100, 200), iv(200, 300))).toBe(false)
  })
  it('separados no se pisan', () => {
    expect(seSolapan(iv(100, 200), iv(210, 300))).toBe(false)
  })
})

describe('seSolapan — con gap', () => {
  it('a menos de gap de distancia cuenta como conflicto', () => {
    // A termina 200, B empieza 205 → 5 min de separación, gap 10 → conflicto
    expect(seSolapan(iv(100, 200), iv(205, 300), 10)).toBe(true)
  })
  it('a más de gap está permitido', () => {
    // separación 15 > gap 10 → ok
    expect(seSolapan(iv(100, 200), iv(215, 300), 10)).toBe(false)
  })
  it('justo a gap de distancia está permitido', () => {
    // separación exacta = gap → NO conflicto (200+10 = 210, B empieza en 210)
    expect(seSolapan(iv(100, 200), iv(210, 300), 10)).toBe(false)
  })
})

describe('seSolapan — cruzando días', () => {
  it('un intervalo que cruza la medianoche se pisa con otro del día siguiente', () => {
    const a: Intervalo = { inicio: { fecha: '2026-07-06', min: 1400 }, fin: { fecha: '2026-07-07', min: 100 } }
    const b = iv(50, 200, '2026-07-07')
    expect(seSolapan(a, b)).toBe(true)
  })
  it('intervalos en días distintos que no se tocan', () => {
    const a = iv(100, 200, '2026-07-06')
    const b = iv(100, 200, '2026-07-08')
    expect(seSolapan(a, b)).toBe(false)
  })
})
