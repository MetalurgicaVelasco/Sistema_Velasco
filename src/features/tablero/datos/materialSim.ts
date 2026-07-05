// features/tablero/datos/materialSim.ts
// -----------------------------------------------------------------------------
// Prepara lo que el motor de simulación consume, a partir de los datos ya
// cargados: convierte cada proceso planificado (de presente/futuro) en un
// ItemSimulacion y arma el contexto de cada operario. Aplica el filtro de pasado.
//
// Pura: recibe los datos, no toca la base.
// -----------------------------------------------------------------------------

import { horaAMin, type FechaISO } from '../../../shared/lib/fechas'
import { tiemposDe } from '../motor/duraciones'
import { contextoOperario } from '../motor/preparar'
import { esPasado } from '../motor/pasado'
import type { ItemSimulacion } from '../motor/simular'
import type { ContextoOperario } from '../motor/calendario'
import type { ProcesoTablero, PersonalTablero, Vacacion } from '../tipos'

export type MaterialSimulacion = {
  items: ItemSimulacion[]
  ctxs: Map<number, ContextoOperario>
}

function estaPlanificado(p: ProcesoTablero): boolean {
  return !!p.planFecha && !!p.planHora && p.planOperarioId != null
}

export function materialSimulacion(
  procesos: ProcesoTablero[],
  cantidadPorElemento: Map<number, number>,
  personal: Map<number, PersonalTablero>,
  vacaciones: Vacacion[],
  corte: FechaISO,
): MaterialSimulacion {
  const ctxs = new Map<number, ContextoOperario>()
  for (const [id, op] of personal) ctxs.set(id, contextoOperario(op, vacaciones))

  const items: ItemSimulacion[] = []
  for (const p of procesos) {
    if (!estaPlanificado(p)) continue
    const ctx = ctxs.get(p.planOperarioId as number)
    if (!ctx) continue
    const cantidad = cantidadPorElemento.get(p.elementoId) ?? 1
    const tiempos = tiemposDe(p, cantidad)
    const inicio = { fecha: p.planFecha as FechaISO, min: horaAMin(p.planHora as string) }
    if (esPasado(inicio, tiempos, ctx, corte)) continue // historia: fuera del motor
    items.push({
      id: p.id,
      operarioId: p.planOperarioId,
      maquinaId: p.planMaquinaId,
      tiempos,
      setupSolapable: p.setupSolapable,
      inicio,
    })
  }
  return { items, ctxs }
}
