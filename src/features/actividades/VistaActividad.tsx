import { useState, useEffect, useRef, useCallback } from 'react'
import ModalConfirmar from '../../shared/components/ModalConfirmar'
import ModalPrompt from '../../shared/components/ModalPrompt'
import ModalPausa from './ModalPausa'
import ModalOtraActividad from './ModalOtraActividad'
import VistaCarpeta from './VistaCarpeta'
import VisorFotos from '../../shared/components/VisorFotos'
import ModalTramo from './ModalTramo'
import { TIPOS_GRILLA, defTipo, esProductivo, esPausa, tipoDePausa, type TipoOperacion } from './tiposOperacion'
import {
  cargarDetalleActividad,
  cargarTramos,
  cargarMaquinas,
  actividadEnCurso,
  iniciarOperacion,
  finalizar,
  reabrir,
  guardarCamposOperario,
  cambiarModoOperacion,
  cambiarMaquinaTramo,
  marcarFinMaquina,
  type DetalleActividad,
  type DatosPausa,
  type ActividadEnCurso,
  type MaquinaOpcion,
} from './actividadApi'
import {
  totales,
  tramoAbierto,
  abiertoManual,
  opActual,
  puedeCambiarModo,
  errorFinMaquina,
  isoALocal,
  localAIso,
  comoReloj,
  comoDuracion,
  horaDe,
  haySolape,
  type Tramo,
} from './tiempos'

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
  onIrAActividad,
}: {
  procesoId: number
  onVolver: () => void
  // Para saltar a otra actividad que quedó corriendo.
  onIrAActividad?: (procesoId: number) => void
  // La carpeta la maneja el módulo para poder recordarla al salir y volver.
  carpetaAbierta?: boolean
  onCarpeta?: (abierta: boolean) => void
}) {
  const [det, setDet] = useState<DetalleActividad | null>(null)
  const [tramos, setTramos] = useState<Tramo[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pausaAbierta, setPausaAbierta] = useState(false)
  // MA y OT piden un texto antes de arrancar.
  const [pideTexto, setPideTexto] = useState<'MA' | 'OT' | null>(null)
  const [otraEnCurso, setOtraEnCurso] = useState<ActividadEnCurso | null>(null)
  const [verificando, setVerificando] = useState(false)
  const [maquinas, setMaquinas] = useState<MaquinaOpcion[]>([])
  const [maquinaId, setMaquinaId] = useState<number | null>(null)
  const [finMaq, setFinMaq] = useState('')
  const [errorFin, setErrorFin] = useState<string | null>(null)
  const [confirmarFin, setConfirmarFin] = useState(false)
  const [modalTramo, setModalTramo] = useState<{ tramo: Tramo | null } | null>(null)
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
      // Máquina por defecto: la del último tramo registrado; si no hay, la planificada.
      const ultima = [...t].reverse().find((x) => x.maquinaId != null)
      setMaquinaId(ultima?.maquinaId ?? d.planMaquinaId)
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

  useEffect(() => {
    cargarMaquinas().then(setMaquinas).catch(() => {})
  }, [])

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

  // Cierra lo que estaba abierto, salvo el automático: la máquina sigue sola.
  function cerrarUltimo(previos: Tramo[]): Tramo[] {
    const cuando = ahoraISO()
    return previos.map((t) => (t.fin || t.automatico ? t : { ...t, fin: cuando }))
  }

  // Antes de arrancar cualquier cosa: ¿el operario tiene otra actividad en
  // marcha? Si la tiene, se avisa y no se arranca.
  async function libreParaArrancar(): Promise<boolean> {
    if (!det?.planOperarioId) return true
    setVerificando(true)
    try {
      const otra = await actividadEnCurso(procesoId, det.planOperarioId)
      if (otra) {
        setOtraEnCurso(otra)
        return false
      }
      return true
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo verificar si hay otra actividad en curso.')
      return false
    } finally {
      setVerificando(false)
    }
  }

  // Un toque = empezar o cambiar lo que se está haciendo. El tramo se pinta de
  // entrada para que no haya espera, y después se confirma contra la base.
  async function onTipo(tipo: TipoOperacion) {
    if (verificando || !(await libreParaArrancar())) return
    // Mantenimiento y Otra piden en el momento qué se hizo.
    if (tipo === 'MA' || tipo === 'OT') {
      setPideTexto(tipo)
      return
    }
    return arrancarTipo(tipo)
  }

  async function onPausa() {
    if (verificando || !(await libreParaArrancar())) return
    setPausaAbierta(true)
  }

  function arrancarTipo(
    tipo: TipoOperacion,
    extra?: { motivo?: DatosPausa['motivo']; detalle?: string | null; autorizadoPor?: string | null },
  ) {
    // Una operación arranca automática si el proceso está así en Producción; el
    // operario lo cambia después con un toque.
    const automatico = tipo === 'OP' && !!det?.modoAutomatico
    return accionOptimista(
      (previos) => [
        ...cerrarUltimo(previos),
        {
          id: -Date.now(),
          tipo: esProductivo(tipo) ? 'trabajo' : 'pausa',
          tipoOperacion: tipo,
          inicio: ahoraISO(),
          fin: null,
          automatico,
          maquinaId,
          motivo: extra?.motivo ?? null,
          motivoDetalle: extra?.detalle ?? null,
          autorizadoPor: extra?.autorizadoPor ?? null,
        },
      ],
      () =>
        iniciarOperacion(procesoId, tipo, {
          automatico,
          maquinaId,
          motivo: extra?.motivo ?? null,
          detalle: extra?.detalle ?? null,
          autorizadoPor: extra?.autorizadoPor ?? null,
        }),
    )
  }

  // Cambia algo de un tramo en pantalla al toque y lo confirma contra la base.
  async function cambiarTramo(
    id: number,
    cambio: Partial<Tramo>,
    fn: () => Promise<{ error?: string }>,
  ) {
    const previos = tramos
    setTramos(previos.map((x) => (x.id === id ? { ...x, ...cambio } : x)))
    const { error: err } = await fn()
    if (err) {
      setTramos(previos)
      setError(err)
      return
    }
    setError(null)
    await refrescarTramos()
  }

  // La máquina elegida vale para lo que se arranque de acá en más y para lo
  // que está en curso ahora (no para un automático que ya quedó andando).
  function onMaquina(id: number | null) {
    setMaquinaId(id)
    const enCurso = abiertoManual(tramos)
    if (enCurso && enCurso.id > 0) {
      cambiarTramo(enCurso.id, { maquinaId: id }, () => cambiarMaquinaTramo(enCurso.id, id))
    }
  }

  function onModo(op: Tramo, automatico: boolean) {
    if (!!op.automatico === automatico || op.id < 0) return
    setErrorFin(null)
    setFinMaq('')
    cambiarTramo(op.id, { automatico, finMaquina: null }, () => cambiarModoOperacion(op.id, automatico))
  }

  async function guardarFinMaquina(op: Tramo) {
    const iso = localAIso(finMaq)
    const err = errorFinMaquina(iso, op.inicio)
    setErrorFin(err)
    if (err || !iso) return
    setFinMaq('')
    await cambiarTramo(op.id, { fin: iso, finMaquina: iso }, () => marcarFinMaquina(op.id, iso))
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

  function onPausar(p: DatosPausa) {
    setPausaAbierta(false)
    return arrancarTipo(tipoDePausa(p.motivo), {
      motivo: p.motivo,
      detalle: p.detalle,
      autorizadoPor: p.autorizadoPor,
    })
  }

  if (cargando) return <div className="act-vacio">Cargando actividad…</div>
  if (!det) return <div className="act-vacio">{error ?? 'No se encontró la actividad.'}</div>

  const t = totales(tramos, ahora)
  const finalizada = det.estado === 'hecho_operario' || det.estado === 'hecho'
  const bloqueado = finalizada
  const manual = abiertoManual(tramos)
  const op = opActual(tramos)
  const automaticoAndando = tramos.some((x) => !x.fin && x.automatico)

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
            {!finalizada && (
              <button
                type="button"
                className="tie-agregar"
                title="Cargar un tramo que no se registró en el momento"
                onClick={() => setModalTramo({ tramo: null })}
              >
                + Agregar tramo
              </button>
            )}
          </div>

          <div className="tie-botones">
            {!finalizada && (
              <button
                type="button"
                className={'tie-btn tie-btn-pausar' + (esPausa(manual?.tipoOperacion) ? ' tie-btn-activo' : '')}
                disabled={verificando}
                onClick={onPausa}
              >
                ⏸ Pausa
              </button>
            )}
            {!finalizada && (
              <button
                type="button"
                className="tie-btn tie-btn-finalizar"
                disabled={tramos.length === 0 || automaticoAndando}
                title={automaticoAndando ? 'Primero cargá cuándo terminó la máquina' : undefined}
                onClick={() => setConfirmarFin(true)}
              >
                ■ Finalizar
              </button>
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

        {!finalizada && automaticoAndando && (
          <div className="tie-aviso-auto">
            🤖 La máquina sigue en automático: antes de finalizar, cargá cuándo terminó.
          </div>
        )}

        {!finalizada && (
          <div className="tie-tipos">
            <div className="tie-tipos-cab">
              <span className="ot-lbl">¿Qué estás haciendo?</span>
              <label className="tie-maquina">
                Máquina
                <select
                  className="empresa-input"
                  value={maquinaId ?? ''}
                  onChange={(e) => onMaquina(e.target.value ? Number(e.target.value) : null)}
                >
                  <option value="">— sin máquina —</option>
                  {maquinas.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nombre}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="tie-tipos-grilla">
              {TIPOS_GRILLA.map((t) => {
                const activo = manual?.tipoOperacion === t.id
                return (
                  <button
                    key={t.id}
                    type="button"
                    className={'tie-tipo tie-tipo-' + t.id + (activo ? ' tie-tipo-activo' : '')}
                    title={t.label}
                    disabled={verificando}
                    onClick={() => onTipo(t.id)}
                  >
                    <span className="tie-tipo-cod">{t.id}</span>
                    {t.corto}
                  </button>
                )
              })}
            </div>

            {/* Solo para Operando: si la máquina queda andando sola y cuándo terminó. */}
            {op && (
              <div className="tie-op">
                <div className="tie-op-modo">
                  <span className="ot-lbl">Operación</span>
                  <div className="tie-modos">
                    {[false, true].map((auto) => (
                      <button
                        key={String(auto)}
                        type="button"
                        className={'tie-modo' + (!!op.automatico === auto ? ' tie-modo-activo' : '')}
                        disabled={!puedeCambiarModo(tramos, op)}
                        title={
                          puedeCambiarModo(tramos, op)
                            ? undefined
                            : 'Ya empezaste otra cosa: corregilo tocando la tarjeta del tramo'
                        }
                        onClick={() => onModo(op, auto)}
                      >
                        {auto ? '🤖 Automático' : 'Manual'}
                      </button>
                    ))}
                  </div>
                </div>

                {op.automatico && (
                  <div className="tie-finmaq">
                    <label className="empresa-campo">
                      Fin de máquina (desde las {horaDe(op.inicio)})
                      <input
                        type="datetime-local"
                        className="empresa-input"
                        value={finMaq}
                        min={isoALocal(op.inicio)}
                        max={isoALocal(new Date(ahora).toISOString())}
                        onChange={(e) => {
                          setFinMaq(e.target.value)
                          setErrorFin(null)
                        }}
                      />
                    </label>
                    <button
                      type="button"
                      className="empresa-boton-secundario"
                      onClick={() => {
                        setFinMaq(isoALocal(new Date().toISOString()))
                        setErrorFin(null)
                      }}
                    >
                      Ahora
                    </button>
                    <button
                      type="button"
                      className="empresa-boton"
                      disabled={!finMaq}
                      onClick={() => guardarFinMaquina(op)}
                    >
                      Terminó la máquina
                    </button>
                    {errorFin && <p className="empresa-form-error">{errorFin}</p>}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {haySolape(tramos) && (
          <div className="tie-solape">
            ⚠ Hay tramos que se pisan entre sí. Revisá los horarios: el tiempo total puede estar
            contando de más.
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
                    (corriendo ? ' tie-card-corriendo' : '') +
                    (finalizada ? '' : ' tie-card-editable')
                  }
                  title={finalizada ? undefined : 'Tocar para corregir los horarios'}
                  onClick={finalizada ? undefined : () => setModalTramo({ tramo: tr })}
                >
                  <div className="tie-card-tit">
                    {tr.tipoOperacion === 'PA'
                      ? 'Pausa — ' + (ETIQUETA_MOTIVO[tr.motivo ?? ''] ?? 'sin motivo')
                      : tr.tipoOperacion
                        ? defTipo(tr.tipoOperacion).label
                        : tr.tipo === 'trabajo'
                          ? 'Trabajo'
                          : (ETIQUETA_MOTIVO[tr.motivo ?? ''] ?? 'Pausa')}
                    {tr.automatico && <span className="tie-auto" title="Automático">🤖</span>}
                    {tr.editado && <span className="tie-editado" title="Horario corregido a mano">editado</span>}
                  </div>
                  <div className="tie-card-horas">
                    {horaDe(tr.inicio)} → {corriendo ? '…' : horaDe(tr.fin)}
                  </div>
                  <div className={'tie-card-reloj' + (corriendo ? ' tie-card-reloj-vivo' : '')}>
                    {comoReloj(Math.max(0, ms))}
                  </div>
                  {tr.automatico && corriendo && (
                    <div className="tie-card-detalle">⏳ La máquina sigue andando</div>
                  )}
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

      {pideTexto && (
        <ModalPrompt
          titulo={defTipo(pideTexto).label}
          etiqueta={pideTexto === 'MA' ? 'Especificar razón del mantenimiento' : 'Especificar actividad'}
          textoConfirmar="Empezar"
          onConfirmar={(valor) => {
            const tipo = pideTexto
            setPideTexto(null)
            arrancarTipo(tipo, { detalle: valor.trim() })
          }}
          onCancelar={() => setPideTexto(null)}
        />
      )}

      {otraEnCurso && (
        <ModalOtraActividad
          otra={otraEnCurso}
          onCerrar={() => setOtraEnCurso(null)}
          onIr={() => {
            const id = otraEnCurso.procesoId
            setOtraEnCurso(null)
            onIrAActividad?.(id)
          }}
        />
      )}

      {modalTramo && (
        <ModalTramo
          procesoId={procesoId}
          tramo={modalTramo.tramo}
          onCerrar={() => setModalTramo(null)}
          onGuardado={() => {
            setModalTramo(null)
            refrescarTramos()
          }}
        />
      )}

      {confirmarFin && (
        <ModalConfirmar
          titulo="Finalizar actividad"
          mensaje={
            manual
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
