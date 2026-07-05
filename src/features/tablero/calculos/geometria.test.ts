import { describe, it, expect } from 'vitest'
import { porcentajeLeft, porcentajeAncho, asignarTracks, type FragmentoBase } from './geometria'

// Ventana 06:00–17:00 → inicio 360, total 660 (como el tablero viejo).
const INI = 360
const TOTAL = 660

describe('porcentajeLeft / porcentajeAncho', () => {
  it('el inicio de la ventana es 0%', () => {
    expect(porcentajeLeft(360, INI, TOTAL)).toBe(0)
  })
  it('la mitad de la ventana es 50%', () => {
    expect(porcentajeLeft(690, INI, TOTAL)).toBeCloseTo(50) // 11:30
  })
  it('nunca es negativo (antes de la ventana → 0)', () => {
    expect(porcentajeLeft(300, INI, TOTAL)).toBe(0)
  })
  it('el ancho es proporcional a la ventana', () => {
    expect(porcentajeAncho(660, TOTAL)).toBe(100)
    expect(porcentajeAncho(330, TOTAL)).toBeCloseTo(50)
  })
})

// Fragmento de prueba (un día por defecto: lunes).
function frag(o: Partial<FragmentoBase> & { procesoId: number }): FragmentoBase {
  return {
    operarioId: 3, esAuto: false, fecha: '2026-07-06', inicioMin: 360, finMin: 600,
    ...o,
  }
}

describe('asignarTracks', () => {
  it('una manual va al carril 0', () => {
    const r = asignarTracks([frag({ procesoId: 1 })])
    expect(r[0].track).toBe(0)
  })

  it('una manual y una automática que se solapan → carriles 0 y 1', () => {
    const r = asignarTracks([
      frag({ procesoId: 1, esAuto: false, inicioMin: 360, finMin: 600 }),
      frag({ procesoId: 2, esAuto: true, inicioMin: 400, finMin: 700 }),
    ])
    expect(r.find((f) => f.procesoId === 1)!.track).toBe(0)
    expect(r.find((f) => f.procesoId === 2)!.track).toBe(1)
  })

  it('dos automáticas simultáneas → carriles 1 y 2', () => {
    const r = asignarTracks([
      frag({ procesoId: 1, esAuto: true, inicioMin: 360, finMin: 600 }),
      frag({ procesoId: 2, esAuto: true, inicioMin: 400, finMin: 700 }),
    ])
    expect(r.find((f) => f.procesoId === 1)!.track).toBe(1)
    expect(r.find((f) => f.procesoId === 2)!.track).toBe(2)
  })

  it('un proceso multi-día mantiene el mismo carril todos los días', () => {
    const r = asignarTracks([
      frag({ procesoId: 1, esAuto: true, fecha: '2026-07-06', inicioMin: 360, finMin: 900 }),
      frag({ procesoId: 1, esAuto: true, fecha: '2026-07-07', inicioMin: 360, finMin: 420 }),
    ])
    const tracks = r.map((f) => f.track)
    expect(tracks[0]).toBe(tracks[1])
  })

  it('operarios distintos se asignan de forma independiente', () => {
    const r = asignarTracks([
      frag({ procesoId: 1, operarioId: 3, esAuto: false }),
      frag({ procesoId: 2, operarioId: 4, esAuto: false }),
    ])
    expect(r.find((f) => f.procesoId === 1)!.track).toBe(0)
    expect(r.find((f) => f.procesoId === 2)!.track).toBe(0)
  })
})
