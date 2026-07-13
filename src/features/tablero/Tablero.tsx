// features/tablero/Tablero.tsx
// -----------------------------------------------------------------------------
// Tablero por operario: grilla con operarios en columnas y días en filas, con los
// bloques posicionados en su hora y carril reales.
//
// Interacción: los bloques se arrastran (dnd-kit) y las celdas los reciben. Por
// ahora el drop solo se DETECTA (muestra dónde cayó); mover y guardar viene en
// los sub-pasos siguientes.
// -----------------------------------------------------------------------------

import { Fragment, useEffect, useRef, useState, type MouseEvent } from 'react'
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  useDraggable, useDroppable, type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core'
import { cargarTablero, type TableroCargado } from './datos/cargarTablero'
import type { ProcesoElegible } from './datos/elegibles'
import { porcentajeLeft, porcentajeAncho } from './calculos/geometria'
import { fotoPublica } from './calculos/foto'
import Modal from '../../shared/components/Modal'
import { snapearInsercion, type Ocupacion } from './calculos/insercion'
import { simular, type ItemSimulacion, type ResultadoSimulacion } from './motor/simular'
import { finMaquina, type ContextoOperario } from './motor/calendario'
import type { Tiempos } from './motor/duraciones'
import { armarPlan, aplicarPlan, actualizarUrgencia, quitarDelTablero, cambiarEstadoProceso, guardarOrdenOperarios, type CambioPlan } from './datos/escritura'
import type { BloqueVisual } from './datos/bloquesVisuales'
import type { Divergencia } from './motor/divergencias'
import type { ModoProceso } from '../produccion/procesoTipos'
import type { PersonalTablero, MaquinaTablero } from './tipos'
import { horaAMin, parseFecha, hoyISO, sumarDias, sumarHabiles, type FechaISO } from '../../shared/lib/fechas'
import { jornada } from '../../shared/lib/jornada'
import './tablero.css'

// Urgencia → fondo y color de texto del bloque (del CSS viejo).
const FONDO_URGENCIA: Record<string, string> = {
  urgente: '#1A1A1A', alta: '#FF9B9B', media: '#F0D47A', baja: '#BDECB6',
}
const TEXTO_URGENCIA: Record<string, string> = {
  urgente: '#ffffff', alta: '#000000', media: '#000000', baja: '#000000',
}

const ALTO_FILA = 208 // px (2 carriles de 104)
const MIN_CARRILES = 2

const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

function nombreDia(fecha: FechaISO): string {
  const d = parseFecha(fecha)
  return `${DIAS[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`
}

function nombreCorto(op: PersonalTablero): string {
  return op.apellido ? `${op.nombre} ${op.apellido[0]}.` : op.nombre
}

function minAHora(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

type PlanCrudo = { ok: true; cambios: CambioPlan[]; movidos: number[] } | { ok: false; error: string }

export default function Tablero({ onAcciones }: { onAcciones?: (n: React.ReactNode) => void }) {
  const [datos, setDatos] = useState<TableroCargado | null>(null)
  // Fecha que ancla la ventana de días visible. Se corre por semanas con los
  // botones ◀ / Hoy / ▶. Arranca en hoy.
  const [fechaBase, setFechaBase] = useState<FechaISO>(hoyISO())
  const [error, setError] = useState<string | null>(null)
  const [tip, setTip] = useState<{ b: BloqueVisual; x: number; y: number } | null>(null)
  const [dragActivo, setDragActivo] = useState<BloqueVisual | null>(null)
  const [planCrudo, setPlanCrudo] = useState<PlanCrudo | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [errorGuardar, setErrorGuardar] = useState<string | null>(null)
  const [anclaBase, setAnclaBase] = useState<{
    procesoId: number
    operarioId: number
    maquinaId: number | null
    tiempos?: Tiempos
  } | null>(null)
  const [edicion, setEdicion] = useState<{ fecha: string; hora: string }>({ fecha: '', hora: '' })
  const [historialUndo, setHistorialUndo] = useState<CambioPlan[][]>([])
  const [errorUndo, setErrorUndo] = useState<string | null>(null)
  const [modalActividad, setModalActividad] = useState<BloqueVisual | null>(null)
  const [selector, setSelector] = useState<{ operarioId: number; fecha: FechaISO } | null>(null)
  const [modalOrden, setModalOrden] = useState(false)

  // Publica el botón "Orden" a la derecha de la fila de módulos (no ocupa alto
  // dentro del tablero, donde el espacio vertical es valioso).
  useEffect(() => {
    onAcciones?.(
      <>
        <button
          className="tab-btn-sec"
          onClick={() => setFechaBase((f) => sumarDias(f, -7))}
          title="Semana anterior"
        >
          ◀ Semana
        </button>
        <button
          className="tab-btn-sec"
          onClick={() => setFechaBase(hoyISO())}
          disabled={fechaBase === hoyISO()}
          title="Volver a hoy"
        >
          Hoy
        </button>
        <button
          className="tab-btn-sec"
          onClick={() => setFechaBase((f) => sumarDias(f, 7))}
          title="Semana siguiente"
        >
          Semana ▶
        </button>
        <button className="tab-btn-sec" onClick={() => setModalOrden(true)} title="Reordenar columnas del tablero">
          ⇄ Orden
        </button>
      </>,
    )
    return () => onAcciones?.(null)
  }, [onAcciones, fechaBase])
  const [insertar, setInsertar] = useState<{
    el: ProcesoElegible
    opciones: { label: string; startMin: number }[]
  } | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Hay que mover ~5px para que empiece el arrastre (un click simple no dispara drag).
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  useEffect(() => {
    // Si la ventana visible ya está dentro de lo cargado (el colchón), no se
    // recarga: cambiar de semana solo re-renderiza (instantáneo). Se recarga
    // (y re-centra el colchón) al montar o al salirse del rango cargado.
    if (datos) {
      const vDesde = sumarHabiles(fechaBase, -datos.diasAtras)
      const vHasta = sumarHabiles(fechaBase, datos.diasAdelante)
      if (vDesde >= datos.desde && vHasta <= datos.hasta) return
    }
    cargarTablero(fechaBase)
      .then(setDatos)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fechaBase])

  if (error) return <div className="tab-estado tab-error">No se pudo cargar el tablero: {error}</div>
  if (!datos) return <div className="tab-estado">Cargando tablero…</div>

  const { bloques, personal, ventanaInicio, ventanaFin } = datos
  const vIni = horaAMin(ventanaInicio)
  const vTotal = horaAMin(ventanaFin) - vIni
  const hoy = hoyISO()

  function mostrarTip(b: BloqueVisual, e: MouseEvent) {
    if (timerRef.current) clearTimeout(timerRef.current)
    const x = e.clientX
    const y = e.clientY
    timerRef.current = setTimeout(() => setTip({ b, x, y }), 800)
  }
  function moverTip(e: MouseEvent) {
    setTip((t) => (t ? { ...t, x: e.clientX, y: e.clientY } : t))
  }
  function ocultarTip() {
    if (timerRef.current) clearTimeout(timerRef.current)
    setTip(null)
  }

  // Guarda el nuevo orden de las columnas (operarios) y recarga el tablero.
  async function guardarOrden(idsEnOrden: number[]) {
    try {
      await guardarOrdenOperarios(idsEnOrden)
      setModalOrden(false)
      const nuevos = await cargarTablero(fechaBase)
      setDatos(nuevos)
    } catch (e) {
      window.alert('No se pudo guardar el orden: ' + (e instanceof Error ? e.message : String(e)))
    }
  }

  function abrirActividad(b: BloqueVisual) {
    ocultarTip()
    setModalActividad(b)
  }

  // Quitar del tablero: devuelve el proceso a "sin planificar" y recarga.
  async function quitarActividad(procesoId: number) {
    setModalActividad(null)
    try {
      await quitarDelTablero(procesoId)
      const nuevos = await cargarTablero(fechaBase)
      setDatos(nuevos)
    } catch (e) {
      window.alert('No se pudo quitar: ' + (e instanceof Error ? e.message : String(e)))
    }
  }

  // Marcar hecho / desanclar: cambia el estado del proceso y recarga.
  async function cambiarEstadoActividad(procesoId: number, estado: 'planificado' | 'hecho') {
    setModalActividad(null)
    try {
      await cambiarEstadoProceso(procesoId, estado)
      const nuevos = await cargarTablero(fechaBase)
      setDatos(nuevos)
    } catch (e) {
      window.alert('No se pudo cambiar el estado: ' + (e instanceof Error ? e.message : String(e)))
    }
  }

  // IDs de procesos marcados "hecho": son anclas duras (el motor no los reacomoda).
  function idsHechos(): number[] {
    if (!datos) return []
    return [...new Set(datos.bloques.filter((bl) => bl.hecho).map((bl) => bl.procesoId))]
  }

  function abrirSelector(operarioId: number, fecha: FechaISO) {
    setSelector({ operarioId, fecha })
  }

  function tiemposDe(el: ProcesoElegible): Tiempos {
    return {
      setupMin: el.setupMin,
      operacionMin: el.operacionMin,
      margenMin: el.margenMin,
      cantidad: el.cantidad,
      modo: el.modo,
    }
  }

  // Crea el item del proceso elegido en una posición y lo simula (sin escribir).
  function simularElegido(el: ProcesoElegible, startMin: number): ResultadoSimulacion | null {
    if (!selector || !datos) return null
    const nuevoItem: ItemSimulacion = {
      id: el.procesoId,
      operarioId: selector.operarioId,
      maquinaId: el.maquinaId,
      tiempos: tiemposDe(el),
      setupSolapable: false,
      inicio: { fecha: selector.fecha, min: startMin },
    }
    const items = [...datos.materialSim.items, nuevoItem]
    return simular(items, [el.procesoId, ...idsHechos()], datos.materialSim.ctxs, { gapMin: datos.gap }, datos.correlatividades)
  }

  // Escribe (o abre el modal del motor) para un proceso elegido ya simulado.
  function aplicarElegido(el: ProcesoElegible, startMin: number, resultado: ResultadoSimulacion) {
    if (!selector) return
    const opId = selector.operarioId
    const fecha = selector.fecha
    setSelector(null)
    setInsertar(null)
    if (!resultado.ok) {
      setPlanCrudo({
        ok: false,
        error:
          resultado.error === 'conflicto_no_resoluble'
            ? 'No se puede planificar acá sin romper una correlatividad o un solape.'
            : 'No se pudo calcular la ubicación.',
      })
      return
    }
    const cambios = armarPlan(resultado, [el.procesoId]).map((c) =>
      c.procesoId === el.procesoId ? { ...c, tiempos: tiemposDe(el) } : c,
    )
    if (resultado.movidos.length === 0) {
      escribirPlan(cambios)
      return
    }
    setPlanCrudo({ ok: true, cambios, movidos: resultado.movidos })
    setAnclaBase({ procesoId: el.procesoId, operarioId: opId, maquinaId: el.maquinaId, tiempos: tiemposDe(el) })
    setEdicion({ fecha, hora: minAHora(startMin) })
    setErrorGuardar(null)
  }

  // Posiciones candidatas: inicio de la jornada + después de cada actividad del
  // operario ese día.
  function opcionesInsercion(operarioId: number, fecha: FechaISO): { label: string; startMin: number }[] {
    if (!datos) return []
    const vIni = horaAMin(datos.ventanaInicio)
    const bloquesOp = datos.bloques
      .filter((b) => b.operarioId === operarioId && b.fecha === fecha)
      .sort((a, b) => a.inicioMin - b.inicioMin)
    const ops = [{ label: 'Al inicio de la jornada', startMin: vIni }]
    for (const b of bloquesOp) {
      ops.push({ label: `Después de ${b.descripcion}`, startMin: b.finMin + datos.gap })
    }
    return ops
  }

  function elegirProceso(el: ProcesoElegible) {
    if (!selector || !datos) return
    const ops = opcionesInsercion(selector.operarioId, selector.fecha)
    // Buscar la primera posición donde el proceso entre sin desplazar a nadie → directo.
    for (const op of ops) {
      const r = simularElegido(el, op.startMin)
      if (r && r.ok && r.movidos.length === 0) {
        aplicarElegido(el, op.startMin, r)
        return
      }
    }
    // Ninguna entra sin cascada → preguntar dónde ubicarlo.
    setInsertar({ el, opciones: ops })
  }

  // Al elegir una posición en el modal "¿dónde lo pongo?": simular ahí y aplicar.
  function insertarEn(startMin: number) {
    if (!insertar) return
    const r = simularElegido(insertar.el, startMin)
    if (r) aplicarElegido(insertar.el, startMin, r)
  }

  // Guarda los cambios del modal de actividad: arma el proceso con su nueva
  // posición/operario/máquina y lo pasa por el motor. Si no reacomoda a nadie se
  // escribe directo; si cascadea o hay conflicto, aparece el modal del motor.
  async function guardarActividad(cambios: {
    operarioId: number
    maquinaId: number | null
    fecha: FechaISO
    hora: string
    tiempos: Tiempos
    setupSolapable: boolean
    urgencia: string
    proyectoId: number
  }) {
    if (!modalActividad) return
    const procesoId = modalActividad.procesoId
    const urgenciaOriginal = modalActividad.urgencia
    setModalActividad(null)
    // Urgencia: vive en el proyecto → UPDATE aparte, primero. Afecta a TODOS los
    // bloques de ese proyecto (por eso el aviso en el modal).
    if (cambios.urgencia !== urgenciaOriginal) {
      try {
        await actualizarUrgencia(cambios.proyectoId, cambios.urgencia)
      } catch (e) {
        window.alert('No se pudo cambiar la urgencia: ' + (e instanceof Error ? e.message : String(e)))
      }
    }
    const min = horaAMin(cambios.hora)
    const plan = calcularPlan(procesoId, cambios.operarioId, cambios.fecha, min, cambios.maquinaId, cambios.tiempos)
    // Enriquecer el cambio del ancla con los tiempos + setup_solapable editados
    // (cambio directo: se escriben en el proceso y en plan_aceptado, sin divergencia).
    const planFull: PlanCrudo = plan.ok
      ? {
          ...plan,
          cambios: plan.cambios.map((c) =>
            c.procesoId === procesoId
              ? {
                  ...c,
                  tiempos: {
                    setupMin: cambios.tiempos.setupMin,
                    operacionMin: cambios.tiempos.operacionMin,
                    margenMin: cambios.tiempos.margenMin,
                    cantidad: cambios.tiempos.cantidad,
                    modo: cambios.tiempos.modo,
                  },
                  setupSolapable: cambios.setupSolapable,
                }
              : c,
          ),
        }
      : plan
    if (planFull.ok && planFull.movidos.length === 0) {
      escribirPlan(planFull.cambios)
      return
    }
    setPlanCrudo(planFull)
    setAnclaBase({ procesoId, operarioId: cambios.operarioId, maquinaId: cambios.maquinaId, tiempos: cambios.tiempos })
    setEdicion({ fecha: cambios.fecha, hora: cambios.hora })
    setErrorGuardar(null)
  }

  function onDragStart(e: DragStartEvent) {
    ocultarTip()
    const procesoId = e.active.data.current?.procesoId as number | undefined
    setDragActivo(bloques.find((b) => b.procesoId === procesoId) ?? null)
  }

  // Simula mover un proceso a (operario, fecha, minuto) y arma el plan resultante.
  // La usan tanto el arrastre (con el minuto snapeado) como "Recalcular" (con el
  // minuto que el usuario escribe a mano, sin snapeo).
  function calcularPlan(
    procesoId: number,
    operarioId: number,
    fecha: FechaISO,
    min: number,
    maquinaId?: number | null,
    tiempos?: Tiempos,
  ): PlanCrudo {
    if (!datos) return { ok: false, error: 'Tablero no cargado.' }
    const original = datos.materialSim.items.find((it) => it.id === procesoId)
    if (!original) {
      return { ok: false, error: 'No se puede mover este bloque (no está en el material de simulación; puede ser pasado).' }
    }
    const items = datos.materialSim.items.map((it) =>
      it.id === procesoId
        ? {
            ...it,
            operarioId,
            maquinaId: maquinaId !== undefined ? maquinaId : it.maquinaId,
            inicio: { fecha, min },
            tiempos: tiempos ?? it.tiempos,
          }
        : it,
    )
    const resultado = simular(items, [procesoId, ...idsHechos()], datos.materialSim.ctxs, { gapMin: datos.gap }, datos.correlatividades)
    if (!resultado.ok) {
      const msg =
        resultado.error === 'conflicto_no_resoluble'
          ? 'El cambio genera un conflicto imposible de resolver: dos bloques fijos se pisan, o un proceso quedaría antes de su predecesor.'
          : 'El motor no logró acomodar el cambio.'
      return { ok: false, error: msg }
    }
    return { ok: true, cambios: armarPlan(resultado, [procesoId]), movidos: resultado.movidos }
  }

  function onDragEnd(e: DragEndEvent) {
    setDragActivo(null)
    if (!datos) return
    const procesoId = e.active.data.current?.procesoId as number | undefined
    const info = e.over?.data.current as { operarioId: number; fecha: FechaISO } | undefined
    const overRect = e.over?.rect
    const activador = e.activatorEvent as PointerEvent | undefined
    if (procesoId == null || !info || !overRect || activador?.clientX == null) return

    // Posición horizontal del CURSOR al soltar → minuto (como el viejo: usa el
    // mouse, no el borde del bloque, así un bloque ancho no se pega al lugar
    // equivocado). clientX del inicio + cuánto se movió (delta).
    const cursorX = activador.clientX + e.delta.x
    const xRel = cursorX - overRect.left
    const dropMinCrudo = vIni + (xRel / overRect.width) * vTotal
    const dropMin = Math.max(vIni, Math.round(dropMinCrudo / 5) * 5)

    // Ocupaciones del operario destino ese día (para automáticas, solo el setup).
    const ocupaciones: Ocupacion[] = bloques
      .filter((b) => b.operarioId === info.operarioId && b.fecha === info.fecha && b.procesoId !== procesoId)
      .map((b) => (b.esAuto ? { inicio: b.inicioMin, fin: b.inicioMin + b.setupMin } : { inicio: b.inicioMin, fin: b.finMin }))
      .filter((o) => o.fin > o.inicio)

    const ctx = datos.materialSim.ctxs.get(info.operarioId)
    const inicioJornada = ctx ? jornada(ctx.operario, info.fecha).inicioMin : vIni
    const dropMinSnap = snapearInsercion(dropMin, ocupaciones, inicioJornada, datos.gap)

    const plan = calcularPlan(procesoId, info.operarioId, info.fecha, dropMinSnap)
    // Si el movimiento no reacomoda a nadie (sin cascada), aplicar directo, sin
    // modal: el Deshacer queda disponible para revertir. El modal solo aparece
    // cuando hay otras actividades que se corren.
    if (plan.ok && plan.movidos.length === 0) {
      escribirPlan(plan.cambios)
      return
    }
    setPlanCrudo(plan)
    setAnclaBase({
      procesoId,
      operarioId: info.operarioId,
      maquinaId: datos.materialSim.items.find((it) => it.id === procesoId)?.maquinaId ?? null,
    })
    setEdicion({ fecha: info.fecha, hora: minAHora(dropMinSnap) })
    setErrorGuardar(null)
  }

  // Re-simula con la fecha/hora que el usuario escribió, sin snapeo.
  function recalcular() {
    if (!anclaBase || !edicion.fecha || !edicion.hora) return
    const min = horaAMin(edicion.hora)
    setPlanCrudo(
      calcularPlan(anclaBase.procesoId, anclaBase.operarioId, edicion.fecha as FechaISO, min, anclaBase.maquinaId, anclaBase.tiempos),
    )
    setErrorGuardar(null)
  }

  // Escribe un plan por la RPC, recarga el tablero y apila el inverso para
  // deshacer. Devuelve true si se escribió sin error.
  async function escribirPlan(cambios: CambioPlan[]): Promise<boolean> {
    if (!datos || !cambios.length) return false
    // Plan inverso: dónde estaban los procesos que se mueven, para poder deshacer.
    const inverso: CambioPlan[] = cambios.map((c) => {
      const orig = datos.materialSim.items.find((it) => it.id === c.procesoId)
      const base: CambioPlan = {
        procesoId: c.procesoId,
        planFecha: orig ? orig.inicio.fecha : c.planFecha,
        planHora: orig ? minAHora(orig.inicio.min) : c.planHora,
        planOperarioId: orig ? orig.operarioId : c.planOperarioId,
        planMaquinaId: orig ? orig.maquinaId : c.planMaquinaId,
        estado: 'planificado',
      }
      // Si el cambio editó tiempos/setup, el inverso restaura los valores previos.
      if (c.tiempos && orig) {
        base.tiempos = {
          setupMin: orig.tiempos.setupMin,
          operacionMin: orig.tiempos.operacionMin,
          margenMin: orig.tiempos.margenMin,
          cantidad: orig.tiempos.cantidad,
          modo: orig.tiempos.modo,
        }
      }
      if (c.setupSolapable !== undefined && orig) base.setupSolapable = orig.setupSolapable
      return base
    })
    setGuardando(true)
    setErrorGuardar(null)
    try {
      await aplicarPlan(cambios) // escribe por la RPC (atómico)
      const nuevos = await cargarTablero(fechaBase) // recarga completa desde la base
      setDatos(nuevos)
      setHistorialUndo((h) => [...h, inverso].slice(-5)) // guarda los últimos 5
      return true
    } catch (e) {
      setErrorGuardar(e instanceof Error ? e.message : String(e))
      return false
    } finally {
      setGuardando(false)
    }
  }

  async function confirmarPlan() {
    if (!planCrudo?.ok) return
    const ok = await escribirPlan(planCrudo.cambios)
    if (ok) {
      setPlanCrudo(null)
      setAnclaBase(null)
    }
  }

  // Deshacer: aplica el último plan inverso de la pila (restaura posiciones que ya
  // eran válidas, sin re-simular) y lo saca de la pila.
  async function deshacer() {
    if (!historialUndo.length) return
    const inverso = historialUndo[historialUndo.length - 1]
    setGuardando(true)
    setErrorUndo(null)
    try {
      await aplicarPlan(inverso)
      const nuevos = await cargarTablero(fechaBase)
      setDatos(nuevos)
      setHistorialUndo((h) => h.slice(0, -1))
    } catch (e) {
      setErrorUndo(e instanceof Error ? e.message : String(e))
    } finally {
      setGuardando(false)
    }
  }

  function cerrarPlan() {
    setPlanCrudo(null)
    setAnclaBase(null)
    setErrorGuardar(null)
  }

  // Ventana VISIBLE (sin domingos) alrededor de la fecha base. Los datos cargados
  // son más anchos (colchón de semanas), así que acá se muestra solo lo pedido.
  const visDesde = sumarHabiles(fechaBase, -datos.diasAtras)
  const visHasta = sumarHabiles(fechaBase, datos.diasAdelante)
  const dias: FechaISO[] = []
  for (let f = visDesde; f <= visHasta; f = sumarDias(f, 1)) {
    if (parseFecha(f).getDay() !== 0) dias.push(f)
  }

  const columnas = `80px repeat(${personal.length}, 400px)`
  const mediodiaPct = porcentajeLeft(720, vIni, vTotal)

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div className="tab-scroll">
        <div className="tab-grid" style={{ gridTemplateColumns: columnas }}>
          {/* Esquina */}
          <div className="tab-hc">
            {ventanaInicio.slice(0, 5)} → {ventanaFin.slice(0, 5)}
          </div>
          {/* Cabeceras de operario */}
          {personal.map((op) => (
            <div key={op.id} className="tab-ho">
              {nombreCorto(op)}
            </div>
          ))}

          {/* Filas de días */}
          {dias.map((dia, idx) => {
            const claseDia = dia === hoy ? 'es-hoy' : dia < hoy ? 'es-pasado' : ''
            const alterna = idx % 2 === 1
            return (
              <Fragment key={dia}>
                <div className={`tab-hr ${claseDia}`} style={{ minHeight: ALTO_FILA + 2 }}>
                  {nombreDia(dia)}
                </div>
                {personal.map((op) => (
                  <Celda
                    key={op.id}
                    operarioId={op.id}
                    fecha={dia}
                    hoy={hoy}
                    alterna={alterna}
                    mediodiaPct={mediodiaPct}
                    bloques={bloques.filter((b) => b.operarioId === op.id && b.fecha === dia)}
                    vIni={vIni}
                    vTotal={vTotal}
                    onEnter={mostrarTip}
                    onMove={moverTip}
                    onLeave={ocultarTip}
                    onAbrir={abrirActividad}
                    onAbrirSelector={abrirSelector}
                  />
                ))}
              </Fragment>
            )
          })}
        </div>
        {tip ? <Tooltip tip={tip} /> : null}
        {planCrudo ? (
          <Modal titulo="Plan calculado — todavía no se guarda" onCerrar={cerrarPlan} ancho={520}>
            {planCrudo.ok ? (
              planCrudo.cambios.length ? (
                <ul className="tab-plan-lista">
                  {planCrudo.cambios.map((c) => {
                    const b = bloques.find((x) => x.procesoId === c.procesoId)
                    const orig = datos.materialSim.items.find((it) => it.id === c.procesoId)
                    const op = personal.find((p) => p.id === c.planOperarioId)
                    return (
                      <li key={c.procesoId}>
                        <strong>
                          {b?.descripcion ?? 'Proceso'} <span className="tab-plan-id">#{c.procesoId}</span>
                        </strong>
                        <div className="tab-plan-mov">
                          <span className="tab-plan-antes">
                            {orig ? `${orig.inicio.fecha} ${minAHora(orig.inicio.min)}` : 'sin planificar'}
                          </span>
                          {' → '}
                          <span className="tab-plan-despues">
                            {c.planFecha} {c.planHora}
                            {op ? ` · ${nombreCorto(op)}` : ''}
                          </span>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <div className="tab-plan-vacio">Sin cambios.</div>
              )
            ) : (
              <div className="tab-plan-error">{planCrudo.error}</div>
            )}
            {errorGuardar ? (
              <div className="tab-plan-error">Error al guardar: {errorGuardar}</div>
            ) : null}
            {anclaBase ? (
              <div className="tab-plan-editar">
                <label className="tab-plan-campo">
                  Fecha
                  <input
                    type="date"
                    value={edicion.fecha}
                    onChange={(e) => setEdicion({ ...edicion, fecha: e.target.value })}
                  />
                </label>
                <label className="tab-plan-campo">
                  Hora
                  <input
                    type="time"
                    value={edicion.hora}
                    onChange={(e) => setEdicion({ ...edicion, hora: e.target.value })}
                  />
                </label>
                <button className="tab-btn-sec" onClick={recalcular} disabled={guardando}>
                  Recalcular
                </button>
              </div>
            ) : null}
            <div className="tab-plan-botones">
              <button className="tab-btn-sec" onClick={cerrarPlan} disabled={guardando}>
                Cancelar
              </button>
              {planCrudo.ok && planCrudo.cambios.length ? (
                <button className="tab-btn-primario" onClick={confirmarPlan} disabled={guardando}>
                  {guardando ? 'Guardando…' : 'Confirmar'}
                </button>
              ) : null}
            </div>
          </Modal>
        ) : null}
        {historialUndo.length > 0 ? (
          <button className="tab-undo" onClick={deshacer} disabled={guardando}>
            ↶ Deshacer{historialUndo.length > 1 ? ` (${historialUndo.length})` : ''}
          </button>
        ) : null}
        {errorUndo ? <div className="tab-undo-error">No se pudo deshacer: {errorUndo}</div> : null}
      </div>
      {modalOrden ? (
        <OrdenModal personal={personal} onCerrar={() => setModalOrden(false)} onGuardar={guardarOrden} />
      ) : null}
      <DragOverlay>{dragActivo ? <OverlayBloque b={dragActivo} /> : null}</DragOverlay>
      {modalActividad ? (
        <ModalActividad
          b={modalActividad}
          item={datos.materialSim.items.find((it) => it.id === modalActividad.procesoId)}
          personal={personal}
          maquinas={datos.maquinas}
          ctxs={datos.materialSim.ctxs}
          onCerrar={() => setModalActividad(null)}
          onQuitar={quitarActividad}
          onEstado={cambiarEstadoActividad}
          onGuardar={guardarActividad}
        />
      ) : null}
      {selector ? (
        <ModalSelector
          elegibles={datos.elegibles}
          operarioId={selector.operarioId}
          fecha={selector.fecha}
          personal={personal}
          maquinas={datos.maquinas}
          onCerrar={() => setSelector(null)}
          onElegir={elegirProceso}
        />
      ) : null}
      {insertar ? (
        <InsertarModal
          el={insertar.el}
          opciones={insertar.opciones}
          onCerrar={() => setInsertar(null)}
          onElegir={insertarEn}
        />
      ) : null}
    </DndContext>
  )
}

// Celda operario-día: zona donde se sueltan los bloques.
function Celda({
  operarioId, fecha, hoy, alterna, mediodiaPct, bloques, vIni, vTotal, onEnter, onMove, onLeave, onAbrir, onAbrirSelector,
}: {
  operarioId: number
  fecha: FechaISO
  hoy: FechaISO
  alterna: boolean
  mediodiaPct: number
  bloques: BloqueVisual[]
  vIni: number
  vTotal: number
  onEnter: (b: BloqueVisual, e: MouseEvent) => void
  onMove: (e: MouseEvent) => void
  onLeave: () => void
  onAbrir: (b: BloqueVisual) => void
  onAbrirSelector: (operarioId: number, fecha: FechaISO) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `celda-${operarioId}-${fecha}`, data: { operarioId, fecha } })
  const carriles = Math.max(MIN_CARRILES, ...bloques.map((b) => b.track + 1), MIN_CARRILES)
  const altoBloque = ALTO_FILA / carriles
  const claseCelda = fecha === hoy ? 'es-hoy' : fecha < hoy ? 'es-pasado' : alterna ? 'es-alterna' : ''

  return (
    <div
      ref={setNodeRef}
      className={`tab-cl ${claseCelda} ${isOver ? 'tab-drop-activo' : ''}`}
      style={{ height: ALTO_FILA + 2 }}
    >
      <div className="tab-mediodia" style={{ left: `${mediodiaPct}%` }} />
      <button className="tab-mas" onClick={() => onAbrirSelector(operarioId, fecha)} title="Asignar actividad">
        +
      </button>
      {bloques.map((b) => (
        <Bloque
          key={`${b.procesoId}-${b.parte}`}
          b={b}
          altoBloque={altoBloque}
          vIni={vIni}
          vTotal={vTotal}
          onEnter={onEnter}
          onMove={onMove}
          onLeave={onLeave}
          onAbrir={onAbrir}
        />
      ))}
      {bloques
        .filter((b) => b.esAuto && b.setupMin > 0 && b.track >= 1)
        .map((b) => (
          <GhostSetup key={`g-${b.procesoId}-${b.parte}`} b={b} altoBloque={altoBloque} vIni={vIni} vTotal={vTotal} />
        ))}
    </div>
  )
}

function Bloque({
  b, altoBloque, vIni, vTotal, onEnter, onMove, onLeave, onAbrir,
}: {
  b: BloqueVisual
  altoBloque: number
  vIni: number
  vTotal: number
  onEnter: (b: BloqueVisual, e: MouseEvent) => void
  onMove: (e: MouseEvent) => void
  onLeave: () => void
  onAbrir: (b: BloqueVisual) => void
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `proc-${b.procesoId}-${b.parte}`,
    data: { procesoId: b.procesoId },
  })

  const dur = b.finMin - b.inicioMin
  const left = porcentajeLeft(b.inicioMin, vIni, vTotal)
  const width = Math.min(porcentajeAncho(dur, vTotal), 100 - left)

  // Frontera setup/máquina (solo en auto/semi; en manual setupMin es 0 y esAuto false).
  const setupPct = dur > 0 ? (b.setupMin / dur) * 100 : 0
  const rayarMaquina = b.esAuto && b.setupMin < dur
  const haySetup = b.esAuto && b.setupMin > 0
  const anchoSetupPx = (width / 100) * 400 * (dur > 0 ? b.setupMin / dur : 0)
  const cabeManual = haySetup && anchoSetupPx >= 12 && altoBloque - 4 >= 56
  const fontManual = Math.max(7, Math.min(11, Math.floor(((altoBloque - 4) * 0.7) / 6)))
  const marca = b.modo === 'automatica' ? 'A' : b.modo === 'semi_automatica' ? 'S' : null
  // Foto en el bloque solo si hay lugar (mismo criterio que el sistema viejo:
  // duración >= 150 min y alto del bloque >= 56px).
  const foto = fotoPublica(b.fotoUrl)
  const mostrarFoto = !!foto && dur >= 150 && altoBloque >= 56

  return (
    <div
      ref={setNodeRef}
      className={`tab-bk ${mostrarFoto ? 'con-foto' : ''} ${b.hecho ? 'es-hecho' : ''} ${isDragging ? 'tab-arrastrando' : ''}`}
      style={{
        left: `calc(${left}% + 1px)`,
        width: `calc(${width}% - 2px)`,
        top: b.track * altoBloque + 2,
        height: altoBloque - 4,
        background: FONDO_URGENCIA[b.urgencia] ?? FONDO_URGENCIA.media,
        color: TEXTO_URGENCIA[b.urgencia] ?? '#000',
        borderColor: b.maquinaColor ?? '#888780',
      }}
      {...listeners}
      {...attributes}
      onMouseEnter={(e) => onEnter(b, e)}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      onClick={() => onAbrir(b)}
    >
      {rayarMaquina ? <div className="tab-rayado" style={{ left: `${setupPct}%` }} /> : null}
      {haySetup ? <div className="tab-sep" style={{ left: `${setupPct}%` }} /> : null}
      {cabeManual ? (
        <div className="tab-manual" style={{ width: `${setupPct}%`, fontSize: fontManual }}>
          {'MANUAL'.split('').map((c, i) => (
            <span key={i}>{c}</span>
          ))}
        </div>
      ) : null}

      <div className="tab-tx" style={haySetup ? { paddingLeft: `calc(${setupPct}% + 6px)` } : undefined}>
        <div className="tab-bt">
          {b.descripcion}
          {b.tipoProceso ? <span className="tab-bt-proc"> · {b.tipoProceso}</span> : null}
          {b.totalPartes > 1 ? <span className="tab-parte">{b.parte}/{b.totalPartes}</span> : null}
        </div>
        {b.cliente ? <div className="tab-bs">{b.cliente}</div> : null}
        <div className="tab-bm">
          {minAHora(b.inicioMin)}–{minAHora(b.finMin)}
          {b.pedidoNro ? <span className="tab-ped"> · Ped. {b.pedidoNro}</span> : null}
        </div>
      </div>
      {mostrarFoto ? (
        <img
          src={foto as string}
          alt=""
          className="tab-bk-foto"
          onError={(e) => {
            e.currentTarget.style.display = 'none'
          }}
        />
      ) : null}
      {b.procesoEliminado ? (
        <span className="tab-warn" title="Proceso eliminado desde Proyectos">⛔</span>
      ) : b.hayDivergencia ? (
        <span className="tab-warn" title="Hay cambios desde Oficina Técnica (Proyectos)">⚠️</span>
      ) : null}
      {marca ? (
        <span className="tab-ba" title={b.modo === 'automatica' ? 'Automática' : 'Semi-automática'}>
          {marca}
        </span>
      ) : null}
    </div>
  )
}

// Representación simple del bloque que sigue al cursor mientras se arrastra.
// Modal de una actividad planificada: muestra sus datos y permite reasignar
// operario/máquina y cambiar fecha/hora. Al guardar, el cambio pasa por el motor
// (directo si no cascadea; modal del motor si reacomoda a otros). Los tiempos y la
// urgencia se agregan en el tramo siguiente.
function etiquetaCampoDiv(campo: Divergencia['campo']): string {
  switch (campo) {
    case 'setup':
      return 'Setup (min)'
    case 'operacion':
      return 'Operación (min/pieza)'
    case 'margen':
      return 'Margen (min)'
    case 'cantidad':
      return 'Cantidad'
    case 'modo':
      return 'Modo'
  }
}

function ModalActividad({
  b, item, personal, maquinas, ctxs, onCerrar, onQuitar, onEstado, onGuardar,
}: {
  b: BloqueVisual
  item: ItemSimulacion | undefined
  personal: PersonalTablero[]
  maquinas: MaquinaTablero[]
  ctxs: Map<number, ContextoOperario>
  onCerrar: () => void
  onQuitar: (procesoId: number) => void
  onEstado: (procesoId: number, estado: 'planificado' | 'hecho') => void
  onGuardar: (cambios: {
    operarioId: number
    maquinaId: number | null
    fecha: FechaISO
    hora: string
    tiempos: Tiempos
    setupSolapable: boolean
    urgencia: string
    proyectoId: number
  }) => void
}) {
  const t = item?.tiempos
  // OJO: un proceso multi-día se dibuja como varios bloques (fragmentos), y `b` es
  // el fragmento clickeado. El inicio del PROCESO es el del item de simulación; si
  // se usara b.fecha/b.inicioMin, editar desde la parte 2 correría el proceso entero.
  const inicioProceso = item?.inicio
  const [operarioId, setOperarioId] = useState(b.operarioId)
  const [maquinaId, setMaquinaId] = useState<number | null>(b.maquinaId)
  const [fecha, setFecha] = useState<string>(inicioProceso?.fecha ?? b.fecha)
  const [hora, setHora] = useState<string>(minAHora(inicioProceso?.min ?? b.inicioMin))
  const [setupMin, setSetupMin] = useState<number>(t?.setupMin ?? 0)
  const [operacionMin, setOperacionMin] = useState<number>(t?.operacionMin ?? 0)
  const [margenMin, setMargenMin] = useState<number>(t?.margenMin ?? 0)
  const [setupSolapable, setSetupSolapable] = useState<boolean>(item?.setupSolapable ?? false)
  const [urgencia, setUrgencia] = useState<string>(b.urgencia)
  const [modo, setModo] = useState<ModoProceso>(b.modo)

  const esAutoSemi = modo === 'automatica' || modo === 'semi_automatica'
  const puedeEditarTiempos = !!item // solo si el proceso está en la simulación (no pasado)
  const cantidad = t?.cantidad ?? 1

  // Fin calculado (read-only): inicio + tiempos, respetando la jornada del operario.
  // Se recalcula en cada render → se actualiza al tocar fecha/hora/tiempos/modo/operario.
  let fechaFin = ''
  let horaFin = ''
  const ctxOp = ctxs.get(operarioId)
  if (ctxOp && /^\d{4}-\d{2}-\d{2}$/.test(fecha) && /^\d{2}:\d{2}/.test(hora)) {
    try {
      const fin = finMaquina(
        { fecha: fecha as FechaISO, min: horaAMin(hora) },
        { setupMin, operacionMin, margenMin, cantidad, modo },
        ctxOp,
      )
      fechaFin = fin.fecha
      horaFin = minAHora(fin.min)
    } catch {
      /* hora incompleta mientras se tipea: dejar el fin vacío */
    }
  }

  function guardar() {
    onGuardar({
      operarioId,
      maquinaId,
      fecha: fecha as FechaISO,
      hora,
      tiempos: { setupMin, operacionMin, margenMin, cantidad: t?.cantidad ?? 1, modo },
      setupSolapable,
      urgencia,
      proyectoId: b.proyectoId,
    })
  }

  // Aplicar cambios de OT: adopta los valores que puso Oficina Técnica (el "actual"
  // de cada divergencia) y guarda como si los hubieras editado. Sincroniza el
  // snapshot → el ⚠ desaparece y el bloque se recalcula.
  function aplicarOT() {
    const val = (campo: Divergencia['campo'], fallback: number): number => {
      const d = b.divergencias.find((x) => x.campo === campo)
      return d ? (d.actual as number) : fallback
    }
    const dModo = b.divergencias.find((x) => x.campo === 'modo')
    onGuardar({
      operarioId,
      maquinaId,
      fecha: fecha as FechaISO,
      hora,
      tiempos: {
        setupMin: val('setup', setupMin),
        operacionMin: val('operacion', operacionMin),
        margenMin: val('margen', margenMin),
        cantidad: val('cantidad', cantidad),
        modo: dModo ? (dModo.actual as ModoProceso) : modo,
      },
      setupSolapable,
      urgencia,
      proyectoId: b.proyectoId,
    })
  }

  return (
    <Modal titulo={b.descripcion} onCerrar={onCerrar} ancho={660}>
        <div className="tab-act-cab">
          {fotoPublica(b.fotoUrl) ? (
            <img
              src={fotoPublica(b.fotoUrl) as string}
              alt=""
              className="tab-act-foto"
              onError={(e) => {
                e.currentTarget.style.display = 'none'
              }}
            />
          ) : null}
          <div className="tab-act-info">
          {b.cliente ? (
            <div>
              <b>Cliente:</b> {b.cliente}
            </div>
          ) : null}
          {b.pedidoNro ? (
            <div>
              <b>Pedido:</b> {b.pedidoNro}
            </div>
          ) : null}
          {b.tipoProceso ? (
            <div>
              <b>Proceso:</b> {b.tipoProceso}
            </div>
          ) : null}
          {b.totalPartes > 1 ? (
            <div>
              <b>Parte:</b> {b.parte}/{b.totalPartes}
            </div>
          ) : null}
          </div>
        </div>

        {b.divergencias.length > 0 ? (
          <div className="tab-div">
            <div className="tab-div-titulo">⚠ Oficina Técnica modificó este proceso desde Proyectos</div>
            <table className="tab-div-tabla">
              <thead>
                <tr>
                  <th>Concepto</th>
                  <th>Antes (tu plan)</th>
                  <th>Ahora (OT)</th>
                </tr>
              </thead>
              <tbody>
                {b.divergencias.map((d) => (
                  <tr key={d.campo}>
                    <td>{etiquetaCampoDiv(d.campo)}</td>
                    <td>{String(d.aceptado)}</td>
                    <td className="tab-div-nuevo">{String(d.actual)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button className="tab-div-aplicar" onClick={aplicarOT}>
              Aplicar cambios de OT
            </button>
          </div>
        ) : null}
        {/* Operario / máquina */}
        <div className="tab-ed-fila">
          <div className="tab-ed-campo">
            <div className="tab-ed-l">Operario</div>
            <select className="tab-ed-i" value={operarioId} onChange={(e) => setOperarioId(Number(e.target.value))}>
              {personal.map((op) => (
                <option key={op.id} value={op.id}>
                  {nombreCorto(op)}
                </option>
              ))}
            </select>
          </div>
          <div className="tab-ed-campo">
            <div className="tab-ed-l">Máquina</div>
            <select
              className="tab-ed-i"
              value={maquinaId ?? ''}
              onChange={(e) => setMaquinaId(e.target.value === '' ? null : Number(e.target.value))}
            >
              <option value="">(sin máquina)</option>
              {maquinas.map((mq) => (
                <option key={mq.id} value={mq.id}>
                  {mq.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="tab-ed-campo">
            <div className="tab-ed-l">Tipo</div>
            <select className="tab-ed-i" value={modo} onChange={(e) => setModo(e.target.value as ModoProceso)}>
              <option value="manual">Manual</option>
              <option value="semi_automatica">Semi-automática</option>
              <option value="automatica">Automática (24/7)</option>
            </select>
          </div>
        </div>

        {/* Fecha y hora de inicio / fin calculado / urgencia */}
        <div className="tab-ed-fila">
          <div className="tab-ed-campo">
            <div className="tab-ed-l">Fecha y hora de inicio</div>
            <div className="tab-ed-dob">
              <input
                type="date"
                className="tab-ed-i tab-ed-fecha"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
              />
              <input
                type="time"
                className="tab-ed-i tab-ed-hora"
                step={600}
                value={hora}
                onChange={(e) => setHora(e.target.value)}
              />
            </div>
          </div>
          <div className="tab-ed-campo">
            <div className="tab-ed-l">
              Fecha y hora de fin <span className="tab-ed-calc">(calculado)</span>
            </div>
            <div className="tab-ed-dob">
              <input type="date" className="tab-ed-i tab-ed-fecha tab-ed-fin" value={fechaFin} readOnly disabled />
              <input type="time" className="tab-ed-i tab-ed-hora tab-ed-fin" value={horaFin} readOnly disabled />
            </div>
          </div>
          <div className="tab-ed-campo">
            <div className="tab-ed-l">Urgencia</div>
            <select className="tab-ed-i" value={urgencia} onChange={(e) => setUrgencia(e.target.value)}>
              <option value="urgente">Urgente</option>
              <option value="alta">Alta</option>
              <option value="media">Media</option>
              <option value="baja">Baja</option>
            </select>
          </div>
        </div>
        <div className="tab-ed-aviso">⚠ La urgencia es del proyecto: afecta a todas sus actividades, no solo a esta.</div>

        {/* Tiempos */}
        <div className="tab-ed-fila">
          <div className="tab-ed-campo">
            <div className="tab-ed-l">Tiempo de setup (min)</div>
            <input
              type="number"
              className="tab-ed-i"
              min={0}
              step={5}
              value={setupMin}
              disabled={!puedeEditarTiempos}
              onChange={(e) => setSetupMin(Number(e.target.value))}
            />
          </div>
          <div className="tab-ed-campo">
            <div className="tab-ed-l">
              Tiempo de operación (min) <span className="tab-ed-req">*</span>
            </div>
            <input
              type="number"
              className="tab-ed-i"
              min={0}
              step={0.1}
              value={operacionMin}
              disabled={!puedeEditarTiempos}
              onChange={(e) => setOperacionMin(Number(e.target.value))}
            />
          </div>
          <div className="tab-ed-campo">
            <div className="tab-ed-l">Margen (min)</div>
            <input
              type="number"
              className="tab-ed-i"
              min={0}
              step={10}
              value={margenMin}
              disabled={!puedeEditarTiempos}
              onChange={(e) => setMargenMin(Number(e.target.value))}
            />
          </div>
        </div>
        <div className="tab-ed-help">
          El <b>tiempo de setup</b> es el seteo de la máquina, una sola vez. El <b>tiempo de operación</b> es por pieza
          {cantidad > 1 ? ` (× ${cantidad} piezas)` : ''}. El <b>margen</b> se suma al total.
        </div>

        {esAutoSemi ? (
          <label className="tab-ed-check">
            <input type="checkbox" checked={setupSolapable} onChange={(e) => setSetupSolapable(e.target.checked)} />
            <span>Permitir solapamiento del setup sobre actividades manuales</span>
          </label>
        ) : null}
        <div className="tab-plan-botones">
          {b.hecho ? (
            <button className="tab-btn-desanclar" onClick={() => onEstado(b.procesoId, 'planificado')}>
              🔓 Desanclar
            </button>
          ) : (
            <button className="tab-btn-hecho" onClick={() => onEstado(b.procesoId, 'hecho')}>
              ✓ Marcar como hecho
            </button>
          )}
          <button className="tab-btn-danger" onClick={() => onQuitar(b.procesoId)}>
            Quitar del tablero
          </button>
          <button className="tab-btn-sec" onClick={onCerrar}>
            Cerrar
          </button>
          <button className="tab-btn-primario" onClick={guardar}>
            Guardar
          </button>
        </div>
    </Modal>
  )
}

// Modal del "+": procesos sin planificar disponibles para asignar a una celda
// (operario+día), con filtros y grisado de los que tienen predecesores pendientes.
function ModalSelector({
  elegibles, operarioId, fecha, personal, maquinas, onCerrar, onElegir,
}: {
  elegibles: ProcesoElegible[]
  operarioId: number
  fecha: FechaISO
  personal: PersonalTablero[]
  maquinas: MaquinaTablero[]
  onCerrar: () => void
  onElegir: (el: ProcesoElegible) => void
}) {
  const [texto, setTexto] = useState('')
  const [filtroMaquina, setFiltroMaquina] = useState<string>('')
  const [filtroCliente, setFiltroCliente] = useState<string>('')
  const [orden, setOrden] = useState<'urgencia' | 'maquina'>('urgencia')

  const op = personal.find((p) => p.id === operarioId)
  const ordenUrg: Record<string, number> = { urgente: 0, alta: 1, media: 2, baja: 3 }

  // Opciones del filtro de cliente: clientes y clientes finales presentes en los
  // elegibles (sin repetir), alfabético.
  const clientesOpts = [
    ...new Set(
      elegibles
        .flatMap((e) => [e.cliente, e.clienteFinal])
        .filter((c): c is string => !!c && c.trim() !== ''),
    ),
  ].sort((a, b) => a.localeCompare(b))

  const lista = elegibles
    .filter((el) => {
      if (filtroMaquina !== '' && String(el.maquinaId ?? '') !== filtroMaquina) return false
      if (filtroCliente !== '' && el.cliente !== filtroCliente && el.clienteFinal !== filtroCliente) return false
      if (texto.trim() !== '') {
        const t = texto.trim().toLowerCase()
        const hay = `${el.descripcion} ${el.cliente} ${el.tipoProceso ?? ''} ${el.pedidoNro ?? ''}`.toLowerCase()
        if (!hay.includes(t)) return false
      }
      return true
    })
    .sort((a, b) =>
      orden === 'urgencia'
        ? (ordenUrg[a.urgencia] ?? 9) - (ordenUrg[b.urgencia] ?? 9)
        : (a.maquinaNombre ?? '').localeCompare(b.maquinaNombre ?? ''),
    )

  function badgeTipo(modo: string) {
    if (modo === 'automatica') return <span className="tab-sel-badge auto">AUTO</span>
    if (modo === 'semi_automatica') return <span className="tab-sel-badge semi">SEMI</span>
    return <span className="tab-sel-badge man">MAN</span>
  }

  return (
    <Modal
      titulo={`Asignar a ${op ? nombreCorto(op) : `operario ${operarioId}`} · ${fecha}`}
      onCerrar={onCerrar}
      ancho={620}
    >
        <div className="tab-sel-filtros">
          <input
            className="tab-sel-buscar"
            placeholder="Buscar (descripción, cliente, proceso, pedido)…"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
          />
          <select value={filtroMaquina} onChange={(e) => setFiltroMaquina(e.target.value)}>
            <option value="">Toda máquina</option>
            {maquinas.map((mq) => (
              <option key={mq.id} value={mq.id}>
                {mq.nombre}
              </option>
            ))}
          </select>
          <select value={filtroCliente} onChange={(e) => setFiltroCliente(e.target.value)}>
            <option value="">Todo cliente</option>
            {clientesOpts.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select value={orden} onChange={(e) => setOrden(e.target.value as 'urgencia' | 'maquina')}>
            <option value="urgencia">Ordenar por urgencia</option>
            <option value="maquina">Ordenar por máquina</option>
          </select>
        </div>
        <div className="tab-sel-lista">
          {lista.length === 0 ? (
            <div className="tab-sel-vacio">No hay procesos para planificar con estos filtros.</div>
          ) : (
            lista.map((el) => (
              <div
                key={el.procesoId}
                className={`tab-sel-card ${el.predecesorPendiente ? 'bloqueada' : ''}`}
                onClick={el.predecesorPendiente ? undefined : () => onElegir(el)}
                title={el.predecesorPendiente ? 'Bloqueada: tiene predecesores sin planificar' : ''}
              >
                {fotoPublica(el.fotoUrl) ? (
                  <img src={fotoPublica(el.fotoUrl) as string} alt="" className="tab-sel-foto" />
                ) : (
                  <div className="tab-sel-nofoto">sin foto</div>
                )}
                <div className="tab-sel-info">
                  <div className="tab-sel-t">
                    {el.descripcion} {badgeTipo(el.modo)}
                    {el.predecesorPendiente ? <span className="tab-sel-badge blq">⚠ BLOQUEADA</span> : null}
                    {el.tipoProceso ? <span className="tab-sel-proc"> — {el.tipoProceso}</span> : null}
                  </div>
                  <div className="tab-sel-s">
                    {el.cliente} · Ped. {el.pedidoNro ?? '-'} ·{' '}
                    <span className={`tab-sel-urg u-${el.urgencia}`}>{el.urgencia}</span>
                    {el.maquinaNombre ? ` · ${el.maquinaNombre}` : ''}
                  </div>
                  {el.predecesorPendiente ? (
                    <div className="tab-sel-warn">⚠ Tiene un predecesor sin planificar.</div>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </div>
        <div className="tab-plan-botones">
          <button className="tab-btn-sec" onClick={onCerrar}>
            Cerrar
          </button>
        </div>
    </Modal>
  )
}

// Modal "¿dónde lo pongo?": aparece cuando el proceso elegido no entra en ningún
// hueco libre del día. Lista las posiciones (inicio de la jornada + después de cada
// actividad); al elegir, se planifica ahí (reacomodando lo que siga).
function InsertarModal({
  el, opciones, onCerrar, onElegir,
}: {
  el: ProcesoElegible
  opciones: { label: string; startMin: number }[]
  onCerrar: () => void
  onElegir: (startMin: number) => void
}) {
  return (
    <Modal titulo={`¿Dónde ubico "${el.descripcion}"?`} onCerrar={onCerrar} ancho={460}>
        <p className="tab-ins-info">
          No entra en ningún hueco libre del día. Elegí dónde ponerlo (va a reacomodar las actividades
          siguientes):
        </p>
        <div className="tab-ins-opciones">
          {opciones.map((op, i) => (
            <button key={i} className="tab-ins-opcion" onClick={() => onElegir(op.startMin)}>
              {op.label} <span className="tab-ins-hora">({minAHora(op.startMin)})</span>
            </button>
          ))}
        </div>
        <div className="tab-plan-botones">
          <button className="tab-btn-sec" onClick={onCerrar}>
            Cancelar
          </button>
        </div>
    </Modal>
  )
}

// Modal para reordenar las columnas del tablero (los operarios). Réplica del
// sistema viejo: lista numerada con flechas ↑↓ y Guardar/Cancelar. El primero de
// la lista queda como columna izquierda.
function OrdenModal({
  personal, onCerrar, onGuardar,
}: {
  personal: PersonalTablero[]
  onCerrar: () => void
  onGuardar: (idsEnOrden: number[]) => void
}) {
  const [ids, setIds] = useState<number[]>(personal.map((p) => p.id))
  const [guardando, setGuardando] = useState(false)
  const [arrastrado, setArrastrado] = useState<number | null>(null)

  function mover(idx: number, dir: -1 | 1) {
    const nuevo = idx + dir
    if (nuevo < 0 || nuevo >= ids.length) return
    const arr = [...ids]
    ;[arr[idx], arr[nuevo]] = [arr[nuevo], arr[idx]]
    setIds(arr)
  }

  // Arrastre de filas (HTML5 nativo): se toma la fila del asa ⠿ y se suelta sobre
  // otra; la arrastrada se inserta en esa posición.
  function soltarEn(destino: number) {
    if (arrastrado == null || arrastrado === destino) return
    const arr = [...ids]
    const [movido] = arr.splice(arrastrado, 1)
    arr.splice(destino, 0, movido)
    setIds(arr)
    setArrastrado(null)
  }

  function nombreDe(id: number): string {
    const p = personal.find((x) => x.id === id)
    return p ? nombreCorto(p) : `#${id}`
  }

  return (
    <Modal titulo="Reordenar columnas del tablero" onCerrar={onCerrar} ancho={460}>
      <p className="tab-orden-info">
        Arrastrá por el ⠿ o usá las flechas para subir o bajar cada operario. El primero de la lista será la
        columna izquierda del tablero.
      </p>
      <div className="tab-orden-lista">
        {ids.map((id, idx) => (
          <div
            key={id}
            className={`tab-orden-fila ${arrastrado === idx ? 'arrastrando' : ''}`}
            draggable
            onDragStart={() => setArrastrado(idx)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => soltarEn(idx)}
            onDragEnd={() => setArrastrado(null)}
          >
            <span className="tab-orden-asa" title="Arrastrar para reordenar">
              ⠿
            </span>
            <div className="tab-orden-num">{idx + 1}</div>
            <div className="tab-orden-nombre">{nombreDe(id)}</div>
            <button
              className="tab-btn-sec tab-orden-flecha"
              onClick={() => mover(idx, -1)}
              disabled={idx === 0}
              title="Subir"
            >
              ↑
            </button>
            <button
              className="tab-btn-sec tab-orden-flecha"
              onClick={() => mover(idx, 1)}
              disabled={idx === ids.length - 1}
              title="Bajar"
            >
              ↓
            </button>
          </div>
        ))}
      </div>
      <div className="tab-plan-botones">
        <button className="tab-btn-sec" onClick={onCerrar} disabled={guardando}>
          Cancelar
        </button>
        <button
          className="tab-btn-primario"
          onClick={() => {
            setGuardando(true)
            onGuardar(ids)
          }}
          disabled={guardando}
        >
          {guardando ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </Modal>
  )
}

function OverlayBloque({ b }: { b: BloqueVisual }) {
  return (
    <div
      className="tab-overlay"
      style={{
        background: FONDO_URGENCIA[b.urgencia] ?? FONDO_URGENCIA.media,
        color: TEXTO_URGENCIA[b.urgencia] ?? '#000',
        borderColor: b.maquinaColor ?? '#888780',
      }}
    >
      {b.descripcion}
      {b.tipoProceso ? ` · ${b.tipoProceso}` : ''}
    </div>
  )
}

// Fantasma del setup: bloquecito no interactivo en el carril 0 que marca que el
// operario está ocupado durante el setup de una automática/semi cuyo bloque vive
// en un carril de abajo.
function GhostSetup({
  b, altoBloque, vIni, vTotal,
}: {
  b: BloqueVisual
  altoBloque: number
  vIni: number
  vTotal: number
}) {
  const left = porcentajeLeft(b.inicioMin, vIni, vTotal)
  const width = Math.min(porcentajeAncho(b.setupMin, vTotal), 100 - left)
  return (
    <div
      className="tab-ghost"
      style={{ left: `calc(${left}% + 1px)`, width: `calc(${width}% - 2px)`, top: 2, height: altoBloque - 4 }}
      title={`Setup — el operario está ocupado\n${b.descripcion}${b.pedidoNro ? ' · Ped. ' + b.pedidoNro : ''}`}
    >
      <span className="tab-ghost-lock">🔒</span>
      {b.setupMin >= 45 ? (
        <span className="tab-ghost-desc">
          {b.descripcion}
          {b.pedidoNro ? ` · Ped. ${b.pedidoNro}` : ''}
        </span>
      ) : null}
    </div>
  )
}

// Tarjeta de detalle que sigue al mouse (aparece tras el delay de hover).
function Tooltip({ tip }: { tip: { b: BloqueVisual; x: number; y: number } }) {
  const { b, x, y } = tip
  const left = Math.min(x + 12, window.innerWidth - 290)
  const top = y + 16
  const tipoLabel =
    b.modo === 'automatica' ? 'Automática' : b.modo === 'semi_automatica' ? 'Semi-automática' : 'Manual'
  const foto = fotoPublica(b.fotoUrl)
  return (
    <div className="tab-tip" style={{ left, top }}>
      {foto ? (
        <img
          src={foto}
          alt=""
          className="tab-tip-foto"
          onError={(e) => {
            e.currentTarget.style.display = 'none'
          }}
        />
      ) : null}
      <div className="tab-tip-t">
        {b.descripcion}
        {b.tipoProceso ? ` · ${b.tipoProceso}` : ''}
      </div>
      {b.cliente ? (
        <div>
          {b.cliente}
          {b.pedidoNro ? ` · Ped. ${b.pedidoNro}` : ''}
        </div>
      ) : null}
      <div>Urgencia: {b.urgencia}</div>
      {b.maquinaNombre ? <div>Máquina: {b.maquinaNombre}</div> : null}
      <div>Operario: {b.operarioNombre}</div>
      <div>
        Horario: {minAHora(b.inicioMin)}–{minAHora(b.finMin)}
      </div>
      <div>Tipo: {tipoLabel}</div>
      {b.totalPartes > 1 ? (
        <div>
          Parte {b.parte}/{b.totalPartes}
        </div>
      ) : null}
    </div>
  )
}
