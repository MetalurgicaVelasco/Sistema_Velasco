// -----------------------------------------------------------------------------
// Cálculo de tiempos de una actividad a partir de sus tramos.
//
// Un tramo es una tarjeta: trabajo o pausa, con inicio y fin. Si `fin` es null
// el tramo está corriendo (se mide contra "ahora").
//
// Todo acá es lógica pura, sin base de datos: es lo que hay que tener bien,
// porque de estos números salen las horas reales de cada trabajo.
// -----------------------------------------------------------------------------

import { esProductivo, tipoDePausa, type TipoOperacion } from './tiposOperacion'

// `tipo` es el eje viejo (trabajo/pausa). Se conserva mientras conviven los dos
// modelos; el que manda ahora es `tipoOperacion`.
export type TipoTramo = 'trabajo' | 'pausa'

export type Tramo = {
  id: number
  tipo: TipoTramo
  // Qué estaba haciendo el operario. Opcional para no romper los tramos viejos
  // que todavía no lo tienen; cuando falta, se cae en `tipo`.
  tipoOperacion?: TipoOperacion
  inicio: string // ISO
  fin: string | null // null = corriendo
  motivo?: string | null
  motivoDetalle?: string | null
  autorizadoPor?: string | null
  editado?: boolean
  // Automático: la máquina sigue sola después de que el operario se va, así que
  // tiene su propio fin y no cuenta para los solapes.
  automatico?: boolean
  finMaquina?: string | null
  maquinaId?: number | null
}

// ¿El tramo es trabajo sobre la pieza? Con el tipo de operación manda ese; si el
// tramo es viejo y no lo tiene, vale el eje anterior.
export function tramoProductivo(t: Tramo): boolean {
  return t.tipoOperacion ? esProductivo(t.tipoOperacion) : t.tipo === 'trabajo'
}

// Milisegundos de un tramo. Si está abierto, se mide hasta `ahora`.
export function msTramo(t: Tramo, ahora: number = Date.now()): number {
  const ini = Date.parse(t.inicio)
  if (Number.isNaN(ini)) return 0
  const fin = t.fin ? Date.parse(t.fin) : ahora
  if (Number.isNaN(fin)) return 0
  // Nunca negativo: un fin anterior al inicio cuenta como cero.
  return Math.max(0, fin - ini)
}

export type Totales = {
  trabajoMs: number
  pausaMs: number
  totalMs: number // trabajo + pausa (lo que duró de punta a punta el registro)
  hayAbierto: boolean
}

export function totales(tramos: Tramo[], ahora: number = Date.now()): Totales {
  let trabajoMs = 0
  let pausaMs = 0
  let hayAbierto = false
  for (const t of tramos) {
    const ms = msTramo(t, ahora)
    if (tramoProductivo(t)) trabajoMs += ms
    else pausaMs += ms
    if (!t.fin) hayAbierto = true
  }
  return { trabajoMs, pausaMs, totalMs: trabajoMs + pausaMs, hayAbierto }
}

// Algún tramo abierto (manual o automático): mientras haya uno, el reloj corre.
export function tramoAbierto(tramos: Tramo[]): Tramo | null {
  return tramos.find((t) => !t.fin) ?? null
}

// Lo que el operario está haciendo AHORA: el tramo abierto que no es automático.
// Puede convivir con un automático abierto (la máquina sigue sola mientras él
// hace otra cosa). Solo puede haber uno.
export function abiertoManual(tramos: Tramo[]): Tramo | null {
  return tramos.find((t) => !t.fin && !t.automatico) ?? null
}

// La operación (OP) en curso, manual o automática: la más reciente que siga
// abierta. Es a la que se aplican el selector Automático/Manual y el fin de
// máquina.
export function opActual(tramos: Tramo[]): Tramo | null {
  let actual: Tramo | null = null
  for (const t of tramos) {
    if (t.fin || t.tipoOperacion !== 'OP') continue
    if (!actual || Date.parse(t.inicio) > Date.parse(actual.inicio)) actual = t
  }
  return actual
}

// ¿Se puede cambiar el OP entre automático y manual? Sí mientras sea lo último
// que se arrancó: si después ya empezó otra cosa, pasarlo a manual dejaría dos
// tramos manuales corriendo a la vez. En ese caso se corrige desde su tarjeta.
export function puedeCambiarModo(tramos: Tramo[], op: Tramo): boolean {
  const ini = Date.parse(op.inicio)
  return !tramos.some((t) => t.id !== op.id && Date.parse(t.inicio) > ini)
}

// Valida la hora en que terminó la máquina. No puede ser futura (hay que esperar
// a que termine de verdad) ni anterior a cuando arrancó la operación.
export function errorFinMaquina(
  finIso: string | null,
  inicioIso: string,
  ahora: number = Date.now(),
): string | null {
  if (!finIso) return 'Ingresá cuándo terminó la máquina.'
  const fin = Date.parse(finIso)
  if (Number.isNaN(fin)) return 'La fecha no es válida.'
  // Un minuto de tolerancia: el campo no tiene segundos.
  if (fin > ahora + 60000) return 'No puede ser una hora futura: esperá a que la máquina termine.'
  if (fin < Date.parse(inicioIso)) return 'No puede ser anterior al inicio de la operación.'
  return null
}

// 'HH:MM:SS' para el contador que corre en pantalla.
export function comoReloj(ms: number): string {
  const seg = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(seg / 3600)
  const m = Math.floor((seg % 3600) / 60)
  const s = seg % 60
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(h)}:${p(m)}:${p(s)}`
}

// '2h 05m' para los totales (más legible que el reloj cuando son horas).
export function comoDuracion(ms: number): string {
  const min = Math.round(ms / 60000)
  const h = Math.floor(min / 60)
  const m = min % 60
  return h ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`
}

// 'HH:MM' de un ISO, en hora local.
export function horaDe(iso: string | null): string {
  if (!iso) return '--:--'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '--:--'
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getHours())}:${p(d.getMinutes())}`
}

// ISO → 'YYYY-MM-DDTHH:mm' (lo que espera <input type="datetime-local">).
export function isoALocal(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

// 'YYYY-MM-DDTHH:mm' (hora local) → ISO.
export function localAIso(local: string): string | null {
  if (!local) return null
  const d = new Date(local)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

// Minutos por tipo de operación. Es de acá que sale "cuánto tiempo se fue en
// seteo, en programación, en operación".
export function minutosPorTipo(
  tramos: Tramo[],
  ahora: number = Date.now(),
): Record<string, number> {
  const acc: Record<string, number> = {}
  for (const t of tramos) {
    const clave = t.tipoOperacion ?? (t.tipo === 'trabajo' ? 'OP' : tipoDePausa(t.motivo ?? ''))
    acc[clave] = (acc[clave] ?? 0) + Math.round(msTramo(t, ahora) / 60000)
  }
  return acc
}

// ¿Los tramos se pisan entre sí? Sirve para avisar cuando se corrigen horarios
// a mano. Los AUTOMÁTICOS quedan afuera: mientras la máquina trabaja sola, el
// operario está en otra cosa, así que pisarse es lo esperado.
export function haySolape(tramos: Tramo[]): boolean {
  const ord = tramos
    .filter((t) => t.fin && !t.automatico)
    .map((t) => [Date.parse(t.inicio), Date.parse(t.fin as string)] as const)
    .filter(([a, b]) => !Number.isNaN(a) && !Number.isNaN(b))
    .sort((x, y) => x[0] - y[0])
  for (let i = 1; i < ord.length; i++) {
    if (ord[i][0] < ord[i - 1][1]) return true
  }
  return false
}
