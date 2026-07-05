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

import { jornada } from '../../../shared/lib/jornada'
import { sumarDias, diffDias, type FechaISO } from '../../../shared/lib/fechas'
import { finOperario, finMaquina, type ContextoOperario, type Momento } from './calendario'
import { reglaDe } from './modos'
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
  | { ok: false; error: 'no_converge'; detalle?: unknown }

export type ConfigSimulacion = {
  gapMin: number
  maxIteraciones?: number
}

const MAX_ITER_DEFAULT = 200
const MAX_DIAS = 366

// --- Utilidades de tiempo -----------------------------------------------------
// DEUDA MENOR: `minAbs`, `trabaja`, `proximoDiaLaboral` y `ajustarAJornada` se
// solapan con lógica de calendario.ts. Están acá para no reentregar archivos ya
// cerrados; a futuro conviene unificarlas en calendario.ts.

function minAbs(m: Momento): number {
  return diffDias('2000-01-01', m.fecha) * 1440 + m.min
}

function trabaja(ctx: ContextoOperario, fecha: FechaISO): boolean {
  return jornada(ctx.operario, fecha).trabaja && !ctx.esVacaciones(fecha)
}

function proximoDiaLaboral(ctx: ContextoOperario, fecha: FechaISO): FechaISO {
  let f = sumarDias(fecha, 1)
  let g = 0
  while (!trabaja(ctx, f)) {
    f = sumarDias(f, 1)
    if (++g > MAX_DIAS) throw new Error(`No hay día laboral cerca de ${fecha}`)
  }
  return f
}

// Lleva un momento al primer instante laboral válido a partir de él: si cae
// antes de la jornada, al inicio; si cae en/después del fin, al inicio del
// próximo día laboral; si el día no es laboral, salta.
function ajustarAJornada(m: Momento, ctx: ContextoOperario): Momento {
  let fecha = m.fecha
  let min = m.min
  let g = 0
  while (!trabaja(ctx, fecha)) {
    fecha = sumarDias(fecha, 1)
    min = 0
    if (++g > MAX_DIAS) throw new Error(`No hay día laboral cerca de ${m.fecha}`)
  }
  const t = jornada(ctx.operario, fecha)
  if (min < t.inicioMin) min = t.inicioMin
  if (min >= t.finMin) {
    fecha = proximoDiaLaboral(ctx, fecha)
    min = jornada(ctx.operario, fecha).inicioMin
  }
  return { fecha, min }
}

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
      const d = minAbs(a.inicio) - minAbs(b.inicio)
      if (d !== 0) return d
      if (anclas.has(a.id)) return -1
      if (anclas.has(b.id)) return 1
      return a.id - b.id
    })

    let movioEste = false
    for (let i = 0; i < arr.length - 1 && !movioEste; i++) {
      const A = arr[i]
      const finA = finOpDe(A, ctxs)
      const finAMin = minAbs(finA)
      const aAncla = anclas.has(A.id)

      for (let j = i + 1; j < arr.length; j++) {
        const B = arr[j]
        // ¿B empieza antes del fin de A + gap? Si no, tampoco los siguientes (ordenados).
        if (minAbs(B.inicio) >= finAMin + gap) break
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
      const d = minAbs(a.inicio) - minAbs(b.inicio)
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
      if (minAbs(B.inicio) >= minAbs(finA) + gap) continue

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

// --- Orquestador (punto fijo) -------------------------------------------------

function claveInicio(it: ItemSimulacion): string {
  return `${it.inicio.fecha}#${it.inicio.min}`
}

export function simular(
  estadoInicial: ItemSimulacion[],
  anclasIds: number[],
  ctxs: Map<number, ContextoOperario>,
  config: ConfigSimulacion,
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
    // (c) correlatividades, (d) pulmones: próximos pasos.
    if (!algo) {
      const movidos = items.filter((it) => inicial.get(it.id) !== claveInicio(it)).map((it) => it.id)
      return { ok: true, items, movidos }
    }
  }
  return { ok: false, error: 'no_converge', detalle: { iteraciones: maxIter } }
}
