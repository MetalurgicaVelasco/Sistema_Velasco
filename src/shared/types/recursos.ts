// Tipos del dominio de datos base del taller: tipos de proceso, máquinas y
// personal. Se llama "recursos" por el dominio (los recursos productivos del
// taller); NO es una sección de la UI (cada módulo vive en su sección:
// Producción > Procesos, Activos > Máquinas, RRHH > Personal).
//
// Las relaciones (qué máquina hace qué proceso, quién opera qué) están
// normalizadas en tablas de cruce en la base. Acá, una vez cargadas, se
// exponen ya resueltas como arrays de ids para que los componentes no tengan
// que cruzar a mano.

export type Rol = 'ideal' | 'suplente'

// Catálogo de tipos de proceso (Torneado, Fresado, Compra, etc.).
export type TipoProceso = {
  id: number
  nombre: string
  llevaMaquina: boolean
  orden: number
  // Si NO lleva máquina: operarios que lo hacen (definidos en este módulo).
  operarioIdealId: number | null
  suplenteIds: number[]
  // Si SÍ lleva máquina: en qué máquinas se realiza (el operario lo define la
  // máquina, no el proceso).
  maquinaIds: number[]
}

export type Maquina = {
  id: number
  nombre: string
  fotoUrl: string | null
  tipoProcesoIds: number[] // procesos que puede realizar
  operarioIdealId: number | null
  suplenteIds: number[]
}

export type Personal = {
  id: number
  nombre: string
  apellido: string | null
  horarioEntrada: string | null
  horarioSalida: string | null
  horarioSabadoInicio: string | null
  horarioSabadoFin: string | null
  enTablero: boolean
  colorBorde: string | null
  activo: boolean
}

// Lo que devuelve una carga completa de recursos.
export type RecursosData = {
  tiposProceso: TipoProceso[]
  maquinas: Maquina[]
  personal: Personal[]
}

// Nombre visible de una persona (nombre + apellido si tiene).
export function nombrePersonal(p: Personal): string {
  return [p.nombre, p.apellido].filter(Boolean).join(' ')
}
