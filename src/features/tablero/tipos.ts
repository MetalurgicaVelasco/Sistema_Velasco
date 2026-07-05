// features/tablero/tipos.ts
// -----------------------------------------------------------------------------
// Tipos del dominio del Tablero de planificación.
//
// Reutiliza el tipo `Proceso` (base) del feature producción: un proceso es la
// misma fila de la tabla `procesos`; el tablero le agrega los campos de
// planificación con una intersección de tipos (`&`). Si a futuro el acoplamiento
// entre features molesta, estos tipos base pueden mudarse a shared/.
// -----------------------------------------------------------------------------

import type { Proceso, ModoProceso } from '../produccion/procesoTipos'

export type EstadoProceso = 'sin_planificar' | 'planificado' | 'hecho'

// Snapshot que el planificador aceptó (columna plan_aceptado, jsonb). El ancho
// del bloque se DERIVA de esto; los cambios de Oficina Técnica generan
// divergencia hasta que el planificador los aplica o ignora.
export type PlanAceptado = {
  setupMin: number
  operacionMin: number
  margenMin: number
  cantidad: number
  modo: ModoProceso
}

// Campos de planificación que el tablero agrega al proceso.
export type Planificacion = {
  estado: EstadoProceso
  planFecha: string | null        // 'YYYY-MM-DD'
  planHora: string | null         // 'HH:MM:SS'
  planOperarioId: number | null
  planMaquinaId: number | null
  planAceptado: PlanAceptado | null
  realFechaInicio: string | null
  realHoraInicio: string | null
  realFechaFin: string | null
  realHoraFin: string | null
  procesoEliminado: boolean
  setupSolapable: boolean
  grupoDivisionId: string | null
}

// El proceso tal como lo ve el tablero: la fila completa de `procesos`.
export type ProcesoTablero = Proceso & Planificacion

// Pulmón: reserva de tiempo de un operario (no es un proceso de un elemento).
export type Pulmon = {
  id: number
  personalId: number
  maquinaId: number | null
  fecha: string          // 'YYYY-MM-DD'
  horaInicio: string     // 'HH:MM:SS'
  duracionMin: number
}

// Rango de vacaciones de un operario.
export type Vacacion = {
  id: number
  personalId: number
  desde: string          // 'YYYY-MM-DD'
  hasta: string          // 'YYYY-MM-DD'
}

// Operario tal como lo necesita el tablero (datos + horarios + orden de columna).
// Nota: los campos de horario en camelCase son justo los que espera jornada().
export type PersonalTablero = {
  id: number
  nombre: string
  apellido: string | null
  horarioEntrada: string | null
  horarioSalida: string | null
  horarioSabadoInicio: string | null
  horarioSabadoFin: string | null
  colorBorde: string | null
  ordenTablero: number | null
}

// Máquina tal como la necesita el tablero (id, nombre, color del borde).
export type MaquinaTablero = {
  id: number
  nombre: string
  color: string | null
}
