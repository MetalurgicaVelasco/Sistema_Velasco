// features/produccion/dominioElemento.ts
// -----------------------------------------------------------------------------
// Los elementos de un proyecto forman un ÁRBOL (cada uno cuelga de un solo padre)
// y viven en la tabla `elementos`. Este adaptador parametriza la tabla y el
// "contexto de raíz" para que la lógica del árbol no tenga nombres de tabla
// sueltos dando vueltas.
//
// OJO: el catálogo (matriz de productos) NO usa este adaptador. Allá una pieza
// es reutilizable y participa en varios conjuntos con cantidades distintas: es un
// GRAFO de composición (tabla `composicion_matriz`), no un árbol. Su capa de datos
// vive en `matrizApi.ts`.
// -----------------------------------------------------------------------------

/* eslint-disable @typescript-eslint/no-explicit-any */

export type DominioElemento = {
  /** Nombre de la tabla en Supabase. */
  tabla: string
  /** Columnas a traer en los SELECT. */
  columnas: string
  /** Bucket de Storage donde van las fotos. */
  bucket: string
  /** Prefijo de la ruta de la foto dentro del bucket. */
  prefijoFoto: string
  /**
   * Aplica el filtro que define las RAÍCES del árbol. `contextoId` es el
   * proyecto (en proyectos) y se ignora en la matriz.
   */
  filtroRaices: (q: any, contextoId: number) => any
  /**
   * Campos extra al persistir: los que existen en una tabla y no en la otra.
   * Recibe el contexto (proyecto) y el estado del draft.
   */
  camposExtra: (contextoId: number, estadoDraft: string) => Record<string, unknown>
}

const COLUMNAS_COMUNES =
  'id, parent_elemento_id, tipo, descripcion, cantidad, material_id, ' +
  'presentacion_mat_prima, codigo_cliente, fecha_fin_estipulada, foto_url, ' +
  'es_retrabajo, es_dispositivo'

// Elementos que viven dentro de un proyecto. Tienen proyecto_id y estado físico.
export const DOMINIO_PROYECTO: DominioElemento = {
  tabla: 'elementos',
  columnas: `${COLUMNAS_COMUNES}, proyecto_id, estado`,
  bucket: 'proyectos-fotos',
  prefijoFoto: 'items',
  filtroRaices: (q, proyectoId) => q.eq('proyecto_id', proyectoId).is('parent_elemento_id', null),
  camposExtra: (proyectoId, estadoDraft) => ({ proyecto_id: proyectoId, estado: estadoDraft }),
}
