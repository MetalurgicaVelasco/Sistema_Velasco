import { supabase } from '../../shared/lib/supabaseClient'
import { cargarComposicion, cargarElementoMatriz } from './matrizApi'
import { cargarProcesosDeElemento } from './procesosApi'
import { DOMINIO_PROCESO_MATRIZ } from './dominioProceso'

// -----------------------------------------------------------------------------
// Importar un producto de la Matriz a un proyecto.
//
// Es una COPIA-SNAPSHOT independiente (NEGOCIO §5): se crea un item nuevo con los
// datos, procesos y correlatividades del producto de matriz, y toda su composición
// recursiva. Como el proyecto es un ÁRBOL y la matriz un GRAFO reutilizable, un
// componente compartido se DUPLICA en cada lugar donde aparece.
//
// Queda el vínculo histórico `imported_from_matriz_id` (no propaga cambios: una vez
// importado, el item es independiente del producto de matriz).
//
// NO se copian ubicaciones (el proyecto no las modela) ni notas (aún no existen).
// -----------------------------------------------------------------------------

export async function importarProductoMatriz(
  matrizElementoId: number,
  proyectoId: number,
  parentElementoId: number | null,
  cantidad: number,
): Promise<{ elementoId?: number; error?: string }> {
  try {
    const elementoId = await copiarElemento(
      matrizElementoId,
      proyectoId,
      parentElementoId,
      cantidad,
      new Set(),
    )
    return { elementoId }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'No se pudo importar el producto.' }
  }
}

// Copia UN elemento de matriz (con sus procesos + correlatividades) y baja
// recursivamente su composición. `ancestros` corta un eventual ciclo del grafo.
async function copiarElemento(
  matrizId: number,
  proyectoId: number,
  parentId: number | null,
  cantidad: number,
  ancestros: Set<number>,
): Promise<number> {
  if (ancestros.has(matrizId)) {
    throw new Error('La composición tiene un ciclo; no se puede importar.')
  }

  const el = await cargarElementoMatriz(matrizId)
  if (!el) throw new Error('No se encontró el producto de matriz.')

  // 1. Crear el item del proyecto (copia de datos + vínculo histórico).
  const { data: nuevo, error: eEl } = await supabase
    .from('elementos')
    .insert({
      proyecto_id: proyectoId,
      parent_elemento_id: parentId,
      tipo: el.tipo,
      descripcion: el.descripcion,
      cantidad,
      material_id: el.material_id,
      presentacion_mat_prima: el.presentacion_mat_prima,
      codigo_cliente: el.codigo_cliente,
      fecha_fin_estipulada: null,
      foto_url: el.foto_url,
      es_retrabajo: false,
      es_dispositivo: el.es_dispositivo,
      estado: 'Espera MP',
      imported_from_matriz_id: matrizId,
    })
    .select('id')
    .single()
  if (eEl) throw new Error(eEl.message)
  const nuevoId = nuevo.id as number

  // 2. Procesos (en orden) + correlatividades internas remapeadas.
  const { procesos, correlatividades } = await cargarProcesosDeElemento(matrizId, DOMINIO_PROCESO_MATRIZ)
  const mapProc = new Map<number, number>() // id de proceso matriz → id de proceso nuevo
  for (const p of procesos) {
    const { data: np, error: eP } = await supabase
      .from('procesos')
      .insert({
        elemento_id: nuevoId,
        orden: p.orden,
        tipo_proceso_id: p.tipoProcesoId,
        proceso_otro: p.procesoOtro,
        modo: p.modo,
        setup_min: p.setupMin,
        operacion_min: p.operacionMin,
        margen_min: p.margenMin,
        maquina_id: p.maquinaId,
        maquina_otra: p.maquinaOtra,
        operario_id: p.operarioId,
        detalle_trabajo: p.detalleTrabajo,
        es_retrabajo: false,
        estado: 'sin_planificar',
      })
      .select('id')
      .single()
    if (eP) throw new Error(eP.message)
    mapProc.set(p.id, np.id as number)
  }
  // Solo las correlatividades cuyos dos extremos son procesos de este elemento.
  const corrInserts = correlatividades
    .filter((c) => mapProc.has(c.predecesorId) && mapProc.has(c.sucesorId))
    .map((c) => ({
      predecesor_id: mapProc.get(c.predecesorId) as number,
      sucesor_id: mapProc.get(c.sucesorId) as number,
    }))
  if (corrInserts.length) {
    const { error: eC } = await supabase.from('correlatividades').insert(corrInserts)
    if (eC) throw new Error(eC.message)
  }

  // 3. Composición: bajar cada hijo con su cantidad (recursivo).
  const hijos = await cargarComposicion(matrizId)
  const sigAncestros = new Set(ancestros).add(matrizId)
  for (const h of hijos) {
    await copiarElemento(h.id, proyectoId, nuevoId, h.cantidad, sigAncestros)
  }

  return nuevoId
}
