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

// En estos estados el plazo se expresa en días hábiles (todavía no hay
// fecha de entrega firme). En el resto se usa la fecha de entrega.
export function usaDiasHabiles(estado: string): boolean {
  return ['Proyectando', 'Solicitud', 'Perdido'].includes(estado)
}

export type Empresa = { id: number; nombre: string }
export type Alicuota = { id: number; porcentaje: number }
export type ContactoMin = {
  id: number
  nombre: string
  apellido: string | null
  empresa_id: number
}

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
  plazo_dias_habiles: number | null
  paso_por_solicitud: boolean
  observaciones_mail: string | null
  observaciones_anulacion: string | null
  cliente_final_empresa_id: number | null
  cliente_final_texto: string | null
  moneda: string | null
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
  plazoDiasHabiles: string
  pasoPorSolicitud: boolean
  observacionesMail: string
  observacionesAnulacion: string
  cfHabilitado: boolean
  cfLibre: boolean
  cfEmpresaId: number | null
  cfTexto: string
  moneda: string
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
    plazoDiasHabiles: '',
    pasoPorSolicitud: false,
    observacionesMail: '',
    observacionesAnulacion: '',
    cfHabilitado: false,
    cfLibre: false,
    cfEmpresaId: null,
    cfTexto: '',
    moneda: 'ARS',
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
    plazoDiasHabiles:
      p.plazo_dias_habiles != null ? String(p.plazo_dias_habiles) : '',
    pasoPorSolicitud: p.paso_por_solicitud,
    observacionesMail: p.observaciones_mail ?? '',
    observacionesAnulacion: p.observaciones_anulacion ?? '',
    cfHabilitado:
      p.cliente_final_empresa_id != null || p.cliente_final_texto != null,
    cfLibre: p.cliente_final_texto != null,
    cfEmpresaId: p.cliente_final_empresa_id,
    cfTexto: p.cliente_final_texto ?? '',
    moneda: p.moneda ?? 'ARS',
    ocCliente: p.oc_cliente ?? '',
  }
}

// Convierte el form al objeto que va a la base. No incluye foto_url:
// la foto se maneja aparte (después de tener el id del proyecto).
// Los campos que están deshabilitados según el estado se guardan en null
// (coherente con la regla de "limpiar cuando no corresponde").
export function formAGuardar(f: ProyectoForm) {
  const esAnulOPerd = f.estado === 'Anulado' || f.estado === 'Perdido'
  const confirmado = estadoConfirmado(f.estado)
  const diasHabiles = usaDiasHabiles(f.estado)
  return {
    empresa_id: f.empresaId,
    contacto_id: f.contactoId,
    pedido_nro: confirmado ? f.pedidoNro.trim() || null : null,
    descripcion: f.descripcion.trim(),
    urgencia: f.urgencia,
    estado: f.estado,
    sub_estado_cerrado: f.estado === 'Cerrado' ? f.subEstadoCerrado || null : null,
    fecha_ingreso: f.fechaIngreso || null,
    fecha_entrega: confirmado ? f.fechaEntrega || null : null,
    fecha_limite_cotizar: diasHabiles ? f.fechaLimiteCotizar || null : null,
    plazo_dias_habiles:
      diasHabiles && f.plazoDiasHabiles.trim()
        ? Number(f.plazoDiasHabiles)
        : null,
    paso_por_solicitud: f.pasoPorSolicitud,
    observaciones_mail: f.observacionesMail.trim() || null,
    observaciones_anulacion: esAnulOPerd
      ? f.observacionesAnulacion.trim() || null
      : null,
    cliente_final_empresa_id: f.cfHabilitado && !f.cfLibre ? f.cfEmpresaId : null,
    cliente_final_texto:
      f.cfHabilitado && f.cfLibre ? f.cfTexto.trim() || null : null,
    moneda: f.moneda || null,
    oc_cliente: f.ocCliente.trim() || null,
  }
}

export function fechaCorta(iso: string | null): string {
  if (!iso) return '—'
  const [a, m, d] = iso.split('-')
  return `${d}/${m}/${a}`
}

function aIsoLocal(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

// Suma n días hábiles a una fecha ISO. Hábil = lunes a sábado (el domingo
// no cuenta) salteando feriados. Devuelve fecha ISO. Los feriados llegarán
// de un módulo futuro; por ahora la lista va vacía.
export function sumarDiasHabiles(
  desdeIso: string,
  n: number,
  feriados: string[] = [],
): string {
  const [y, m, d] = desdeIso.split('-').map(Number)
  const fecha = new Date(y, m - 1, d)
  let contados = 0
  while (contados < n) {
    fecha.setDate(fecha.getDate() + 1)
    if (fecha.getDay() !== 0 && !feriados.includes(aIsoLocal(fecha))) {
      contados++
    }
  }
  return aIsoLocal(fecha)
}
