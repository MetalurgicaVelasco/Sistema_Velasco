// features/tablero/motor/invariantes.ts
// -----------------------------------------------------------------------------
// Las reglas DURAS que un plan válido nunca puede violar. Se verifican sobre un
// estado (una lista de bloques ya calculados) y devuelven las violaciones.
//
//   1) Una máquina no puede tener dos procesos a la vez.
//   2) Un operario no puede tener dos procesos a la vez (el viejo NO validaba
//      esto; es la corrección principal). Con la excepción setup_solapable.
//   3) Un proceso no puede empezar antes de que su predecesor esté terminado;
//      y un sucesor planificado exige que su predecesor esté planificado.
//
// Trabaja sobre BloqueCalculado: cada proceso con sus dos intervalos de ocupación
// (operario y máquina) YA resueltos. El armado proceso→bloque (con el calendario)
// es otra pieza. Los solapes usan gap 0 (imposible físico); el gap de la config
// es para la cascada, no para las invariantes.
// -----------------------------------------------------------------------------

import { diffDias } from '../../../shared/lib/fechas'
import type { ModoProceso } from '../../produccion/procesoTipos'
import { reglaDe } from './modos'
import { seSolapan, type Intervalo } from './solapes'
import type { Momento } from './calendario'

// Un proceso planificado con sus dos intervalos de ocupación ya calculados.
export type BloqueCalculado = {
  id: number
  operarioId: number | null
  maquinaId: number | null
  modo: ModoProceso
  setupSolapable: boolean
  intervaloOperario: Intervalo
  intervaloMaquina: Intervalo
}

export type Violacion =
  | { tipo: 'solape_maquina'; aId: number; bId: number; maquinaId: number }
  | { tipo: 'solape_operario'; aId: number; bId: number; operarioId: number }
  | { tipo: 'correlatividad'; predId: number; sucId: number }
  | { tipo: 'predecesor_sin_planificar'; predId: number; sucId: number }

// Par de ids de una correlatividad (estructura mínima; el tipo Correlatividad la satisface).
type ParCorrelatividad = { predecesorId: number; sucesorId: number }

function minAbs(m: Momento): number {
  return diffDias('2000-01-01', m.fecha) * 1440 + m.min
}

// Agrupa bloques por un recurso (operario o máquina), ignorando los que no lo tienen.
function agruparPor(
  bloques: BloqueCalculado[],
  recurso: (b: BloqueCalculado) => number | null,
): Map<number, BloqueCalculado[]> {
  const grupos = new Map<number, BloqueCalculado[]>()
  for (const b of bloques) {
    const k = recurso(b)
    if (k == null) continue
    const arr = grupos.get(k)
    if (arr) arr.push(b)
    else grupos.set(k, [b])
  }
  return grupos
}

// ¿La excepción setup_solapable exime este par en el eje operario? Si una es
// auto/semi con setup_solapable y la otra es manual, el setup se monta sobre la
// manual y no cuenta como conflicto de operario.
function exentoPorSetup(a: BloqueCalculado, b: BloqueCalculado): boolean {
  const aLibera = reglaDe(a.modo).operarioSoloSetup
  const bLibera = reglaDe(b.modo).operarioSoloSetup
  const aExime = aLibera && a.setupSolapable && !bLibera
  const bExime = bLibera && b.setupSolapable && !aLibera
  return aExime || bExime
}

// Solapes de máquina: dos procesos en la misma máquina cuyos intervalos de
// máquina se pisan.
export function solapesMaquina(bloques: BloqueCalculado[]): Violacion[] {
  const out: Violacion[] = []
  for (const [maquinaId, arr] of agruparPor(bloques, (b) => b.maquinaId)) {
    for (let i = 0; i < arr.length; i++) {
      for (let j = i + 1; j < arr.length; j++) {
        if (seSolapan(arr[i].intervaloMaquina, arr[j].intervaloMaquina)) {
          out.push({ tipo: 'solape_maquina', aId: arr[i].id, bId: arr[j].id, maquinaId })
        }
      }
    }
  }
  return out
}

// Solapes de operario: dos procesos del mismo operario cuyos intervalos de
// operario se pisan, salvo la excepción setup_solapable.
export function solapesOperario(bloques: BloqueCalculado[]): Violacion[] {
  const out: Violacion[] = []
  for (const [operarioId, arr] of agruparPor(bloques, (b) => b.operarioId)) {
    for (let i = 0; i < arr.length; i++) {
      for (let j = i + 1; j < arr.length; j++) {
        if (
          seSolapan(arr[i].intervaloOperario, arr[j].intervaloOperario) &&
          !exentoPorSetup(arr[i], arr[j])
        ) {
          out.push({ tipo: 'solape_operario', aId: arr[i].id, bId: arr[j].id, operarioId })
        }
      }
    }
  }
  return out
}

// Correlatividades: para cada par predecesor→sucesor,
//   - si el sucesor no está planificado, no restringe;
//   - si el sucesor está pero el predecesor no, es inconsistencia;
//   - si ambos están, el fin de máquina del predecesor no puede caer después del
//     inicio del sucesor.
export function violacionesCorrelatividad(
  bloques: BloqueCalculado[],
  correlatividades: ParCorrelatividad[],
): Violacion[] {
  const out: Violacion[] = []
  const porId = new Map(bloques.map((b): [number, BloqueCalculado] => [b.id, b]))
  for (const c of correlatividades) {
    const suc = porId.get(c.sucesorId)
    if (!suc) continue
    const pred = porId.get(c.predecesorId)
    if (!pred) {
      out.push({ tipo: 'predecesor_sin_planificar', predId: c.predecesorId, sucId: c.sucesorId })
      continue
    }
    if (minAbs(pred.intervaloMaquina.fin) > minAbs(suc.intervaloMaquina.inicio)) {
      out.push({ tipo: 'correlatividad', predId: c.predecesorId, sucId: c.sucesorId })
    }
  }
  return out
}

// Todas las violaciones de un estado, juntas.
export function validarInvariantes(
  bloques: BloqueCalculado[],
  correlatividades: ParCorrelatividad[],
): Violacion[] {
  return [
    ...solapesMaquina(bloques),
    ...solapesOperario(bloques),
    ...violacionesCorrelatividad(bloques, correlatividades),
  ]
}
