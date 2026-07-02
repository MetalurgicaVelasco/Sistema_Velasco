import { supabase } from '../../shared/lib/supabaseClient'

// Los 10 estados físicos del item (mismo orden que el flujo del taller).
export const ESTADOS_ITEM = [
  'Espera MP',
  'Llegó MP',
  'Proceso',
  'Enviar a TT',
  'TT',
  'Llegó TT',
  'Terminado',
  'Enviado',
  'Stockeado',
  'Anulado',
] as const

export type Material = { id: number; nombre: string }

// Fila de la tabla items tal como vuelve de la base (solo lo que usa el form).
export type Item = {
  id: number
  proyecto_id: number
  tipo: string
  descripcion: string
  cantidad: number | null
  material_id: number | null
  presentacion_mat_prima: string | null
  codigo_cliente: string | null
  fecha_fin_estipulada: string | null
  foto_url: string | null
  estado: string
  es_retrabajo: boolean
  es_dispositivo: boolean
}

// Borrador del item que vive en el estado del form del proyecto. Puede ya
// existir en la base (dbId != null) o ser nuevo (dbId == null). La foto se
// retiene como archivo y se sube recién al guardar el proyecto.
export type ItemDraft = {
  key: string // clave estable para React (solo cliente)
  dbId: number | null
  descripcion: string
  cantidad: string
  estado: string
  codigoCliente: string
  materialId: number | null
  presentacionMatPrima: string
  fechaFinEstipulada: string
  esRetrabajo: boolean
  esDispositivo: boolean
  fotoUrl: string | null // path ya guardado en Storage (o null)
  fotoArchivo: File | null // foto nueva sin subir
  fotoPreview: string | null // objectURL de la foto nueva
}

let contadorKey = 0
function nuevaKey() {
  contadorKey += 1
  return `it_${Date.now()}_${contadorKey}`
}

export function itemDraftVacio(): ItemDraft {
  return {
    key: nuevaKey(),
    dbId: null,
    descripcion: '',
    cantidad: '1',
    estado: 'Espera MP',
    codigoCliente: '',
    materialId: null,
    presentacionMatPrima: '',
    fechaFinEstipulada: '',
    esRetrabajo: false,
    esDispositivo: false,
    fotoUrl: null,
    fotoArchivo: null,
    fotoPreview: null,
  }
}

export function itemRowADraft(row: Item): ItemDraft {
  return {
    key: nuevaKey(),
    dbId: row.id,
    descripcion: row.descripcion ?? '',
    cantidad: row.cantidad != null ? String(row.cantidad) : '1',
    estado: row.estado ?? 'Espera MP',
    codigoCliente: row.codigo_cliente ?? '',
    materialId: row.material_id,
    presentacionMatPrima: row.presentacion_mat_prima ?? '',
    fechaFinEstipulada: row.fecha_fin_estipulada ?? '',
    esRetrabajo: !!row.es_retrabajo,
    esDispositivo: !!row.es_dispositivo,
    fotoUrl: row.foto_url,
    fotoArchivo: null,
    fotoPreview: null,
  }
}

// Duplica un item: copia los datos pero como item nuevo y sin foto.
export function duplicarDraft(d: ItemDraft): ItemDraft {
  return {
    ...d,
    key: nuevaKey(),
    dbId: null,
    fotoUrl: null,
    fotoArchivo: null,
    fotoPreview: null,
  }
}

// Objeto para insertar/actualizar en items. La foto nueva se sube aparte
// (necesita el id); foto_url va con lo que esté guardado o limpiado.
export function draftAGuardar(d: ItemDraft, proyectoId: number) {
  return {
    proyecto_id: proyectoId,
    parent_item_id: null,
    tipo: 'componente', // sin árbol todavía
    descripcion: d.descripcion.trim(),
    cantidad: d.cantidad.trim() ? Number(d.cantidad) : 1,
    material_id: d.materialId,
    presentacion_mat_prima: d.presentacionMatPrima.trim() || null,
    codigo_cliente: d.codigoCliente.trim() || null,
    fecha_fin_estipulada: d.fechaFinEstipulada || null,
    estado: d.estado,
    es_retrabajo: d.esRetrabajo,
    es_dispositivo: d.esDispositivo,
    foto_url: d.fotoUrl,
  }
}

// Alta de material en el catálogo. Devuelve la opción (para SelectorConAlta).
// Si el nombre ya existe (es único), devuelve el existente en vez de fallar.
export async function crearMaterial(nombre: string): Promise<Material | null> {
  const limpio = nombre.trim()
  if (!limpio) return null
  const { data, error } = await supabase
    .from('materiales')
    .insert({ nombre: limpio })
    .select('id, nombre')
    .single()
  if (!error && data) return data
  const { data: existente } = await supabase
    .from('materiales')
    .select('id, nombre')
    .eq('nombre', limpio)
    .maybeSingle()
  return existente ?? null
}
