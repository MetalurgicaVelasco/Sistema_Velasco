// shared/lib/vistaModulos.ts
// -----------------------------------------------------------------------------
// Guarda, MIENTRAS LA APP ESTÁ ABIERTA, el estado de vista de cada módulo, para
// poder saltar de un módulo a otro sin perder el contexto (qué había filtrado,
// qué fila estaba seleccionada).
//
// Es memoria del proceso, no del navegador: al recargar la página (F5) se pierde
// a propósito, y cada módulo vuelve a arrancar con sus valores por defecto.
// -----------------------------------------------------------------------------

const vistas = new Map<string, unknown>()

export function guardarVista<T>(modulo: string, estado: T): void {
  vistas.set(modulo, estado)
}

export function leerVista<T>(modulo: string): T | null {
  return (vistas.get(modulo) as T | undefined) ?? null
}
