// features/tablero/motor/simular.ts
// -----------------------------------------------------------------------------
// La cascada: dado un estado y un conjunto de cambios (anclas), reacomoda los
// demás bloques hasta que el tablero queda estable (punto fijo).
//
// Reglas (del "motor A" del sistema viejo, la parte buena):
//   - Las anclas (lo que el usuario tocó) NO se mueven; el resto se acomoda.
//   - En cada vuelta: cascada por operario, push por máquina, correlatividades,
//     pulmones. Se repite hasta que una vuelta entera no mueve nada.
//   - Si no converge en `maxIteraciones`, error (sería un bug).
//
// Este archivo arranca con el esqueleto + la cascada por operario. El push por
// máquina, las correlatividades y los pulmones se agregan en pasos siguientes.
//
// Función pura: recibe el estado + los contextos de los operarios; devuelve el
// estado nuevo sin tocar el original ni la base.
// -----------------------------------------------------------------------------

import {
  finOperario, finMaquina, minutosAbsolutos, ajustarAJornada,
  type ContextoOperario, type Momento,
} from './calendario'
import { reglaDe } from './modos'
import { validarInvariantes, type BloqueCalculado } from './invariantes'
import type { Tiempos } from './duraciones'

// Un ítem del estado de simulación. Su `inicio` se mueve durante la cascada.
export type ItemSimulacion = {
  id: number
  operarioId: number | null
  maquinaId: number | null
  tiempos: Tiempos
  setupSolapable: boolean
  inicio: Momento
}

export type ResultadoSimulacion =
  | { ok: true; items: ItemSimulacion[]; movidos: number[] }
  | { ok: false; error: 'no_converge' | 'conflicto_no_resoluble'; detalle?: unknown }

export type ConfigSimulacion = {
  gapMin: number
  maxIteraciones?: number
}

// Par de ids de una correlatividad (el tipo Correlatividad completo la satisface).
export type ParCorrelatividad = { predecesorId: number; sucesorId: number }

const MAX_ITER_DEFAULT = 200

// --- Cascada por operario -----------------------------------------------------

function ctxDe(item: ItemSimulacion, ctxs: Map<number, ContextoOperario>): ContextoOperario {
  const ctx = item.operarioId != null ? ctxs.get(item.operarioId) : undefined
  if (!ctx) throw new Error(`Falta el contexto del operario ${item.operarioId} (ítem ${item.id})`)
  return ctx
}

function finOpDe(item: ItemSimulacion, ctxs: Map<number, ContextoOperario>): Momento {
  return finOperario(item.inicio, item.tiempos, ctxDe(item, ctxs))
}

function finMaqDe(item: ItemSimulacion, ctxs: Map<number, ContextoOperario>): Momento {
  return finMaquina(item.inicio, item.tiempos, ctxDe(item, ctxs))
}

// Convierte un ítem de simulación en un bloque calculado (con sus dos intervalos),
// para validar invariantes sobre el estado final.
function itemABloque(item: ItemSimulacion, ctxs: Map<number, ContextoOperario>): BloqueCalculado {
  const ctx = ctxDe(item, ctxs)
  return {
    id: item.id,
    operarioId: item.operarioId,
    maquinaId: item.maquinaId,
    modo: item.tiempos.modo,
    setupSolapable: item.setupSolapable,
    intervaloOperario: { inicio: item.inicio, fin: finOperario(item.inicio, item.tiempos, ctx) },
    intervaloMaquina: { inicio: item.inicio, fin: finMaquina(item.inicio, item.tiempos, ctx) },
  }
}

// ¿La excepción setup_solapable exime este par en el eje operario? (el setup de
// una auto/semi solapable puede montarse sobre una manual del mismo operario)
function exentoPorSetup(a: ItemSimulacion, b: ItemSimulacion): boolean {
  const aLibera = reglaDe(a.tiempos.modo).operarioSoloSetup
  const bLibera = reglaDe(b.tiempos.modo).operarioSoloSetup
  return (aLibera && a.setupSolapable && !bLibera) || (bLibera && b.setupSolapable && !aLibera)
}

// Una pasada de cascada por operario. Mueve, por cada operario, un par en
// conflicto (el patrón del viejo: mover uno y dejar que el punto fijo re-evalúe).
// Devuelve true si movió algo.
function cascadaOperario(
  items: ItemSimulacion[],
  anclas: Set<number>,
  ctxs: Map<number, ContextoOperario>,
  gap: number,
): boolean {
  let movio = false
  const porOp = new Map<number, ItemSimulacion[]>()
  for (const it of items) {
    if (it.operarioId == null) continue
    const arr = porOp.get(it.operarioId)
    if (arr) arr.push(it)
    else porOp.set(it.operarioId, [it])
  }

  for (const [, arr] of porOp) {
    arr.sort((a, b) => {
      const d = minutosAbsolutos(a.inicio) - minutosAbsolutos(b.inicio)
      if (d !== 0) return d
      if (anclas.has(a.id)) return -1
      if (anclas.has(b.id)) return 1
      return a.id - b.id
    })

    let movioEste = false
    for (let i = 0; i < arr.length - 1 && !movioEste; i++) {
      const A = arr[i]
      const finA = finOpDe(A, ctxs)
      const finAMin = minutosAbsolutos(finA)
      const aAncla = anclas.has(A.id)

      for (let j = i + 1; j < arr.length; j++) {
        const B = arr[j]
        // ¿B empieza antes del fin de A + gap? Si no, tampoco los siguientes (ordenados).
        if (minutosAbsolutos(B.inicio) >= finAMin + gap) break
        if (exentoPorSetup(A, B)) continue

        if (!anclas.has(B.id)) {
          // Empujar B después del fin de A + gap.
          const nuevo = ajustarAJornada({ fecha: finA.fecha, min: finA.min + gap }, ctxDe(B, ctxs))
          if (nuevo.fecha !== B.inicio.fecha || nuevo.min !== B.inicio.min) {
            B.inicio = nuevo
            movio = true
            movioEste = true
            break
          }
        } else if (!aAncla) {
          // B es ancla y A no: la ancla manda, se mueve A después del fin de B.
          const finB = finOpDe(B, ctxs)
          const nuevo = ajustarAJornada({ fecha: finB.fecha, min: finB.min + gap }, ctxDe(A, ctxs))
          if (nuevo.fecha !== A.inicio.fecha || nuevo.min !== A.inicio.min) {
            A.inicio = nuevo
            movio = true
            movioEste = true
            break
          }
        }
        // Ambas anclas: conflicto residual (se detectará con las invariantes al integrar).
      }
    }
  }
  return movio
}

// --- Push por máquina ---------------------------------------------------------

// Una pasada de push por máquina. Dos procesos en la misma máquina no pueden
// pisarse (sin excepción setup_solapable: eso es solo del eje operario). Empuja
// el de más tarde después del fin de MÁQUINA del anterior + gap. Mueve, por cada
// máquina, un par en conflicto y deja que el punto fijo re-evalúe.
function pushMaquina(
  items: ItemSimulacion[],
  anclas: Set<number>,
  ctxs: Map<number, ContextoOperario>,
  gap: number,
): boolean {
  let movio = false
  const porMaq = new Map<number, ItemSimulacion[]>()
  for (const it of items) {
    if (it.maquinaId == null) continue
    const arr = porMaq.get(it.maquinaId)
    if (arr) arr.push(it)
    else porMaq.set(it.maquinaId, [it])
  }

  for (const [, arr] of porMaq) {
    arr.sort((a, b) => {
      const d = minutosAbsolutos(a.inicio) - minutosAbsolutos(b.inicio)
      if (d !== 0) return d
      if (anclas.has(a.id)) return -1
      if (anclas.has(b.id)) return 1
      return a.id - b.id
    })

    let movioEsta = false
    for (let i = 0; i < arr.length - 1 && !movioEsta; i++) {
      const A = arr[i]
      const B = arr[i + 1]
      const finA = finMaqDe(A, ctxs)
      // ¿B empieza antes del fin de máquina de A + gap?
      if (minutosAbsolutos(B.inicio) >= minutosAbsolutos(finA) + gap) continue

      if (!anclas.has(B.id)) {
        const nuevo = ajustarAJornada({ fecha: finA.fecha, min: finA.min + gap }, ctxDe(B, ctxs))
        if (nuevo.fecha !== B.inicio.fecha || nuevo.min !== B.inicio.min) {
          B.inicio = nuevo
          movio = true
          movioEsta = true
        }
      } else if (!anclas.has(A.id)) {
        const finB = finMaqDe(B, ctxs)
        const nuevo = ajustarAJornada({ fecha: finB.fecha, min: finB.min + gap }, ctxDe(A, ctxs))
        if (nuevo.fecha !== A.inicio.fecha || nuevo.min !== A.inicio.min) {
          A.inicio = nuevo
          movio = true
          movioEsta = true
        }
      }
      // Ambas anclas: conflicto residual (se detectará con las invariantes al integrar).
    }
  }
  return movio
}

// --- Correlatividades ---------------------------------------------------------

// Una pasada de correlatividades: cada sucesor debe arrancar después del fin de
// MÁQUINA de su predecesor + gap. Si queda antes, se empuja el sucesor.
//   - Si el predecesor no está en la simulación (no planificado, hecho, pasado),
//     no restringe: el motor no se bloquea; la inconsistencia la marcan las
//     invariantes aparte.
//   - Si el sucesor es un ancla y viola, queda como conflicto residual.
function enforceCorrelatividades(
  items: ItemSimulacion[],
  anclas: Set<number>,
  ctxs: Map<number, ContextoOperario>,
  gap: number,
  correlatividades: ParCorrelatividad[],
): boolean {
  let movio = false
  const porId = new Map(items.map((it): [number, ItemSimulacion] => [it.id, it]))
  for (const c of correlatividades) {
    const suc = porId.get(c.sucesorId)
    if (!suc) continue
    const pred = porId.get(c.predecesorId)
    if (!pred) continue // predecesor ausente: no restringe (la inconsistencia se marca aparte)

    const finPred = finMaqDe(pred, ctxs)
    if (minutosAbsolutos(suc.inicio) >= minutosAbsolutos(finPred) + gap) continue // el sucesor ya arranca después
    if (anclas.has(suc.id)) continue // sucesor ancla: conflicto residual

    const nuevo = ajustarAJornada({ fecha: finPred.fecha, min: finPred.min + gap }, ctxDe(suc, ctxs))
    if (nuevo.fecha !== suc.inicio.fecha || nuevo.min !== suc.inicio.min) {
      suc.inicio = nuevo
      movio = true
    }
  }
  return movio
}

// --- Orquestador (punto fijo) -------------------------------------------------

function claveInicio(it: ItemSimulacion): string {
  return `${it.inicio.fecha}#${it.inicio.min}`
}

export function simular(
  estadoInicial: ItemSimulacion[],
  anclasIds: number[],
  ctxs: Map<number, ContextoOperario>,
  config: ConfigSimulacion,
  correlatividades: ParCorrelatividad[] = [],
): ResultadoSimulacion {
  // Copia del estado (no mutar el input).
  const items = estadoInicial.map((it) => ({ ...it, inicio: { ...it.inicio } }))
  const inicial = new Map(items.map((it) => [it.id, claveInicio(it)]))
  const anclas = new Set(anclasIds)
  const maxIter = config.maxIteraciones ?? MAX_ITER_DEFAULT

  for (let iter = 0; iter < maxIter; iter++) {
    let algo = false
    if (cascadaOperario(items, anclas, ctxs, config.gapMin)) algo = true
    if (pushMaquina(items, anclas, ctxs, config.gapMin)) algo = true
    if (enforceCorrelatividades(items, anclas, ctxs, config.gapMin, correlatividades)) algo = true
    // (d) pulmones: próximo paso.
    if (!algo) {
      // Convergió. Chequear que no queden solapes de recurso (típicamente dos
      // anclas que se pisan y no se pudieron mover): sería un plan imposible.
      const bloques = items.map((it) => itemABloque(it, ctxs))
      const solapes = validarInvariantes(bloques, correlatividades).filter(
        (v) => v.tipo === 'solape_maquina' || v.tipo === 'solape_operario',
      )
      if (solapes.length > 0) {
        return { ok: false, error: 'conflicto_no_resoluble', detalle: { solapes } }
      }
      const movidos = items.filter((it) => inicial.get(it.id) !== claveInicio(it)).map((it) => it.id)
      return { ok: true, items, movidos }
    }
  }
  return { ok: false, error: 'no_converge', detalle: { iteraciones: maxIter } }
}
