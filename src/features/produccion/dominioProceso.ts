// features/produccion/dominioProceso.ts
// -----------------------------------------------------------------------------
// Los procesos de un elemento tienen EXACTAMENTE el mismo modelo en los dos
// dominios del sistema, pero viven en tablas distintas:
//
//   - PROYECTO: `procesos` + `correlatividades`. Es la instancia que va al tablero:
//     además de la receta, guarda el estado, el plan y si es retrabajo.
//   - MATRIZ:   `procesos_matriz` + `correlatividades_matriz`. Es la RECETA canónica
//     de cómo se fabrica la pieza; no tiene estado ni plan ni retrabajo.
//
// Este adaptador parametriza las tablas y las columnas para que la lógica (orden,
// duplicar, correlatividades lineales) se escriba una sola vez.
// -----------------------------------------------------------------------------

export type DominioProceso = {
  /** Tabla de procesos. */
  tabla: string
  /** Tabla de correlatividades (predecesor → sucesor). */
  tablaCorrelatividades: string
  /** Columnas a traer en los SELECT. */
  columnas: string
  /** ¿La tabla tiene la columna `es_retrabajo`? (solo los de proyecto). */
  tieneRetrabajo: boolean
}

const COLUMNAS_COMUNES =
  'id, elemento_id, orden, tipo_proceso_id, proceso_otro, modo, setup_min, ' +
  'operacion_min, margen_min, maquina_id, maquina_otra, operario_id, detalle_trabajo'

// Procesos de un elemento de PROYECTO: la instancia planificable.
export const DOMINIO_PROCESO_PROYECTO: DominioProceso = {
  tabla: 'procesos',
  tablaCorrelatividades: 'correlatividades',
  columnas: `${COLUMNAS_COMUNES}, es_retrabajo`,
  tieneRetrabajo: true,
}

// Procesos de una pieza del CATÁLOGO: la receta de fabricación.
export const DOMINIO_PROCESO_MATRIZ: DominioProceso = {
  tabla: 'procesos_matriz',
  tablaCorrelatividades: 'correlatividades_matriz',
  columnas: COLUMNAS_COMUNES,
  tieneRetrabajo: false,
}
