// features/tablero/Tablero.tsx
// -----------------------------------------------------------------------------
// Primer render del tablero por operario: grilla con operarios en columnas y días
// en filas, y los bloques posicionados en su hora y carril reales.
//
// Usa la capa de datos (cargarTablero) y la geometría (porcentajeLeft/Ancho). Es
// solo lectura por ahora; la interacción (drag & drop, edición) viene después.
// -----------------------------------------------------------------------------

import { Fragment, useEffect, useRef, useState, type MouseEvent } from 'react'
import { cargarTablero, type TableroCargado } from './datos/cargarTablero'
import { porcentajeLeft, porcentajeAncho } from './calculos/geometria'
import type { BloqueVisual } from './datos/bloquesVisuales'
import type { PersonalTablero } from './tipos'
import { horaAMin, parseFecha, hoyISO, sumarDias, type FechaISO } from '../../shared/lib/fechas'
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

export default function Tablero() {
  const [datos, setDatos] = useState<TableroCargado | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tip, setTip] = useState<{ b: BloqueVisual; x: number; y: number } | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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

  // Días visibles (sin domingos) entre desde y hasta.
  const dias: FechaISO[] = []
  for (let f = desde; f <= hasta; f = sumarDias(f, 1)) {
    if (parseFecha(f).getDay() !== 0) dias.push(f)
  }

  const columnas = `80px repeat(${personal.length}, 400px)`
  const mediodiaPct = porcentajeLeft(720, vIni, vTotal)

  return (
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
              {personal.map((op) => {
                const delDia = bloques.filter((b) => b.operarioId === op.id && b.fecha === dia)
                const carriles = Math.max(MIN_CARRILES, ...delDia.map((b) => b.track + 1), MIN_CARRILES)
                const altoBloque = ALTO_FILA / carriles
                const claseCelda = dia === hoy ? 'es-hoy' : dia < hoy ? 'es-pasado' : alterna ? 'es-alterna' : ''
                return (
                  <div key={op.id} className={`tab-cl ${claseCelda}`} style={{ height: ALTO_FILA + 2 }}>
                    <div className="tab-mediodia" style={{ left: `${mediodiaPct}%` }} />
                    {delDia.map((b) => (
                      <Bloque
                        key={`${b.procesoId}-${b.parte}`}
                        b={b}
                        altoBloque={altoBloque}
                        vIni={vIni}
                        vTotal={vTotal}
                        onEnter={mostrarTip}
                        onMove={moverTip}
                        onLeave={ocultarTip}
                      />
                    ))}
                    {delDia
                      .filter((b) => b.esAuto && b.setupMin > 0 && b.track >= 1)
                      .map((b) => (
                        <GhostSetup key={`g-${b.procesoId}-${b.parte}`} b={b} altoBloque={altoBloque} vIni={vIni} vTotal={vTotal} />
                      ))}
                  </div>
                )
              })}
            </Fragment>
          )
        })}
      </div>
      {tip ? <Tooltip tip={tip} /> : null}
    </div>
  )
}

function Bloque({
  b, altoBloque, vIni, vTotal, onEnter, onMove, onLeave,
}: {
  b: BloqueVisual
  altoBloque: number
  vIni: number
  vTotal: number
  onEnter: (b: BloqueVisual, e: MouseEvent) => void
  onMove: (e: MouseEvent) => void
  onLeave: () => void
}) {
  const dur = b.finMin - b.inicioMin
  const left = porcentajeLeft(b.inicioMin, vIni, vTotal)
  const width = Math.min(porcentajeAncho(dur, vTotal), 100 - left)

  // Frontera setup/máquina (solo en auto/semi; en manual setupMin es 0 y esAuto false).
  const setupPct = dur > 0 ? (b.setupMin / dur) * 100 : 0
  const rayarMaquina = b.esAuto && b.setupMin < dur // hay porción de máquina sola
  const haySetup = b.esAuto && b.setupMin > 0 // hay porción de setup
  const anchoSetupPx = (width / 100) * 400 * (dur > 0 ? b.setupMin / dur : 0)
  const cabeManual = haySetup && anchoSetupPx >= 12 && altoBloque - 4 >= 56
  const fontManual = Math.max(7, Math.min(11, Math.floor(((altoBloque - 4) * 0.7) / 6)))
  const marca = b.modo === 'automatica' ? 'A' : b.modo === 'semi_automatica' ? 'S' : null

  return (
    <div
      className={`tab-bk ${b.hecho ? 'es-hecho' : ''}`}
      style={{
        left: `calc(${left}% + 1px)`,
        width: `${width}%`,
        top: b.track * altoBloque + 2,
        height: altoBloque - 4,
        background: FONDO_URGENCIA[b.urgencia] ?? FONDO_URGENCIA.media,
        color: TEXTO_URGENCIA[b.urgencia] ?? '#000',
        borderColor: b.maquinaColor ?? '#888780',
      }}
      onMouseEnter={(e) => onEnter(b, e)}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
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
