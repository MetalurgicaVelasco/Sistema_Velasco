// Tipos del dominio "procesos de elemento" (instancias que van al tablero) y sus
// correlatividades (predecesores). Los procesos son PLANOS acá: guardan ids;
// los nombres de tipo/máquina/operario se resuelven en la vista con los datos
// de recursos (cargarRecursos), igual que en Procesos/Máquinas.

export type ModoProceso = 'manual' | 'semi_automatica' | 'automatica'

export type Proceso = {
  id: number
  elementoId: number
  orden: number
  tipoProcesoId: number | null
  procesoOtro: string | null
  modo: ModoProceso
  setupMin: number
  operacionMin: number
  margenMin: number
  maquinaId: number | null
  maquinaOtra: string | null
  operarioId: number | null
  detalleTrabajo: string | null
  esRetrabajo: boolean
}

export type Correlatividad = {
  id: number
  predecesorId: number
  sucesorId: number
}

export const MODO_LABEL: Record<ModoProceso, string> = {
  manual: 'MAN',
  semi_automatica: 'SEMI',
  automatica: 'AUTO',
}

// Duración total en minutos: setup + cantidad_del_elemento × operación + margen.
export function totalMin(p: Proceso, cantidadElemento: number): number {
  const cant = cantidadElemento > 0 ? cantidadElemento : 1
  return p.setupMin + cant * p.operacionMin + p.margenMin
}

// Formatea minutos como "Xh Ym" / "Xh" / "Ym".
export function fmtDuracion(min: number): string {
  const m = Math.round(min)
  const h = Math.floor(m / 60)
  const r = m % 60
  if (h && r) return `${h}h ${r}m`
  if (h) return `${h}h`
  return `${r}m`
}
