// -----------------------------------------------------------------------------
// Reparto del tiempo de una actividad entre los tipos de operación.
//
// Se usa cuando el operario no fue marcando los tipos mientras trabajaba: al
// finalizar reparte el total de forma aproximada. La interacción es una barra
// con marcadores, y de acá salen los números.
//
// INVARIANTE: la suma de los segmentos SIEMPRE es igual al total. Por eso el
// ajuste es entre vecinos — lo que uno crece, el de al lado se achica. Así nunca
// sobra ni falta tiempo, sin recalcular nada.
//
// Todo en minutos enteros y sin base de datos: es lógica pura y testeable.
// -----------------------------------------------------------------------------

export type Segmento<T extends string = string> = { tipo: T; min: number }

// Reparte `total` entre los tipos, lo más parejo posible. El sobrante (por no
// ser divisible) se le da al primero, para que la suma cierre exacta.
export function repartirParejo<T extends string>(tipos: T[], total: number): Segmento<T>[] {
  if (!tipos.length) return []
  const base = Math.floor(total / tipos.length)
  const resto = total - base * tipos.length
  return tipos.map((tipo, i) => ({ tipo, min: base + (i === 0 ? resto : 0) }))
}

export function sumaDe(segs: Segmento[]): number {
  return segs.reduce((acc, s) => acc + s.min, 0)
}

// Fijar el valor de un segmento: la diferencia la absorbe el vecino de la
// derecha (o el de la izquierda si es el último). Es lo que pasa al arrastrar un
// marcador o al escribir el número a mano.
export function fijarValor<T extends string>(
  segs: Segmento<T>[],
  indice: number,
  nuevoMin: number,
): Segmento<T>[] {
  if (indice < 0 || indice >= segs.length) return segs
  if (segs.length === 1) return segs // con un solo tipo, se lleva todo el total

  const vecino = indice + 1 < segs.length ? indice + 1 : indice - 1
  const disponible = segs[indice].min + segs[vecino].min
  // No puede pedir más de lo que hay entre los dos, ni menos que cero.
  const valor = Math.max(0, Math.min(Math.round(nuevoMin), disponible))
  return segs.map((s, i) => {
    if (i === indice) return { ...s, min: valor }
    if (i === vecino) return { ...s, min: disponible - valor }
    return s
  })
}

// Mover el marcador que separa `indice` de `indice + 1`, en minutos.
export function moverBorde<T extends string>(
  segs: Segmento<T>[],
  indice: number,
  deltaMin: number,
): Segmento<T>[] {
  if (indice < 0 || indice + 1 >= segs.length) return segs
  return fijarValor(segs, indice, segs[indice].min + deltaMin)
}

// Reordenar: el operario puede cambiar el orden en que ocurrieron los tipos.
export function moverSegmento<T extends string>(
  segs: Segmento<T>[],
  desde: number,
  hasta: number,
): Segmento<T>[] {
  if (desde === hasta) return segs
  if (desde < 0 || desde >= segs.length || hasta < 0 || hasta >= segs.length) return segs
  const copia = [...segs]
  const [movido] = copia.splice(desde, 1)
  copia.splice(hasta, 0, movido)
  return copia
}

// Sumar un tipo: le saca tiempo al segmento más grande, así el total no cambia.
export function agregarTipo<T extends string>(
  segs: Segmento<T>[],
  tipo: T,
  total: number,
): Segmento<T>[] {
  if (segs.some((s) => s.tipo === tipo)) return segs
  if (!segs.length) return [{ tipo, min: total }]

  let mayor = 0
  for (let i = 1; i < segs.length; i++) if (segs[i].min > segs[mayor].min) mayor = i
  // La mitad del más grande, redondeando para abajo.
  const quita = Math.floor(segs[mayor].min / 2)
  const nuevos = segs.map((s, i) => (i === mayor ? { ...s, min: s.min - quita } : s))
  return [...nuevos, { tipo, min: quita }]
}

// Quitar un tipo: su tiempo pasa al vecino, así el total tampoco cambia.
export function quitarTipo<T extends string>(
  segs: Segmento<T>[],
  indice: number,
): Segmento<T>[] {
  if (indice < 0 || indice >= segs.length) return segs
  if (segs.length === 1) return [] // era el único: no queda reparto
  const suelto = segs[indice].min
  const vecino = indice + 1 < segs.length ? indice + 1 : indice - 1
  return segs
    .map((s, i) => (i === vecino ? { ...s, min: s.min + suelto } : s))
    .filter((_, i) => i !== indice)
}

// Redondear el arrastre a saltos de N minutos: con el dedo en una tablet no se
// puede apuntar al minuto exacto. Escribir el número a mano no pasa por acá.
export function aPaso(min: number, paso = 5): number {
  return Math.round(min / paso) * paso
}
