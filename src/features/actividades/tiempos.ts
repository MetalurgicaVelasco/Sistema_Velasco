// -----------------------------------------------------------------------------
// Cálculo de tiempos de una actividad a partir de sus tramos.
//
// Un tramo es una tarjeta: trabajo o pausa, con inicio y fin. Si `fin` es null
// el tramo está corriendo (se mide contra "ahora").
//
// Todo acá es lógica pura, sin base de datos: es lo que hay que tener bien,
// porque de estos números salen las horas reales de cada trabajo.
// -----------------------------------------------------------------------------

export type TipoTramo = 'trabajo' | 'pausa'

export type Tramo = {
  id: number
  tipo: TipoTramo
  inicio: string // ISO
  fin: string | null // null = corriendo
  motivo?: string | null
  motivoDetalle?: string | null
  autorizadoPor?: string | null
  editado?: boolean
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
    if (t.tipo === 'trabajo') trabajoMs += ms
    else pausaMs += ms
    if (!t.fin) hayAbierto = true
  }
  return { trabajoMs, pausaMs, totalMs: trabajoMs + pausaMs, hayAbierto }
}

// El tramo abierto, si hay (solo puede haber uno por actividad).
export function tramoAbierto(tramos: Tramo[]): Tramo | null {
  return tramos.find((t) => !t.fin) ?? null
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

// ¿Los tramos se pisan entre sí? Sirve para avisar cuando se corrigen horarios
// a mano: dos tramos de la misma actividad no pueden solaparse.
export function haySolape(tramos: Tramo[]): boolean {
  const ord = tramos
    .filter((t) => t.fin)
    .map((t) => [Date.parse(t.inicio), Date.parse(t.fin as string)] as const)
    .filter(([a, b]) => !Number.isNaN(a) && !Number.isNaN(b))
    .sort((x, y) => x[0] - y[0])
  for (let i = 1; i < ord.length; i++) {
    if (ord[i][0] < ord[i - 1][1]) return true
  }
  return false
}
