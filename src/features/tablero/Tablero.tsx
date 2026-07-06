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
import { porcentajeLeft, porcentajeAncho } from './calculos/geometria'
import { snapearInsercion, type Ocupacion } from './calculos/insercion'
import { simular, type ItemSimulacion } from './motor/simular'
import type { Tiempos } from './motor/duraciones'
import { armarPlan, aplicarPlan, actualizarUrgencia, type CambioPlan } from './datos/escritura'
import type { BloqueVisual } from './datos/bloquesVisuales'
import type { PersonalTablero, MaquinaTablero } from './tipos'
import { horaAMin, parseFecha, hoyISO, sumarDias, type FechaISO } from '../../shared/lib/fechas'
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

export default function Tablero() {
  const [datos, setDatos] = useState<TableroCargado | null>(null)
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
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Hay que mover ~5px para que empiece el arrastre (un click simple no dispara drag).
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  useEffect(() => {
    cargarTablero()
      .then(setDatos)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
  }, [])

  if (error) return <div className="tab-estado tab-error">No se pudo cargar el tablero: {error}</div>
  if (!datos) return <div className="tab-estado">Cargando tablero…</div>

  const { bloques, personal, desde, hasta, ventanaInicio, ventanaFin } = datos
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

  function abrirActividad(b: BloqueVisual) {
    ocultarTip()
    setModalActividad(b)
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
    const resultado = simular(items, [procesoId], datos.materialSim.ctxs, { gapMin: datos.gap }, datos.correlatividades)
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
      const nuevos = await cargarTablero() // recarga completa desde la base
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
      const nuevos = await cargarTablero()
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

  // Días visibles (sin domingos) entre desde y hasta.
  const dias: FechaISO[] = []
  for (let f = desde; f <= hasta; f = sumarDias(f, 1)) {
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
                  />
                ))}
              </Fragment>
            )
          })}
        </div>
        {tip ? <Tooltip tip={tip} /> : null}
        {planCrudo ? (
          <div className="tab-modal-overlay">
            <div className="tab-modal">
              <div className="tab-plan-t">Plan calculado — todavía no se guarda</div>
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
            </div>
          </div>
        ) : null}
        {historialUndo.length > 0 ? (
          <button className="tab-undo" onClick={deshacer} disabled={guardando}>
            ↶ Deshacer{historialUndo.length > 1 ? ` (${historialUndo.length})` : ''}
          </button>
        ) : null}
        {errorUndo ? <div className="tab-undo-error">No se pudo deshacer: {errorUndo}</div> : null}
      </div>
      <DragOverlay>{dragActivo ? <OverlayBloque b={dragActivo} /> : null}</DragOverlay>
      {modalActividad ? (
        <ModalActividad
          b={modalActividad}
          item={datos.materialSim.items.find((it) => it.id === modalActividad.procesoId)}
          personal={personal}
          maquinas={datos.maquinas}
          onCerrar={() => setModalActividad(null)}
          onGuardar={guardarActividad}
        />
      ) : null}
    </DndContext>
  )
}

// Celda operario-día: zona donde se sueltan los bloques.
function Celda({
  operarioId, fecha, hoy, alterna, mediodiaPct, bloques, vIni, vTotal, onEnter, onMove, onLeave, onAbrir,
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

  return (
    <div
      ref={setNodeRef}
      className={`tab-bk ${b.hecho ? 'es-hecho' : ''} ${isDragging ? 'tab-arrastrando' : ''}`}
      style={{
        left: `calc(${left}% + 1px)`,
        width: `${width}%`,
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
function ModalActividad({
  b, item, personal, maquinas, onCerrar, onGuardar,
}: {
  b: BloqueVisual
  item: ItemSimulacion | undefined
  personal: PersonalTablero[]
  maquinas: MaquinaTablero[]
  onCerrar: () => void
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
  const [operarioId, setOperarioId] = useState(b.operarioId)
  const [maquinaId, setMaquinaId] = useState<number | null>(b.maquinaId)
  const [fecha, setFecha] = useState<string>(b.fecha)
  const [hora, setHora] = useState<string>(minAHora(b.inicioMin))
  const [setupMin, setSetupMin] = useState<number>(t?.setupMin ?? 0)
  const [operacionMin, setOperacionMin] = useState<number>(t?.operacionMin ?? 0)
  const [margenMin, setMargenMin] = useState<number>(t?.margenMin ?? 0)
  const [setupSolapable, setSetupSolapable] = useState<boolean>(item?.setupSolapable ?? false)
  const [urgencia, setUrgencia] = useState<string>(b.urgencia)

  useEffect(() => {
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCerrar()
    }
    document.addEventListener('keydown', esc)
    return () => document.removeEventListener('keydown', esc)
  }, [onCerrar])

  const tipoLabel =
    b.modo === 'automatica' ? 'Automática (24/7)' : b.modo === 'semi_automatica' ? 'Semi-automática' : 'Manual'
  const esAutoSemi = b.modo === 'automatica' || b.modo === 'semi_automatica'
  const puedeEditarTiempos = !!item // solo si el proceso está en la simulación (no pasado)

  function guardar() {
    onGuardar({
      operarioId,
      maquinaId,
      fecha: fecha as FechaISO,
      hora,
      tiempos: { setupMin, operacionMin, margenMin, cantidad: t?.cantidad ?? 1, modo: b.modo },
      setupSolapable,
      urgencia,
      proyectoId: b.proyectoId,
    })
  }

  return (
    <div className="tab-modal-overlay">
      <div className="tab-modal tab-modal-act">
        <button className="tab-modal-x" onClick={onCerrar} aria-label="Cerrar">
          ×
        </button>
        <div className="tab-modal-titulo">{b.descripcion}</div>
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
          <div>
            <b>Tipo:</b> {tipoLabel}
          </div>
          {b.totalPartes > 1 ? (
            <div>
              <b>Parte:</b> {b.parte}/{b.totalPartes}
            </div>
          ) : null}
        </div>
        <div className="tab-act-campos">
          <label className="tab-act-campo">
            Operario
            <select value={operarioId} onChange={(e) => setOperarioId(Number(e.target.value))}>
              {personal.map((op) => (
                <option key={op.id} value={op.id}>
                  {nombreCorto(op)}
                </option>
              ))}
            </select>
          </label>
          <label className="tab-act-campo">
            Máquina
            <select
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
          </label>
          <label className="tab-act-campo">
            Fecha
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </label>
          <label className="tab-act-campo">
            Hora
            <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
          </label>
          <label className="tab-act-campo">
            Setup (min)
            <input
              type="number"
              min={0}
              value={setupMin}
              disabled={!puedeEditarTiempos}
              onChange={(e) => setSetupMin(Number(e.target.value))}
            />
          </label>
          <label className="tab-act-campo">
            Operación (min)
            <input
              type="number"
              min={0}
              value={operacionMin}
              disabled={!puedeEditarTiempos}
              onChange={(e) => setOperacionMin(Number(e.target.value))}
            />
          </label>
          <label className="tab-act-campo">
            Margen (min)
            <input
              type="number"
              min={0}
              value={margenMin}
              disabled={!puedeEditarTiempos}
              onChange={(e) => setMargenMin(Number(e.target.value))}
            />
          </label>
          <label className="tab-act-campo tab-act-urgencia">
            Urgencia
            <select value={urgencia} onChange={(e) => setUrgencia(e.target.value)}>
              <option value="urgente">Urgente</option>
              <option value="alta">Alta</option>
              <option value="media">Media</option>
              <option value="baja">Baja</option>
            </select>
            <span className="tab-act-aviso">
              ⚠ La urgencia es del proyecto: afecta a todas sus actividades, no solo a esta.
            </span>
          </label>
          {esAutoSemi ? (
            <label className="tab-act-check">
              <input
                type="checkbox"
                checked={setupSolapable}
                onChange={(e) => setSetupSolapable(e.target.checked)}
              />
              Permitir solapamiento del setup
            </label>
          ) : null}
        </div>
        <div className="tab-plan-botones">
          <button className="tab-btn-sec" onClick={onCerrar}>
            Cerrar
          </button>
          <button className="tab-btn-primario" onClick={guardar}>
            Guardar
          </button>
        </div>
      </div>
    </div>
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
  const width = porcentajeAncho(b.setupMin, vTotal)
  return (
    <div
      className="tab-ghost"
      style={{ left: `calc(${left}% + 1px)`, width: `${width}%`, top: 2, height: altoBloque - 4 }}
      title={`Setup — el operario está ocupado\n${b.descripcion}${b.pedidoNro ? ' · Ped. ' + b.pedidoNro : ''}`}
    >
      <span className="tab-ghost-lock">🔒</span>
      <span className="tab-ghost-desc">
        {b.descripcion}
        {b.pedidoNro ? ` · Ped. ${b.pedidoNro}` : ''}
      </span>
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
  return (
    <div className="tab-tip" style={{ left, top }}>
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
