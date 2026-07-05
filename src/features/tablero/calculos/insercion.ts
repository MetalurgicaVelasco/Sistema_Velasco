// features/tablero/calculos/insercion.ts
// -----------------------------------------------------------------------------
// Snapeo del drop a los hitos del operario. Traducción fiel de la lógica de
// inserción de 5 casos del tablero viejo (calcInsertTimeForOp): al soltar en un
// minuto, el bloque se pega al hito más cercano (inicio de jornada, inicio de un
// bloque, o fin de un bloque + gap) según en qué mitad caíste.
//
// Recibe las OCUPACIONES del operario ese día (los intervalos donde está
// realmente ocupado: para una automática, solo su setup). No conoce el ancho
// visual del bloque; eso lo resuelve quien arma las ocupaciones.
// -----------------------------------------------------------------------------

export type Ocupacion = { inicio: number; fin: number }

export function snapearInsercion(
  dropMin: number,
  ocupaciones: Ocupacion[],
  inicioJornada: number,
  gap: number,
): number {
  const blocks = [...ocupaciones].sort((a, b) => a.inicio - b.inicio)
  if (blocks.length === 0) return inicioJornada

  // Caso 1: soltás antes del primer bloque.
  if (dropMin < blocks[0].inicio) {
    if (blocks[0].inicio > inicioJornada + gap) {
      const mid = (inicioJornada + blocks[0].inicio) / 2
      return dropMin <= mid ? inicioJornada : blocks[0].inicio
    }
    return blocks[0].inicio
  }
  // Caso 2: justo en el inicio del primer bloque.
  if (dropMin === blocks[0].inicio) return blocks[0].inicio

  for (let i = 0; i < blocks.length; i++) {
    const bl = blocks[i]
    // Caso 3: dentro de un bloque → primera mitad antes, segunda mitad después.
    if (dropMin >= bl.inicio && dropMin < bl.fin) {
      const mid = (bl.inicio + bl.fin) / 2
      return dropMin <= mid ? bl.inicio : bl.fin + gap
    }
    // Caso 4: en el hueco hasta el bloque siguiente.
    const sig = blocks[i + 1]
    if (sig && dropMin >= bl.fin && dropMin < sig.inicio) {
      const mid = (bl.fin + sig.inicio) / 2
      return dropMin <= mid ? bl.fin + gap : sig.inicio
    }
  }
  // Caso 5: después del último bloque.
  return blocks[blocks.length - 1].fin + gap
}
