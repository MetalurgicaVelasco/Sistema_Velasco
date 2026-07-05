// features/tablero/motor/modos.ts
// -----------------------------------------------------------------------------
// Reglas de comportamiento de cada modo de proceso, en UN solo lugar.
//
// Toda la lógica del motor (duraciones y "caminar") consulta estas reglas en vez
// de tener `if (modo === 'automatica')` repartidos por el código. Si mañana hay
// que cambiar cómo se comporta un modo —por ejemplo, que una semi también corra
// de noche—, se edita esta tabla y el motor entero lo respeta.
//
// Está preparado para mudarse a la tabla `configuraciones` (o a un módulo de
// Configuraciones) sin tocar el resto: solo cambiaría de dónde se lee REGLAS_MODO.
// -----------------------------------------------------------------------------

import type { ModoProceso } from '../../produccion/procesoTipos'

export type ReglaModo = {
  // ¿La máquina sigue trabajando fuera de la jornada (noche, sábado, domingo)?
  // true = corre 24/7 (una CNC automática que queda cortando sola).
  maquina247: boolean
  // ¿El operario queda libre después del setup?
  // true = solo ocupa el setup; false = ocupa todo el bloque (caso manual).
  operarioSoloSetup: boolean
}

export const REGLAS_MODO: Record<ModoProceso, ReglaModo> = {
  manual:          { maquina247: false, operarioSoloSetup: false },
  semi_automatica: { maquina247: false, operarioSoloSetup: true },
  automatica:      { maquina247: true,  operarioSoloSetup: true },
}

// Regla de un modo, con fallback seguro a 'manual' si llegara un valor inesperado.
export function reglaDe(modo: ModoProceso): ReglaModo {
  return REGLAS_MODO[modo] ?? REGLAS_MODO.manual
}
