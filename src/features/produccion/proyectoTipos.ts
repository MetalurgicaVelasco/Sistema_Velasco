// Tipos, catálogos y helpers del dominio Proyecto.
// Se comparten entre la lista (Proyectos.tsx) y la vista de formulario
// (VistaProyectoForm.tsx).

export const URGENCIAS = ['urgente', 'alta', 'media', 'baja']
export const SUB_ESTADOS_CERRADO = ['Enviado', 'Stockeado', 'Terminado']
export const MONEDAS = ['ARS', 'USD']

// Estados con los que se puede CREAR un proyecto (los de entrada).
export const ESTADOS_INICIALES = [
  'Proyectando',
  'Solicitud',
  'Pedido',
  'Mantenimiento',
]

// Máquina de estados: desde cada estado, a cuáles se puede pasar
// (incluye quedarse en el mismo). Sacada del sistema viejo.
export const TRANSICIONES: Record<string, string[]> = {
  Proyectando: ['Proyectando', 'Solicitud', 'Pedido', 'Mantenimiento', 'Perdido'],
  Solicitud: ['Solicitud', 'Proyectando', 'Pedido', 'Perdido'],
  Pedido: ['Pedido', 'Cerrado', 'Anulado'],
  Mantenimiento: ['Mantenimiento', 'Cerrado', 'Anulado'],
  Cerrado: ['Cerrado', 'Pedido'],
  Anulado: ['Anulado', 'Pedido'],
  Perdido: ['Perdido', 'Pedido'],
}

// Estados "confirmados": en estos tiene sentido el Nº de pedido.
export function estadoConfirmado(estado: string): boolean {
  return ['Pedido', 'Mantenimiento', 'Cerrado', 'Anulado'].includes(estado)
}

export type Empresa = { id: number; nombre: string }
export type Alicuota = { id: number; porcentaje: number }
export type ContactoMin = { id: number; nombre: string; apellido: string | null }

export type Proyecto = {
  id: number
  empresa_id: number
  contacto_id: number | null
  pedido_nro: string | null
  descripcion: string
  urgencia: string
  estado: string
  sub_estado_cerrado: string | null
  fecha_ingreso: string | null
  fecha_entrega: string | null
  fecha_limite_cotizar: string | null
  paso_por_solicitud: boolean
  observaciones_mail: string | null
  observaciones_anulacion: string | null
  cliente_final_empresa_id: number | null
  cliente_final_texto: string | null
  importe: number | null
  moneda: string | null
  iva_id: number | null
  oc_cliente: string | null
  foto_url: string | null
  empresa: { nombre: string } | null
}

export type ProyectoForm = {
  empresaId: number | null
  contactoId: number | null
  pedidoNro: string
  descripcion: string
  urgencia: string
  estado: string
  subEstadoCerrado: string
  fechaIngreso: string
  fechaEntrega: string
  fechaLimiteCotizar: string
  pasoPorSolicitud: boolean
  observacionesMail: string
  observacionesAnulacion: string
  cfHabilitado: boolean
  cfLibre: boolean
  cfEmpresaId: number | null
  cfTexto: string
  importe: string
  moneda: string
  ivaId: number | null
  ocCliente: string
}

// Fecha de hoy en formato ISO (YYYY-MM-DD) para el default de ingreso.
function hoyIso(): string {
  return new Date().toISOString().slice(0, 10)
}

export function formVacio(): ProyectoForm {
  return {
    empresaId: null,
    contactoId: null,
    pedidoNro: '',
    descripcion: '',
    urgencia: 'media',
    estado: 'Proyectando',
    subEstadoCerrado: '',
    fechaIngreso: hoyIso(),
    fechaEntrega: '',
    fechaLimiteCotizar: '',
    pasoPorSolicitud: false,
    observacionesMail: '',
    observacionesAnulacion: '',
    cfHabilitado: false,
    cfLibre: false,
    cfEmpresaId: null,
    cfTexto: '',
    importe: '',
    moneda: 'ARS',
    ivaId: null,
    ocCliente: '',
  }
}

export function proyectoAForm(p: Proyecto): ProyectoForm {
  return {
    empresaId: p.empresa_id,
    contactoId: p.contacto_id,
    pedidoNro: p.pedido_nro ?? '',
    descripcion: p.descripcion,
    urgencia: p.urgencia,
    estado: p.estado,
    subEstadoCerrado: p.sub_estado_cerrado ?? '',
    fechaIngreso: p.fecha_ingreso ?? '',
    fechaEntrega: p.fecha_entrega ?? '',
    fechaLimiteCotizar: p.fecha_limite_cotizar ?? '',
    pasoPorSolicitud: p.paso_por_solicitud,
    observacionesMail: p.observaciones_mail ?? '',
    observacionesAnulacion: p.observaciones_anulacion ?? '',
    cfHabilitado:
      p.cliente_final_empresa_id != null || p.cliente_final_texto != null,
    cfLibre: p.cliente_final_texto != null,
    cfEmpresaId: p.cliente_final_empresa_id,
    cfTexto: p.cliente_final_texto ?? '',
    importe: p.importe != null ? String(p.importe) : '',
    moneda: p.moneda ?? 'ARS',
    ivaId: p.iva_id,
    ocCliente: p.oc_cliente ?? '',
  }
}

// Convierte el form al objeto que va a la base. No incluye foto_url:
// la foto se maneja aparte (después de tener el id del proyecto).
export function formAGuardar(f: ProyectoForm) {
  const esAnulOPerd = f.estado === 'Anulado' || f.estado === 'Perdido'
  return {
    empresa_id: f.empresaId,
    contacto_id: f.contactoId,
    pedido_nro: f.pedidoNro.trim() || null,
    descripcion: f.descripcion.trim(),
    urgencia: f.urgencia,
    estado: f.estado,
    sub_estado_cerrado: f.estado === 'Cerrado' ? f.subEstadoCerrado || null : null,
    fecha_ingreso: f.fechaIngreso || null,
    fecha_entrega: f.fechaEntrega || null,
    fecha_limite_cotizar: f.fechaLimiteCotizar || null,
    paso_por_solicitud: f.pasoPorSolicitud,
    observaciones_mail: f.observacionesMail.trim() || null,
    observaciones_anulacion: esAnulOPerd
      ? f.observacionesAnulacion.trim() || null
      : null,
    cliente_final_empresa_id: f.cfHabilitado && !f.cfLibre ? f.cfEmpresaId : null,
    cliente_final_texto:
      f.cfHabilitado && f.cfLibre ? f.cfTexto.trim() || null : null,
    importe: f.importe.trim() ? Number(f.importe) : null,
    moneda: f.moneda || null,
    iva_id: f.ivaId,
    oc_cliente: f.ocCliente.trim() || null,
  }
}

export function fechaCorta(iso: string | null): string {
  if (!iso) return '—'
  const [a, m, d] = iso.split('-')
  return `${d}/${m}/${a}`
}
