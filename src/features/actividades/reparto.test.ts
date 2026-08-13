import { describe, it, expect } from 'vitest'
import {
  repartirParejo,
  sumaDe,
  fijarValor,
  moverBorde,
  moverSegmento,
  agregarTipo,
  quitarTipo,
  aPaso,
  type Segmento,
} from './reparto'

// Lo que nunca puede fallar: el reparto tiene que sumar exactamente el total.
const TOTAL = 173

describe('repartirParejo', () => {
  it('reparte parejo y la suma da el total', () => {
    const segs = repartirParejo(['PR', 'SE', 'OP'], 90)
    expect(segs.map((s) => s.min)).toEqual([30, 30, 30])
    expect(sumaDe(segs)).toBe(90)
  })

  it('con un total no divisible, el resto va al primero y la suma cierra', () => {
    const segs = repartirParejo(['PR', 'SE', 'OP'], TOTAL)
    expect(sumaDe(segs)).toBe(TOTAL)
    expect(segs[0].min).toBeGreaterThanOrEqual(segs[1].min)
  })

  it('un solo tipo se lleva todo', () => {
    expect(repartirParejo(['OP'], TOTAL)).toEqual([{ tipo: 'OP', min: TOTAL }])
  })

  it('sin tipos no hay segmentos', () => {
    expect(repartirParejo([], TOTAL)).toEqual([])
  })
})

describe('fijarValor', () => {
  const base: Segmento[] = [
    { tipo: 'PR', min: 30 },
    { tipo: 'SE', min: 40 },
    { tipo: 'OP', min: 50 },
  ]

  it('lo que uno crece, el de la derecha se achica', () => {
    const r = fijarValor(base, 0, 50)
    expect(r.map((s) => s.min)).toEqual([50, 20, 50])
    expect(sumaDe(r)).toBe(sumaDe(base))
  })

  it('el último se ajusta contra el de la izquierda', () => {
    const r = fijarValor(base, 2, 60)
    expect(r.map((s) => s.min)).toEqual([30, 30, 60])
    expect(sumaDe(r)).toBe(sumaDe(base))
  })

  it('no deja pedir más de lo que hay entre los dos vecinos', () => {
    const r = fijarValor(base, 0, 999)
    expect(r.map((s) => s.min)).toEqual([70, 0, 50])
    expect(sumaDe(r)).toBe(sumaDe(base))
  })

  it('no deja valores negativos', () => {
    const r = fijarValor(base, 1, -20)
    expect(r.map((s) => s.min)).toEqual([30, 0, 90])
    expect(sumaDe(r)).toBe(sumaDe(base))
  })

  it('con un solo segmento no cambia nada', () => {
    const uno: Segmento[] = [{ tipo: 'OP', min: TOTAL }]
    expect(fijarValor(uno, 0, 10)).toEqual(uno)
  })
})

describe('moverBorde', () => {
  const base: Segmento[] = [
    { tipo: 'PR', min: 30 },
    { tipo: 'SE', min: 40 },
  ]

  it('mueve el marcador entre dos segmentos', () => {
    const r = moverBorde(base, 0, 10)
    expect(r.map((s) => s.min)).toEqual([40, 30])
    expect(sumaDe(r)).toBe(70)
  })

  it('mover hacia atrás también mantiene el total', () => {
    const r = moverBorde(base, 0, -25)
    expect(r.map((s) => s.min)).toEqual([5, 65])
    expect(sumaDe(r)).toBe(70)
  })

  it('el último borde no existe: no hace nada', () => {
    expect(moverBorde(base, 1, 10)).toEqual(base)
  })
})

describe('moverSegmento (reordenar)', () => {
  const base: Segmento[] = [
    { tipo: 'PR', min: 10 },
    { tipo: 'SE', min: 20 },
    { tipo: 'OP', min: 30 },
  ]

  it('mueve un segmento de lugar sin cambiar los tiempos', () => {
    const r = moverSegmento(base, 2, 0)
    expect(r.map((s) => s.tipo)).toEqual(['OP', 'PR', 'SE'])
    expect(r.map((s) => s.min)).toEqual([30, 10, 20])
    expect(sumaDe(r)).toBe(60)
  })

  it('al mismo lugar no cambia nada', () => {
    expect(moverSegmento(base, 1, 1)).toEqual(base)
  })
})

describe('agregarTipo / quitarTipo', () => {
  const base: Segmento[] = [
    { tipo: 'PR', min: 20 },
    { tipo: 'OP', min: 80 },
  ]

  it('agregar le saca al más grande y el total no cambia', () => {
    const r = agregarTipo(base, 'SE', 100)
    expect(sumaDe(r)).toBe(100)
    expect(r.find((s) => s.tipo === 'SE')?.min).toBe(40)
    expect(r.find((s) => s.tipo === 'OP')?.min).toBe(40)
  })

  it('no agrega un tipo repetido', () => {
    expect(agregarTipo(base, 'OP', 100)).toEqual(base)
  })

  it('sobre una lista vacía, el tipo nuevo se lleva el total', () => {
    expect(agregarTipo([], 'OP', 100)).toEqual([{ tipo: 'OP', min: 100 }])
  })

  it('quitar pasa su tiempo al vecino y el total no cambia', () => {
    const r = quitarTipo(base, 0)
    expect(r).toEqual([{ tipo: 'OP', min: 100 }])
    expect(sumaDe(r)).toBe(100)
  })

  it('quitar el único deja el reparto vacío', () => {
    expect(quitarTipo([{ tipo: 'OP', min: 100 }], 0)).toEqual([])
  })
})

describe('aPaso', () => {
  it('redondea a saltos de 5 por defecto', () => {
    expect(aPaso(12)).toBe(10)
    expect(aPaso(13)).toBe(15)
    expect(aPaso(0)).toBe(0)
  })
})
