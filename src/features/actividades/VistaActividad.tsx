import { useState, useEffect, useRef, useCallback } from 'react'
import ModalConfirmar from '../../shared/components/ModalConfirmar'
import ModalPausa from './ModalPausa'
import VistaCarpeta from './VistaCarpeta'
import VisorFotos from '../../shared/components/VisorFotos'
import {
  cargarDetalleActividad,
  cargarTramos,
  iniciarTrabajo,
  pausar,
  finalizar,
  reabrir,
  guardarCamposOperario,
  type DetalleActividad,
  type DatosPausa,
} from './actividadApi'
import { totales, tramoAbierto, comoReloj, comoDuracion, horaDe, type Tramo } from './tiempos'

const ETIQUETA_MOTIVO: Record<string, string> = {
  cambio_planificacion: 'Cambio de planificación',
  problema_tecnico: 'Problema técnico',
  falta_herramienta: 'Falta de herramienta o insumo',
  descanso: 'Descanso',
  otro: 'Otro',
}

// Pantalla de una actividad: arriba la orden de trabajo, abajo los tiempos.
function VistaActividad({
  procesoId,
  onVolver,
  carpetaAbierta = false,
  onCarpeta,
}: {
  procesoId: number
  onVolver: () => void
  // La carpeta la maneja el módulo para poder recordarla al salir y volver.
  carpetaAbierta?: boolean
  onCarpeta?: (abierta: boolean) => void
}) {
  const [det, setDet] = useState<DetalleActividad | null>(null)
  const [tramos, setTramos] = useState<Tramo[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pausaAbierta, setPausaAbierta] = useState(false)
  const [confirmarFin, setConfirmarFin] = useState(false)
  const [ahora, setAhora] = useState(Date.now())

  // Campos del operario (se guardan solos, sin botón).
  const [material, setMaterial] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [guardado, setGuardado] = useState<'' | 'guardando' | 'ok'>('')
  const timerGuardado = useRef<number | null>(null)

  const recargar = useCallback(async () => {
    try {
      const [d, t] = await Promise.all([cargarDetalleActividad(procesoId), cargarTramos(procesoId)])
      setDet(d)
      setTramos(t)
      setMaterial(d.materialUtilizado ?? '')
      setObservaciones(d.observacionesOperario ?? '')
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar la actividad.')
    } finally {
      setCargando(false)
    }
  }, [procesoId])

  useEffect(() => {
    recargar()
  }, [recargar])

  // El contador corre solo mientras haya un tramo abierto.
  const abierto = tramoAbierto(tramos)
  useEffect(() => {
    if (!abierto) return
    const id = window.setInterval(() => setAhora(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [abierto])

  // Guardado automático de material y observaciones (medio segundo después de
  // dejar de escribir): en una tablet, un botón de guardar se olvida.
  function programarGuardado(campos: { materialUtilizado?: string; observacionesOperario?: string }) {
    if (timerGuardado.current) window.clearTimeout(timerGuardado.current)
    setGuardado('guardando')
    timerGuardado.current = window.setTimeout(async () => {
      const { error: err } = await guardarCamposOperario(procesoId, campos)
      setGuardado(err ? '' : 'ok')
      if (err) setError(err)
      else window.setTimeout(() => setGuardado(''), 1500)
    }, 500)
  }

  // Solo refresca los tramos (no la orden de trabajo entera): es lo único que
  // cambia al iniciar, pausar o finalizar, y así la respuesta es mucho más ágil.
  async function refrescarTramos() {
    try {
      setTramos(await cargarTramos(procesoId))
    } catch {
      /* si falla, quedan los tramos que ya se ven en pantalla */
    }
  }

  // El cronómetro tiene que arrancar en el acto: se pinta el tramo nuevo de
  // entrada (con un id provisorio) y recién después se confirma contra la base.
  // Si la base rechaza, se vuelve atrás y se muestra el error.
  async function accionOptimista(
    optimista: (previos: Tramo[]) => Tramo[],
    fn: () => Promise<{ error?: string }>,
  ) {
    const previos = tramos
    setTramos(optimista(previos))
    setAhora(Date.now())
    const { error: err } = await fn()
    if (err) {
      setTramos(previos)
      setError(err)
      return
    }
    setError(null)
    await refrescarTramos()
  }

  const ahoraISO = () => new Date().toISOString()

  function cerrarUltimo(previos: Tramo[]): Tramo[] {
    const cuando = ahoraISO()
    return previos.map((t) => (t.fin ? t : { ...t, fin: cuando }))
  }

  function onIniciar() {
    return accionOptimista(
      (previos) => [
        ...cerrarUltimo(previos),
        { id: -Date.now(), tipo: 'trabajo', inicio: ahoraISO(), fin: null },
      ],
      () => iniciarTrabajo(procesoId),
    )
  }

  async function accion(fn: () => Promise<{ error?: string }>) {
    const { error: err } = await fn()
    if (err) {
      setError(err)
      return
    }
    setError(null)
    await recargar()
  }

  async function onPausar(p: DatosPausa) {
    setPausaAbierta(false)
    await accionOptimista(
      (previos) => [
        ...cerrarUltimo(previos),
        {
          id: -Date.now(),
          tipo: 'pausa',
          inicio: ahoraISO(),
          fin: null,
          motivo: p.motivo,
          motivoDetalle: p.detalle ?? null,
          autorizadoPor: p.autorizadoPor ?? null,
        },
      ],
      () => pausar(procesoId, p),
    )
  }

  if (cargando) return <div className="act-vacio">Cargando actividad…</div>
  if (!det) return <div className="act-vacio">{error ?? 'No se encontró la actividad.'}</div>

  const t = totales(tramos, ahora)
  const finalizada = det.estado === 'hecho_operario' || det.estado === 'hecho'
  const bloqueado = finalizada

  if (carpetaAbierta) {
    return (
      <VistaCarpeta
        elementoId={det.elementoId}
        proyectoId={det.proyectoId}
        procesoActualId={det.procesoId}
        onVolver={() => onCarpeta?.(false)}
      />
    )
  }

  return (
    <div className="act-pantalla">
      <div className="act-barra-sup">
        <button type="button" className="act-volver" onClick={onVolver}>
          ← Volver a mis actividades
        </button>
        {/* Toda la informacion de la pieza, de principio a fin: es la carpeta
            que hoy reciben impresa. */}
        <button type="button" className="act-btn-carpeta" onClick={() => onCarpeta?.(true)}>
          📁 Ver carpeta completa
        </button>
      </div>

      {/* ── Sección 1: la orden de trabajo ── */}
      <div className="ot-band">
        <span className="ot-band-proc">{det.proceso}</span>
        <span className="ot-band-num">{det.ordenTexto}</span>
        <span className={'ot-band-urg urg-' + det.urgencia}>{det.urgencia}</span>
      </div>

      <div className="ot-caja">
        <div className="ot-grid">
          <div className="ot-dato">
            <span className="ot-lbl">Cliente</span>
            <span className="ot-val">{det.cliente || '—'}</span>
          </div>
          <div className="ot-dato">
            <span className="ot-lbl">Responsable</span>
            <span className="ot-val">{det.responsable ?? '—'}</span>
          </div>
          <div className="ot-dato">
            <span className="ot-lbl">Proyecto</span>
            <span className="ot-val">{det.proyectoDescripcion || '—'}</span>
          </div>
          <div className="ot-dato">
            <span className="ot-lbl">Pedido</span>
            <span className="ot-val ot-val-fuerte">{det.pedidoNro ?? '—'}</span>
          </div>
        </div>

        <div className="ot-desc-bloque">
          <span className="ot-lbl">Descripción</span>
          <div className="ot-desc">{det.descripcion}</div>
        </div>

        <div className="ot-grid">
          <div className="ot-dato">
            <span className="ot-lbl">Cantidad</span>
            <span className="ot-val ot-val-fuerte">{det.cantidad}</span>
          </div>
          <div className="ot-dato">
            <span className="ot-lbl">Fecha de ingreso</span>
            <span className="ot-val">
              {det.fechaIngreso ? det.fechaIngreso.split('-').reverse().join('/') : '—'}
            </span>
          </div>
          <div className="ot-dato">
            <span className="ot-lbl">Material</span>
            <span className="ot-val">{det.material ?? '—'}</span>
          </div>
          <div className="ot-dato">
            <span className="ot-lbl">Forma inicial</span>
            <span className="ot-val">{det.presentacion ?? '—'}</span>
          </div>
          <div className="ot-dato">
            <span className="ot-lbl">Máquina</span>
            <span className="ot-val">{det.maquina ?? '—'}</span>
          </div>
          <div className="ot-dato">
            <span className="ot-lbl">Tiempo estimado</span>
            <span className="ot-val">{comoDuracion(det.minutosEstimados * 60000)}</span>
          </div>
        </div>

        {det.detalleTrabajo && (
          <div className="ot-trabajo">
            <span className="ot-lbl">Trabajo a realizar</span>
            <div className="ot-trabajo-txt">{det.detalleTrabajo}</div>
          </div>
        )}
      </div>

      {/* Campos que completa el operario */}
      <div className="ot-completar">
        <div className="ot-completar-band">
          A completar por el operario
          {guardado === 'guardando' && <span className="ot-guardado">guardando…</span>}
          {guardado === 'ok' && <span className="ot-guardado ot-guardado-ok">guardado ✓</span>}
        </div>
        <label className="empresa-campo">
          Material utilizado
          <input
            className="empresa-input"
            value={material}
            disabled={bloqueado}
            placeholder={'Ej: 2 tochos Ø80 x 150'}
            onChange={(e) => {
              setMaterial(e.target.value)
              programarGuardado({ materialUtilizado: e.target.value })
            }}
          />
        </label>
        <label className="empresa-campo">
          Observaciones
          <textarea
            className="empresa-input"
            rows={3}
            value={observaciones}
            disabled={bloqueado}
            onChange={(e) => {
              setObservaciones(e.target.value)
              programarGuardado({ observacionesOperario: e.target.value })
            }}
          />
        </label>
      </div>

      {/* ── Sección 2: los tiempos ── */}
      <div className="tie-seccion">
        <div className="tie-cab">
          <div className="tie-totales">
            <div className="tie-total">
              <span className="ot-lbl">Trabajado</span>
              <span className="tie-total-val">{comoDuracion(t.trabajoMs)}</span>
            </div>
            <div className="tie-total">
              <span className="ot-lbl">Interrupciones</span>
              <span className="tie-total-val tie-total-pausa">{comoDuracion(t.pausaMs)}</span>
            </div>
          </div>

          <div className="tie-botones">
            {!finalizada && (
              <>
                <button
                  type="button"
                  className="tie-btn tie-btn-iniciar"
                  disabled={!!abierto && abierto.tipo === 'trabajo'}
                  onClick={onIniciar}
                >
                  ▶ {tramos.length === 0 ? 'Iniciar' : 'Reanudar'}
                </button>
                <button
                  type="button"
                  className="tie-btn tie-btn-pausar"
                  disabled={!abierto || abierto.tipo === 'pausa'}
                  onClick={() => setPausaAbierta(true)}
                >
                  ⏸ Pausar
                </button>
                <button
                  type="button"
                  className="tie-btn tie-btn-finalizar"
                  disabled={tramos.length === 0}
                  onClick={() => setConfirmarFin(true)}
                >
                  ■ Finalizar
                </button>
              </>
            )}
            {finalizada && (
              <button
                type="button"
                className="tie-btn tie-btn-reabrir"
                onClick={() => accion(() => reabrir(procesoId))}
              >
                ↺ Reabrir actividad
              </button>
            )}
          </div>
        </div>

        {finalizada && (
          <div className="tie-finalizada">
            {det.estado === 'hecho' ? 'Actividad cerrada.' : 'Actividad terminada.'} Los campos
            quedaron bloqueados; reabrila para modificar.
          </div>
        )}

        {tramos.length === 0 ? (
          <div className="act-vacio">Todavía no empezaste esta actividad.</div>
        ) : (
          <div className="tie-tarjetas">
            {tramos.map((tr) => {
              const corriendo = !tr.fin
              const ms = corriendo ? ahora - Date.parse(tr.inicio) : Date.parse(tr.fin as string) - Date.parse(tr.inicio)
              return (
                <div
                  key={tr.id}
                  className={
                    'tie-card' +
                    (tr.tipo === 'pausa' ? ' tie-card-pausa' : '') +
                    (corriendo ? ' tie-card-corriendo' : '')
                  }
                >
                  <div className="tie-card-tit">
                    {tr.tipo === 'trabajo' ? 'Trabajo' : ETIQUETA_MOTIVO[tr.motivo ?? ''] ?? 'Pausa'}
                    {tr.editado && <span className="tie-editado" title="Horario corregido a mano">editado</span>}
                  </div>
                  <div className="tie-card-horas">
                    {horaDe(tr.inicio)} → {corriendo ? '…' : horaDe(tr.fin)}
                  </div>
                  <div className={'tie-card-reloj' + (corriendo ? ' tie-card-reloj-vivo' : '')}>
                    {comoReloj(Math.max(0, ms))}
                  </div>
                  {tr.motivoDetalle && <div className="tie-card-detalle">{tr.motivoDetalle}</div>}
                  {tr.autorizadoPor && (
                    <div className="tie-card-detalle">Autorizó: {tr.autorizadoPor}</div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Fotos al final: todas las de la pieza y del proyecto, de a una. */}
      <div className="ot-fotos">
        <VisorFotos elementoId={det.elementoId} proyectoId={det.proyectoId} />
      </div>

      {error && <p className="empresa-form-error">{error}</p>}

      {pausaAbierta && <ModalPausa onConfirmar={onPausar} onCancelar={() => setPausaAbierta(false)} />}

      {confirmarFin && (
        <ModalConfirmar
          titulo="Finalizar actividad"
          mensaje={
            abierto
              ? 'Se cierra el tramo en curso y la actividad queda terminada. Después podés reabrirla si necesitás corregir.'
              : 'La actividad queda terminada. Después podés reabrirla si necesitás corregir.'
          }
          textoConfirmar="Finalizar"
          onConfirmar={async () => {
            setConfirmarFin(false)
            await accion(() => finalizar(procesoId))
          }}
          onCancelar={() => setConfirmarFin(false)}
        />
      )}
    </div>
  )
}

export default VistaActividad
