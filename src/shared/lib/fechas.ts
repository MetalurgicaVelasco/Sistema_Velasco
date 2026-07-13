// shared/lib/fechas.ts
// -----------------------------------------------------------------------------
// Módulo ÚNICO de fechas y horas locales del sistema.
//
// Regla de oro: para fechas de CALENDARIO (un día del tablero, una fecha de
// entrega) NUNCA usamos toISOString(). Ese método devuelve la fecha en UTC, y
// en Argentina (UTC−3) de noche eso cae en el día siguiente: era el bug de
// "marcar un proceso hecho a las 22:00 y que quede con fecha de mañana".
// Trabajamos siempre con los componentes LOCALES del Date.
// -----------------------------------------------------------------------------

/** Un string con forma 'YYYY-MM-DD'. Es un string común; el alias documenta intención. */
export type FechaISO = string

/** Date -> 'YYYY-MM-DD' usando los componentes LOCALES (nunca toISOString). */
export function fechaAISO(d: Date): FechaISO {
  const a = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${a}-${m}-${dia}`
}

/**
 * 'YYYY-MM-DD' -> Date local al MEDIODÍA.
 * El 'T12:00:00' es clave: sin hora, el navegador interpreta el string como
 * UTC medianoche, que en UTC−3 cae el día anterior. Al mediodía local, ningún
 * huso horario del país mueve el día.
 */
export function parseFecha(iso: FechaISO): Date {
  return new Date(`${iso}T12:00:00`)
}

/** La fecha de HOY en hora local, como 'YYYY-MM-DD'. */
export function hoyISO(): FechaISO {
  return fechaAISO(new Date())
}

/** Suma días a una fecha ISO (acepta negativos para restar). Devuelve ISO. */
export function sumarDias(iso: FechaISO, dias: number): FechaISO {
  const d = parseFecha(iso)
  d.setDate(d.getDate() + dias)
  return fechaAISO(d)
}

/** Avanza (n>0) o retrocede (n<0) `n` días HÁBILES (sin domingos) desde `iso`. */
export function sumarHabiles(iso: FechaISO, n: number): FechaISO {
  const paso = n < 0 ? -1 : 1
  let quedan = Math.abs(n)
  let f = iso
  while (quedan > 0) {
    f = sumarDias(f, paso)
    if (parseFecha(f).getDay() !== 0) quedan--
  }
  return f
}

/** Día de la semana: 0=domingo, 1=lunes, ... 6=sábado (local). */
export function diaSemana(iso: FechaISO): number {
  return parseFecha(iso).getDay()
}

export function esSabado(iso: FechaISO): boolean {
  return diaSemana(iso) === 6
}

export function esDomingo(iso: FechaISO): boolean {
  return diaSemana(iso) === 0
}

export function esFinDeSemana(iso: FechaISO): boolean {
  const d = diaSemana(iso)
  return d === 0 || d === 6
}

/**
 * Diferencia en días entre dos fechas ISO (b − a). Positivo si b es posterior.
 * Ambas al mediodía local, así el cambio de horario de verano no altera la cuenta.
 */
export function diffDias(a: FechaISO, b: FechaISO): number {
  const ms = parseFecha(b).getTime() - parseFecha(a).getTime()
  return Math.round(ms / 86400000)
}

/** Compara dos fechas ISO. −1 si a<b, 0 si iguales, 1 si a>b. */
export function compararFechas(a: FechaISO, b: FechaISO): number {
  return a < b ? -1 : a > b ? 1 : 0
}

// --- Horas del día (para posicionar bloques en el tablero) -------------------

/** 'HH:MM' o 'HH:MM:SS' -> minutos desde medianoche. */
export function horaAMin(hora: string): number {
  const [h, m] = hora.split(':')
  return Number(h) * 60 + Number(m)
}

/** minutos desde medianoche -> 'HH:MM' (24h, con ceros). */
export function minAHora(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}
