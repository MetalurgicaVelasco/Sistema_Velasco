// features/tablero/datos/bloquesVisuales.ts
// -----------------------------------------------------------------------------
// El cruce que arma, para el render, todo lo dibujable de cada bloque. Recibe los
// datos ya cargados (procesos, elementos, proyectos, recursos) y por cada proceso
// planificado genera UN BloqueVisual por fragmento visible (partición multi-día),
// con su carril ya asignado.
//
// Función pura: no toca la base. Las lecturas de Supabase van aparte.
//
// La urgencia, el cliente y el pedido salen del PROYECTO (referenciado vía el
// elemento), no de una copia en el proceso: una sola fuente de verdad.
// -----------------------------------------------------------------------------

import { horaAMin, type FechaISO } from '../../../shared/lib/fechas'
import { tiemposDe } from '../motor/duraciones'
import { reglaDe } from '../motor/modos'
import { contextoOperario } from '../motor/preparar'
import { hayDivergencia } from '../motor/divergencias'
import { fragmentos } from '../calculos/fragmentos'
import { asignarTracks } from '../calculos/geometria'
import type { ProcesoTablero, PersonalTablero, MaquinaTablero, Vacacion } from '../tipos'

// Datos mínimos que el cruce necesita de cada tabla.
export type ElementoMin = {
  descripcion: string
  cantidad: number
  fotoUrl: string | null
  proyectoId: number
}
export type ProyectoMin = {
  urgencia: string
  pedidoNro: string | null
  clienteNombre: string
}

export type DatosTablero = {
  procesos: ProcesoTablero[]
  elementos: Map<number, ElementoMin>
  proyectos: Map<number, ProyectoMin>
  tiposProceso: Map<number, string> // id → nombre
  maquinas: Map<number, MaquinaTablero>
  personal: Map<number, PersonalTablero>
  vacaciones: Vacacion[]
}

// Todo lo que se dibuja de un bloque, ya cruzado. Un BloqueVisual = un fragmento
// visible (si el proceso cruza días, hay varios, numerados parte/totalPartes).
export type BloqueVisual = {
  procesoId: number
  elementoId: number
  // Ubicación (minutos crudos; el % lo calcula el render con la ventana de config)
  operarioId: number
  fecha: FechaISO
  inicioMin: number
  finMin: number
  track: number
  parte: number
  totalPartes: number
  // Contenido
  descripcion: string
  cantidad: number
  tipoProceso: string
  cliente: string
  pedidoNro: string | null
  operarioNombre: string
  maquinaNombre: string | null
  // Estilo
  urgencia: string
  maquinaColor: string | null
  hecho: boolean
  // Flags / badges
  esRetrabajo: boolean
  hayDivergencia: boolean
  procesoEliminado: boolean
  fotoUrl: string | null
}

function nombreCompleto(p: PersonalTablero): string {
  return `${p.nombre} ${p.apellido ?? ''}`.trim()
}

function estaPlanificado(p: ProcesoTablero): boolean {
  return !!p.planFecha && !!p.planHora && p.planOperarioId != null
}

export function armarBloquesVisuales(datos: DatosTablero): BloqueVisual[] {
  // Parte intermedia: cada fragmento con sus datos de display (sin carril todavía).
  const conDatos: Array<Omit<BloqueVisual, 'track'> & { esAuto: boolean }> = []

  for (const p of datos.procesos) {
    if (!estaPlanificado(p) || p.procesoEliminado) continue
    const elemento = datos.elementos.get(p.elementoId)
    const operario = datos.personal.get(p.planOperarioId as number)
    if (!elemento || !operario) continue

    const proyecto = datos.proyectos.get(elemento.proyectoId)
    const cantidad = elemento.cantidad > 0 ? elemento.cantidad : 1
    const tiempos = tiemposDe(p, cantidad)
    const ctx = contextoOperario(operario, datos.vacaciones)
    const inicio = { fecha: p.planFecha as FechaISO, min: horaAMin(p.planHora as string) }
    const frags = fragmentos(inicio, tiempos, ctx)
    const esAuto = reglaDe(tiempos.modo).operarioSoloSetup

    const maquina = p.planMaquinaId != null ? datos.maquinas.get(p.planMaquinaId) : undefined
    const tipoProceso =
      (p.tipoProcesoId != null ? datos.tiposProceso.get(p.tipoProcesoId) : undefined) ??
      p.procesoOtro ??
      ''

    const comun = {
      procesoId: p.id,
      elementoId: p.elementoId,
      operarioId: p.planOperarioId as number,
      descripcion: elemento.descripcion,
      cantidad,
      tipoProceso,
      cliente: proyecto?.clienteNombre ?? '',
      pedidoNro: proyecto?.pedidoNro ?? null,
      operarioNombre: nombreCompleto(operario),
      maquinaNombre: maquina?.nombre ?? p.maquinaOtra ?? null,
      urgencia: proyecto?.urgencia ?? 'media',
      maquinaColor: maquina?.color ?? null,
      hecho: p.estado === 'hecho',
      esRetrabajo: p.esRetrabajo,
      hayDivergencia: hayDivergencia(p, cantidad),
      procesoEliminado: p.procesoEliminado,
      fotoUrl: elemento.fotoUrl,
      esAuto,
    }

    for (const f of frags) {
      conDatos.push({
        ...comun,
        fecha: f.fecha,
        inicioMin: f.inicioMin,
        finMin: f.finMin,
        parte: f.parte,
        totalPartes: f.totalPartes,
      })
    }
  }

  // Asignar carriles (mismo orden de entrada y salida).
  const tracks = asignarTracks(
    conDatos.map((c) => ({
      procesoId: c.procesoId,
      operarioId: c.operarioId,
      esAuto: c.esAuto,
      fecha: c.fecha,
      inicioMin: c.inicioMin,
      finMin: c.finMin,
    })),
  )

  return conDatos.map((c, i) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { esAuto, ...resto } = c
    return { ...resto, track: tracks[i].track }
  })
}
