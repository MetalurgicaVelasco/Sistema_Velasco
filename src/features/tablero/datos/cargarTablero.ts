// features/tablero/datos/cargarTablero.ts
// -----------------------------------------------------------------------------
// Orquesta toda la lectura del tablero: trae de Supabase lo que el cruce necesita
// y devuelve los BloqueVisual listos para dibujar, más el personal (columnas) y la
// ventana (días visibles y horaria).
//
// Toca la base: no se testea con Vitest; se valida compilando y viéndolo en
// pantalla. Los nombres de columna están verificados contra el esquema real.
// -----------------------------------------------------------------------------

import { supabase } from '../../../shared/lib/supabaseClient'
import { hoyISO, sumarDias } from '../../../shared/lib/fechas'
import { cargarConfigTablero } from '../configTablero'
import {
  cargarProcesosPlanificados,
  cargarPersonalTablero,
  cargarMaquinasTablero,
  cargarVacaciones,
  cargarCorrelatividadesDe,
} from './consultas'
import {
  armarBloquesVisuales,
  type BloqueVisual,
  type ElementoMin,
  type ProyectoMin,
} from './bloquesVisuales'
import { materialSimulacion, type MaterialSimulacion } from './materialSim'
import { cargarProcesosElegibles, type ProcesoElegible } from './elegibles'
import { diaLaboralAnterior } from '../motor/pasado'
import type { PersonalTablero, MaquinaTablero } from '../tipos'
import type { Correlatividad } from '../../produccion/procesoTipos'

/* eslint-disable @typescript-eslint/no-explicit-any */

// Elementos de un conjunto de ids, MÁS toda su cadena de ancestros (subiendo por
// parent_elemento_id). Los ancestros se necesitan para heredar la foto: si un
// elemento no tiene, se usa la del padre, y así hacia arriba.
async function cargarElementos(ids: number[]): Promise<Map<number, ElementoMin>> {
  const m = new Map<number, ElementoMin>()
  if (!ids.length) return m

  let pendientes = ids
  // Sube de a un nivel por vuelta; en la práctica son 2-3 niveles.
  while (pendientes.length) {
    const { data, error } = await supabase
      .from('elementos')
      .select('id, descripcion, cantidad, foto_url, proyecto_id, parent_elemento_id')
      .in('id', pendientes)
    if (error) throw new Error(error.message)
    for (const r of (data ?? []) as any[]) {
      m.set(r.id, {
        descripcion: r.descripcion,
        cantidad: Number(r.cantidad),
        fotoUrl: r.foto_url,
        proyectoId: r.proyecto_id,
        parentId: r.parent_elemento_id ?? null,
      })
    }
    // Padres que todavía no tenemos cargados.
    pendientes = [
      ...new Set(
        (data ?? [])
          .map((r: any) => r.parent_elemento_id as number | null)
          .filter((p): p is number => p != null && !m.has(p)),
      ),
    ]
  }
  return m
}

// Proyectos de un conjunto de ids, con el nombre de la empresa (join).
async function cargarProyectos(ids: number[]): Promise<Map<number, ProyectoMin>> {
  const m = new Map<number, ProyectoMin>()
  if (!ids.length) return m
  const { data, error } = await supabase
    .from('proyectos')
    .select('id, urgencia, pedido_nro, foto_url, empresa:empresas!empresa_id ( nombre )')
    .in('id', ids)
  if (error) throw new Error(error.message)
  for (const r of (data ?? []) as any[]) {
    m.set(r.id, {
      urgencia: r.urgencia,
      pedidoNro: r.pedido_nro,
      clienteNombre: r.empresa?.nombre ?? '',
      fotoUrl: r.foto_url ?? null,
    })
  }
  return m
}

// Catálogo de tipos de proceso (id → nombre).
async function cargarTiposProceso(): Promise<Map<number, string>> {
  const m = new Map<number, string>()
  const { data, error } = await supabase.from('tipos_proceso').select('id, nombre')
  if (error) throw new Error(error.message)
  for (const r of (data ?? []) as any[]) m.set(r.id, r.nombre)
  return m
}

/* eslint-enable @typescript-eslint/no-explicit-any */

export type TableroCargado = {
  bloques: BloqueVisual[]
  personal: PersonalTablero[]
  desde: string
  hasta: string
  ventanaInicio: string // 'HH:MM'
  ventanaFin: string // 'HH:MM'
  // Material para simular movimientos (drag & drop):
  materialSim: MaterialSimulacion
  correlatividades: Correlatividad[]
  gap: number
  maquinas: MaquinaTablero[] // catálogo para reasignar máquina en el modal
  elegibles: ProcesoElegible[] // procesos sin planificar disponibles para el "+"
}

export async function cargarTablero(): Promise<TableroCargado> {
  const config = await cargarConfigTablero()
  const hoy = hoyISO()
  const desde = sumarDias(hoy, -config.diasAtras)
  const hasta = sumarDias(hoy, config.diasAdelante)

  // Lecturas independientes en paralelo.
  const [procesos, personalArr, maquinasArr, vacaciones, tiposProceso] = await Promise.all([
    cargarProcesosPlanificados(desde, hasta),
    cargarPersonalTablero(),
    cargarMaquinasTablero(),
    cargarVacaciones(desde, hasta),
    cargarTiposProceso(),
  ])

  // Segundo nivel en paralelo: elementos, correlatividades y elegibles dependen de
  // las lecturas anteriores pero no entre sí, así que van juntos (antes iban en serie).
  const maquinasMap = new Map(maquinasArr.map((mq) => [mq.id, mq]))
  const [elementos, correlatividades, elegibles] = await Promise.all([
    cargarElementos([...new Set(procesos.map((p) => p.elementoId))]),
    cargarCorrelatividadesDe(procesos.map((p) => p.id)),
    cargarProcesosElegibles(tiposProceso, maquinasMap),
  ])

  // Proyectos sí depende de los elementos, por eso queda en su propio nivel.
  const proyectos = await cargarProyectos([...new Set([...elementos.values()].map((e) => e.proyectoId))])

  const personalMap = new Map(personalArr.map((p) => [p.id, p]))

  const bloques = armarBloquesVisuales({
    procesos,
    elementos,
    proyectos,
    tiposProceso,
    maquinas: maquinasMap,
    personal: personalMap,
    vacaciones,
  })

  // Material para simular movimientos: items del motor + contextos de operarios.
  const cantidadPorElemento = new Map<number, number>()
  for (const [id, e] of elementos) cantidadPorElemento.set(id, e.cantidad)
  const corte = diaLaboralAnterior(hoy)
  const materialSim = materialSimulacion(procesos, cantidadPorElemento, personalMap, vacaciones, corte)

  return {
    bloques,
    personal: personalArr,
    desde,
    hasta,
    ventanaInicio: config.ventanaInicio,
    ventanaFin: config.ventanaFin,
    materialSim,
    correlatividades,
    gap: config.gapMin,
    maquinas: maquinasArr,
    elegibles,
  }
}
