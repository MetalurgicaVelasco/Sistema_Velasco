// features/tablero/datos/escritura.ts
// -----------------------------------------------------------------------------
// La ÚNICA vía de escritura del tablero. Dos piezas:
//   - armarPlan: puro. De la simulación (el ancla que moviste + los que se
//     reacomodaron) saca la lista de cambios a escribir.
//   - aplicarPlan: escribe esa lista por la RPC atómica aplicar_plan_tablero
//     (todo o nada), traduciendo camelCase → snake_case.
//
// El mismo plan sirve para el preview (modal de afectadas) y para escribir: lo
// que se muestra es exactamente lo que se aplica.
// -----------------------------------------------------------------------------

import { supabase } from '../../../shared/lib/supabaseClient'
import type { ResultadoSimulacion } from '../motor/simular'

// Un cambio a persistir: un proceso queda planificado en esta fecha/hora/recursos.
export type CambioPlan = {
  procesoId: number
  planFecha: string // 'YYYY-MM-DD'
  planHora: string // 'HH:MM'
  planOperarioId: number | null
  planMaquinaId: number | null
  estado: 'planificado'
  // Opcional: cuando el modal edita los tiempos del proceso (cambio directo). Se
  // escriben en el proceso Y en plan_aceptado (iguales → sin divergencia).
  tiempos?: {
    setupMin: number
    operacionMin: number
    margenMin: number
    cantidad: number
    modo: string
  }
  setupSolapable?: boolean
}

function minAHora(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

// De la simulación al plan: se escriben las anclas (lo que tocó el usuario) y los
// bloques que la cascada reacomodó. Si la simulación no cerró, no hay plan.
export function armarPlan(resultado: ResultadoSimulacion, anclasIds: number[]): CambioPlan[] {
  if (!resultado.ok) return []
  const aEscribir = new Set<number>([...anclasIds, ...resultado.movidos])
  return resultado.items
    .filter((it) => aEscribir.has(it.id))
    .map((it) => ({
      procesoId: it.id,
      planFecha: it.inicio.fecha,
      planHora: minAHora(it.inicio.min),
      planOperarioId: it.operarioId,
      planMaquinaId: it.maquinaId,
      estado: 'planificado' as const,
    }))
}

// Escribe el plan por la RPC atómica. Traduce al jsonb que la función espera.
export async function aplicarPlan(cambios: CambioPlan[]): Promise<void> {
  if (!cambios.length) return
  const plan = cambios.map((c) => {
    const item: Record<string, unknown> = {
      tabla: 'procesos',
      id: c.procesoId,
      plan_fecha: c.planFecha,
      plan_hora: c.planHora,
      plan_operario_id: c.planOperarioId,
      plan_maquina_id: c.planMaquinaId,
      estado: c.estado,
    }
    if (c.setupSolapable !== undefined) item.setup_solapable = c.setupSolapable
    if (c.tiempos) {
      const t = c.tiempos
      item.setup_min = t.setupMin
      item.operacion_min = t.operacionMin
      item.margen_min = t.margenMin
      item.modo = t.modo
      // Cambio directo: el snapshot queda igual al proceso → sin divergencia.
      item.plan_aceptado = {
        setup_min: t.setupMin,
        operacion_min: t.operacionMin,
        margen_min: t.margenMin,
        cantidad: t.cantidad,
        modo: t.modo,
      }
    }
    return item
  })
  const { error } = await supabase.rpc('aplicar_plan_tablero', { plan })
  if (error) throw new Error(error.message)
}
