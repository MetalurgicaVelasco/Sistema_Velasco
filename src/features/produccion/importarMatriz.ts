import { supabase } from '../../shared/lib/supabaseClient'
import { cargarComposicion, cargarElementoMatriz } from './matrizApi'
import { cargarProcesosDeElemento } from './procesosApi'
import { DOMINIO_PROCESO_MATRIZ } from './dominioProceso'

// -----------------------------------------------------------------------------
// Importar un producto de la Matriz a un proyecto (copia-snapshot, NEGOCIO §5).
//
// Crea un item nuevo con datos, procesos y correlatividades del producto de
// matriz, y toda su composición recursiva. El proyecto es ÁRBOL y la matriz un
// GRAFO reutilizable: un componente compartido se DUPLICA en cada lugar.
// Queda el vínculo histórico `imported_from_matriz_id` (no propaga cambios).
//
// Los campos del modal:
//  - estado + fechaFin se aplican a TODOS los items importados.
//  - presentación / esRetrabajo / esDispositivo se aplican solo al ITEM RAÍZ
//    (para un componente suelto). En un conjunto, los hijos toman lo del matriz.
//
// NO se copian ubicaciones (el proyecto no las modela) ni notas (aún no existen).
// -----------------------------------------------------------------------------

export type OpcionesImport = {
  cantidad: number
  fechaFin: string | null
  estado: string
  // Solo para el componente raíz; en conjunto/hijos van los valores del matriz.
  presentacion?: string | null
  esRetrabajo?: boolean
  esDispositivo?: boolean
}

type Overrides = {
  presentacion?: string | null
  esRetrabajo?: boolean
  esDispositivo?: boolean
}

export async function importarProductoMatriz(
  matrizElementoId: number,
  proyectoId: number,
  parentElementoId: number | null,
  opts: OpcionesImport,
): Promise<{ elementoId?: number; error?: string }> {
  try {
    const elementoId = await copiarElemento(
      matrizElementoId,
      proyectoId,
      parentElementoId,
      opts.cantidad,
      opts.estado,
      opts.fechaFin,
      { presentacion: opts.presentacion, esRetrabajo: opts.esRetrabajo, esDispositivo: opts.esDispositivo },
      new Set(),
    )
    return { elementoId }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'No se pudo importar el producto.' }
  }
}

// Copia UN elemento (con procesos + correlatividades) y baja su composición.
// `over` trae los overrides del item raíz; para los hijos va undefined (usan el
// matriz). `ancestros` corta un eventual ciclo.
async function copiarElemento(
  matrizId: number,
  proyectoId: number,
  parentId: number | null,
  cantidad: number,
  estado: string,
  fechaFin: string | null,
  over: Overrides | undefined,
  ancestros: Set<number>,
): Promise<number> {
  if (ancestros.has(matrizId)) {
    throw new Error('La composición tiene un ciclo; no se puede importar.')
  }

  const el = await cargarElementoMatriz(matrizId)
  if (!el) throw new Error('No se encontró el producto de matriz.')

  const { data: nuevo, error: eEl } = await supabase
    .from('elementos')
    .insert({
      proyecto_id: proyectoId,
      parent_elemento_id: parentId,
      tipo: el.tipo,
      descripcion: el.descripcion,
      cantidad,
      material_id: el.material_id,
      presentacion_mat_prima: over?.presentacion ?? el.presentacion_mat_prima,
      codigo_cliente: el.codigo_cliente,
      fecha_fin_estipulada: fechaFin,
      foto_url: el.foto_url,
      es_retrabajo: over?.esRetrabajo ?? false,
      es_dispositivo: over?.esDispositivo ?? el.es_dispositivo,
      estado,
      imported_from_matriz_id: matrizId,
    })
    .select('id')
    .single()
  if (eEl) throw new Error(eEl.message)
  const nuevoId = nuevo.id as number

  // Procesos (en orden) + correlatividades internas remapeadas.
  const { procesos, correlatividades } = await cargarProcesosDeElemento(matrizId, DOMINIO_PROCESO_MATRIZ)
  const mapProc = new Map<number, number>()
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

  // Composición: cada hijo con su cantidad; sin overrides (usan el matriz).
  const hijos = await cargarComposicion(matrizId)
  const sigAncestros = new Set(ancestros).add(matrizId)
  for (const h of hijos) {
    await copiarElemento(h.id, proyectoId, nuevoId, h.cantidad, estado, fechaFin, undefined, sigAncestros)
  }

  return nuevoId
}
