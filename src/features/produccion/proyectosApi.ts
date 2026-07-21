import { supabase } from '../../shared/lib/supabaseClient'
import type { Proyecto } from './proyectoTipos'

// Estados posibles de un proyecto (para el desplegable de filtro).
export const ESTADOS_PROYECTO = [
  'Proyectando',
  'Solicitud',
  'Pedido',
  'Mantenimiento',
  'Cerrado',
  'Anulado',
  'Perdido',
]

// Presets del filtro de fecha de creación.
export const FECHA_PRESETS: { valor: string; label: string }[] = [
  { valor: 'todos', label: 'Todas las fechas' },
  { valor: 'hoy', label: 'Hoy' },
  { valor: 'ayer', label: 'Ayer' },
  { valor: 'esta_semana', label: 'Esta semana' },
  { valor: 'ultima_semana', label: 'Última semana' },
  { valor: 'este_mes', label: 'Este mes' },
  { valor: 'ultimo_mes', label: 'Último mes' },
  { valor: 'este_ano', label: 'Este año' },
  { valor: 'ultimo_ano', label: 'Último año' },
  { valor: 'rango', label: 'Rango personalizado' },
]

export type FiltrosProyectos = {
  estado: string
  cliente: string
  incluirClienteFinal: boolean
  apellido: string
  nroProyecto: string
  nroPedido: string
  descProyecto: string
  descItem: string
  descGlobal: string
  fechaPreset: string
  rangoInicio: string
  rangoFin: string
}

export const FILTROS_VACIOS: FiltrosProyectos = {
  estado: '',
  cliente: '',
  incluirClienteFinal: false,
  apellido: '',
  nroProyecto: '',
  nroPedido: '',
  descProyecto: '',
  descItem: '',
  descGlobal: '',
  fechaPreset: 'todos',
  rangoInicio: '',
  rangoFin: '',
}

// ¿Hay algún filtro que efectivamente esté acotando la lista? (para el botón Limpiar)
export function hayFiltrosActivos(f: FiltrosProyectos): boolean {
  return (
    f.estado !== '' ||
    f.incluirClienteFinal ||
    f.cliente.trim() !== '' ||
    f.apellido.trim() !== '' ||
    f.nroProyecto.trim() !== '' ||
    f.nroPedido.trim() !== '' ||
    f.descProyecto.trim() !== '' ||
    f.descItem.trim() !== '' ||
    f.descGlobal.trim() !== '' ||
    (f.fechaPreset !== 'todos' && f.fechaPreset !== '')
  )
}

const SELECT_PROYECTO =
  'id, empresa_id, contacto_id, pedido_nro, descripcion, urgencia, estado, sub_estado_cerrado, fecha_ingreso, fecha_entrega, fecha_limite_cotizar, plazo_dias_habiles, paso_por_solicitud, observaciones_mail, observaciones_anulacion, cliente_final_empresa_id, cliente_final_texto, moneda, oc_cliente, foto_url, empresa:empresas!empresa_id ( nombre ), contacto:empresa_contactos!contacto_id ( apellido ), cliente_final:empresas!cliente_final_empresa_id ( nombre )'

function like(texto: string): string {
  return '%' + texto.trim() + '%'
}

// ── Rango de fechas según el preset elegido (o null si no filtra) ──────────
function pad(n: number): string {
  return String(n).padStart(2, '0')
}
function iso(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
// Lunes como inicio de semana.
function inicioSemana(d: Date): Date {
  const r = new Date(d)
  const dia = (r.getDay() + 6) % 7 // 0 = lunes
  r.setDate(r.getDate() - dia)
  return r
}
function rangoDeFecha(f: FiltrosProyectos): { desde: string; hasta: string } | null {
  const preset = f.fechaPreset
  if (preset === '' || preset === 'todos') return null

  if (preset === 'rango') {
    if (!f.rangoInicio && !f.rangoFin) return null
    return { desde: f.rangoInicio || '0001-01-01', hasta: f.rangoFin || '9999-12-31' }
  }

  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)

  if (preset === 'hoy') return { desde: iso(hoy), hasta: iso(hoy) }
  if (preset === 'ayer') {
    const d = new Date(hoy)
    d.setDate(d.getDate() - 1)
    return { desde: iso(d), hasta: iso(d) }
  }
  if (preset === 'esta_semana') {
    const ini = inicioSemana(hoy)
    const fin = new Date(ini)
    fin.setDate(ini.getDate() + 6)
    return { desde: iso(ini), hasta: iso(fin) }
  }
  if (preset === 'ultima_semana') {
    const ini = inicioSemana(hoy)
    ini.setDate(ini.getDate() - 7)
    const fin = new Date(ini)
    fin.setDate(ini.getDate() + 6)
    return { desde: iso(ini), hasta: iso(fin) }
  }
  if (preset === 'este_mes') {
    const ini = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
    const fin = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0)
    return { desde: iso(ini), hasta: iso(fin) }
  }
  if (preset === 'ultimo_mes') {
    const ini = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1)
    const fin = new Date(hoy.getFullYear(), hoy.getMonth(), 0)
    return { desde: iso(ini), hasta: iso(fin) }
  }
  if (preset === 'este_ano') {
    return { desde: `${hoy.getFullYear()}-01-01`, hasta: `${hoy.getFullYear()}-12-31` }
  }
  if (preset === 'ultimo_ano') {
    const y = hoy.getFullYear() - 1
    return { desde: `${y}-01-01`, hasta: `${y}-12-31` }
  }
  return null
}

// Proyectos que tienen algún item cuya descripción matchea (paso 1 de la
// búsqueda que cruza tablas). Devuelve null si hubo error.
async function proyectoIdsPorItem(texto: string): Promise<number[] | null> {
  const { data, error } = await supabase
    .from('elementos')
    .select('proyecto_id')
    .ilike('descripcion', like(texto))
  if (error) return null
  const ids = (data ?? []).map((r) => r.proyecto_id as number)
  return Array.from(new Set(ids))
}

// Búsqueda principal de proyectos con todos los filtros aplicados en el servidor.
// Normaliza para comparar sin distinguir mayúsculas ni TILDES ("america" == "América").
function sinTildes(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

export async function buscarProyectos(
  f: FiltrosProyectos,
): Promise<{ data: Proyecto[]; error: string | null }> {
  // ── Paso 1: resolver los filtros que dependen de otras tablas ──────────

  // Cliente: ids de empresas cuyo nombre matchea el texto.
  let empresaIds: number[] | null = null
  if (f.cliente.trim() !== '') {
    const { data, error } = await supabase.from('empresas').select('id, nombre')
    if (error) return { data: [], error: 'No se pudo filtrar por cliente.' }
    const q = sinTildes(f.cliente)
    empresaIds = (data ?? [])
      .filter((e) => sinTildes((e.nombre as string) ?? '').includes(q))
      .map((e) => e.id as number)
    if (empresaIds.length === 0) return { data: [], error: null }
  }

  // Apellido: ids de contactos cuyo apellido matchea.
  let contactoIds: number[] | null = null
  if (f.apellido.trim() !== '') {
    const { data, error } = await supabase.from('empresa_contactos').select('id, apellido')
    if (error) return { data: [], error: 'No se pudo filtrar por apellido.' }
    const q = sinTildes(f.apellido)
    contactoIds = (data ?? [])
      .filter((c) => sinTildes((c.apellido as string) ?? '').includes(q))
      .map((c) => c.id as number)
    if (contactoIds.length === 0) return { data: [], error: null }
  }

  // Descripción Item: proyectos que tienen un item que matchea.
  let proyectoIdsItem: number[] | null = null
  if (f.descItem.trim() !== '') {
    const ids = await proyectoIdsPorItem(f.descItem)
    if (ids === null) return { data: [], error: 'No se pudo filtrar por item.' }
    if (ids.length === 0) return { data: [], error: null }
    proyectoIdsItem = ids
  }

  // Descripción Global: proyectos con item que matchea (el OR con la
  // descripción del proyecto se arma abajo). Puede quedar vacío.
  let proyectoIdsGlobal: number[] | null = null
  if (f.descGlobal.trim() !== '') {
    const ids = await proyectoIdsPorItem(f.descGlobal)
    if (ids === null) return { data: [], error: 'No se pudo filtrar (global).' }
    proyectoIdsGlobal = ids
  }

  // ── Paso 2: consulta principal ─────────────────────────────────────────
  let q = supabase.from('proyectos').select(SELECT_PROYECTO)

  if (f.estado !== '') q = q.eq('estado', f.estado)

  const nro = f.nroProyecto.trim()
  if (/^\d+$/.test(nro)) q = q.eq('id', Number(nro))

  if (f.nroPedido.trim() !== '') q = q.eq('pedido_nro', f.nroPedido.trim())

  if (f.descProyecto.trim() !== '') q = q.ilike('descripcion', like(f.descProyecto))

  // Cliente / cliente final
  if (empresaIds !== null) {
    const lista = empresaIds.join(',')
    if (f.incluirClienteFinal) {
      q = q.or(`empresa_id.in.(${lista}),cliente_final_empresa_id.in.(${lista})`)
    } else {
      q = q.in('empresa_id', empresaIds)
    }
  }

  if (contactoIds !== null) q = q.in('contacto_id', contactoIds)

  if (proyectoIdsItem !== null) q = q.in('id', proyectoIdsItem)

  if (proyectoIdsGlobal !== null) {
    // "descripción del proyecto contiene X" O "el proyecto está entre los que
    // tienen un item que matchea". Comillas para tolerar espacios/comas.
    const g = f.descGlobal.trim().replace(/"/g, '')
    const idList = proyectoIdsGlobal.length > 0 ? proyectoIdsGlobal.join(',') : '0'
    q = q.or(`descripcion.ilike."%${g}%",id.in.(${idList})`)
  }

  const rango = rangoDeFecha(f)
  if (rango) {
    q = q
      .gte('fecha_ingreso', rango.desde)
      .lte('fecha_ingreso', rango.hasta + 'T23:59:59')
  }

  q = q.order('id', { ascending: false })

  const { data, error } = await q
  if (error) return { data: [], error: 'No se pudieron cargar los proyectos.' }
  return { data: (data as unknown as Proyecto[]) ?? [], error: null }
}

// Filtros con los que arranca el módulo al entrar por primera vez (o tras F5):
// solo los proyectos en curso (Pedido). El botón "Limpiar" usa FILTROS_VACIOS.
export const FILTROS_INICIALES: FiltrosProyectos = {
  ...FILTROS_VACIOS,
  estado: 'Pedido',
}
