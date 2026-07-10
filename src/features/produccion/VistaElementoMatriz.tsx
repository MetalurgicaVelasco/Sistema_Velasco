import { useEffect, useState } from 'react'
import { supabase } from '../../shared/lib/supabaseClient'
import { cargarRecursos } from '../../shared/lib/recursosApi'
import { nombrePersonal } from '../../shared/types/recursos'
import type { RecursosData } from '../../shared/types/recursos'
import {
  cargarProcesosDeElemento,
  eliminarProceso,
  moverProceso,
  moverProcesoAPos,
  duplicarProceso,
  redefinirPredecesores,
  quitarCorrelatividad,
} from './procesosApi'
import { DOMINIO_PROCESO_MATRIZ } from './dominioProceso'
import { MODO_LABEL, fmtDuracion } from './procesoTipos'
import type { Proceso, Correlatividad } from './procesoTipos'
import { tipoLabel } from './elementosApi'
import ModalProcesoElemento from './ModalProcesoElemento'
import ModalElementoMatriz from './ModalElementoMatriz'
import ModalAgregarExistente from './ModalAgregarExistente'
import {
  cargarComposicion,
  cargarUbicaciones,
  cargarRutas,
  quitarHijo,
  cambiarCantidad,
  type ElementoMatriz,
  type HijoComposicion,
  type RutaUbicacion,
} from './matrizApi'

const BUCKET = 'proyectos-fotos'

// Vista de una pieza del CATÁLOGO. Es el espejo de VistaElemento (proyectos):
// mismos bloques y misma estética, porque de acá se importa la mayor parte de la
// información al crear un proyecto.
//
// Diferencias del dominio: no hay estado ni cantidad propia (la cantidad vive en
// la composición), y sí hay ubicaciones (Cliente › Sector › Equipo).
function VistaElementoMatriz({
  elemento,
  onCerrar,
}: {
  elemento: ElementoMatriz
  onCerrar: () => void
}) {
  const [actual, setActual] = useState<ElementoMatriz>(elemento)
  const [pila, setPila] = useState<ElementoMatriz[]>([elemento])

  const [procesos, setProcesos] = useState<Proceso[]>([])
  const [correlatividades, setCorrelatividades] = useState<Correlatividad[]>([])
  const [hijos, setHijos] = useState<HijoComposicion[]>([])
  const [rutas, setRutas] = useState<RutaUbicacion[]>([])
  const [recursos, setRecursos] = useState<RecursosData | null>(null)

  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [modalProc, setModalProc] = useState<{ proceso: Proceso | null } | null>(null)
  const [modalElem, setModalElem] = useState<
    { elemento: ElementoMatriz | null; padre: { id: number; tipo: string } | null } | null
  >(null)
  const [modalExistente, setModalExistente] = useState(false)

  useEffect(() => {
    cargarRecursos().then(setRecursos)
  }, [])

  // Solo la primera carga muestra "Cargando…"; las recargas mantienen la lista.
  async function recargar(el: ElementoMatriz, primeraCarga = false) {
    if (primeraCarga) setCargando(true)
    try {
      const [pr, comp, ubic] = await Promise.all([
        cargarProcesosDeElemento(el.id, DOMINIO_PROCESO_MATRIZ),
        cargarComposicion(el.id),
        cargarUbicaciones(el.id),
      ])
      setProcesos(pr.procesos)
      setCorrelatividades(pr.correlatividades)
      setHijos(comp)
      setRutas(await cargarRutas(ubic))
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar el elemento.')
    }
    if (primeraCarga) setCargando(false)
  }

  useEffect(() => {
    recargar(actual, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actual.id])

  const fotoUrl = actual.foto_url
    ? supabase.storage.from(BUCKET).getPublicUrl(actual.foto_url).data.publicUrl
    : null

  // ---- Navegación por la composición ----
  function entrar(h: HijoComposicion) {
    setPila((p) => [...p, h])
    setActual(h)
  }
  function irACrumb(idx: number) {
    const nueva = pila.slice(0, idx + 1)
    setPila(nueva)
    setActual(nueva[nueva.length - 1])
  }

  // ---- Nombres de recursos ----
  function nombreProceso(p: Proceso): string {
    if (p.tipoProcesoId != null) {
      return recursos?.tiposProceso.find((t) => t.id === p.tipoProcesoId)?.nombre ?? '(proceso)'
    }
    return p.procesoOtro ?? '(sin nombre)'
  }
  function nombreOperario(id: number): string {
    const p = recursos?.personal.find((x) => x.id === id)
    return p ? nombrePersonal(p) : '(?)'
  }
  function maqIdealTexto(p: Proceso): string {
    if (p.maquinaId != null) return recursos?.maquinas.find((m) => m.id === p.maquinaId)?.nombre ?? '(?)'
    return p.maquinaOtra ?? '— sin máquina —'
  }

  // ---- Acciones de procesos ----
  function onGuardadoProc() {
    setModalProc(null)
    recargar(actual)
  }
  async function onEliminarProc(p: Proceso) {
    if (!window.confirm(`¿Eliminar el proceso "${nombreProceso(p)}"?`)) return
    await eliminarProceso(p.id, DOMINIO_PROCESO_MATRIZ)
    recargar(actual)
  }
  async function onMoverProc(p: Proceso, delta: number) {
    await moverProceso(actual.id, p.id, delta, DOMINIO_PROCESO_MATRIZ)
    recargar(actual)
  }
  async function aplicarPos(p: Proceso) {
    const txt = window.prompt(`Nueva posición de "${nombreProceso(p)}" (1..${procesos.length}):`)
    if (!txt) return
    const { error } = await moverProcesoAPos(actual.id, p.id, Number(txt), DOMINIO_PROCESO_MATRIZ)
    if (error) {
      window.alert(error)
      return
    }
    recargar(actual)
  }
  async function onDuplicarProc(p: Proceso) {
    await duplicarProceso(p.id, false, DOMINIO_PROCESO_MATRIZ)
    recargar(actual)
  }
  async function onRedefinir() {
    if (!window.confirm('Se van a reasignar los predecesores en orden lineal (1→2→3…). ¿Seguir?')) return
    const { error } = await redefinirPredecesores(actual.id, DOMINIO_PROCESO_MATRIZ)
    if (error) {
      window.alert(error)
      return
    }
    recargar(actual)
  }
  async function onQuitarPred(c: Correlatividad) {
    await quitarCorrelatividad(c.id, DOMINIO_PROCESO_MATRIZ)
    recargar(actual)
  }

  // ---- Acciones de composición ----
  async function onQuitarHijo(h: HijoComposicion) {
    if (!window.confirm(`¿Sacar "${h.descripcion}" de este conjunto? La pieza sigue en el catálogo.`)) return
    await quitarHijo(h.composicionId)
    recargar(actual)
  }
  async function onCambiarCantidad(h: HijoComposicion) {
    const txt = window.prompt(`Cantidad de "${h.descripcion}" en este conjunto:`, String(h.cantidad))
    if (!txt) return
    try {
      await cambiarCantidad(h.composicionId, Number(txt))
      recargar(actual)
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'No se pudo cambiar la cantidad.')
    }
  }

  const esContenedor = actual.tipo !== 'componente'

  return (
    <div className="vi-vista">
      {/* Breadcrumb */}
      <div className="vi-breadcrumb">
        <span className="vi-crumb vi-crumb-link" onClick={onCerrar}>
          Matriz de Productos
        </span>
        {pila.map((el, idx) => (
          <span key={el.id} className="vi-crumb-grupo">
            <span className="vi-crumb-sep">›</span>
            {idx < pila.length - 1 ? (
              <span className="vi-crumb vi-crumb-link" onClick={() => irACrumb(idx)}>
                {el.descripcion}
              </span>
            ) : (
              <span className="vi-crumb vi-crumb-actual">{el.descripcion}</span>
            )}
          </span>
        ))}
      </div>

      {/* Encabezado */}
      <div className="vi-header">
        <div className="vi-titulo">
          <h2>{actual.descripcion}</h2>
          <span className="vi-estado">{tipoLabel(actual.tipo)}</span>
          <button
            type="button"
            className="empresa-boton-secundario"
            onClick={() => setModalElem({ elemento: actual, padre: null })}
          >
            Editar datos
          </button>
        </div>
        <div className="vi-datos">
          {fotoUrl ? (
            <img src={fotoUrl} alt="" className="vi-foto" />
          ) : (
            <div className="vi-foto vi-foto-vacia">sin foto</div>
          )}
          <div className="vi-datos-txt">
            <div>
              <b>Código del cliente:</b> {actual.codigo_cliente ?? '—'}
            </div>
            <div>
              <b>Material:</b>{' '}
              {actual.material_id != null ? `#${actual.material_id}` : '—'} · <b>Presentación:</b>{' '}
              {actual.presentacion_mat_prima ?? '—'}
            </div>
            <div>
              <b>Ubicaciones:</b>{' '}
              {rutas.length === 0 ? (
                <span className="proc-preds-vacio">hereda la del conjunto que la contiene</span>
              ) : (
                rutas.map((r) => (
                  <span key={r.equipoId} className="ubic-chip-inline">
                    📍 {r.texto}
                  </span>
                ))
              )}
            </div>
            {actual.es_dispositivo ? (
              <div>
                <b>Dispositivo o pieza auxiliar</b>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Composición (los hijos): el espejo de "Contenido" en proyectos */}
      {esContenedor ? (
        <div className="vi-hijos">
          <div className="vi-proc-head">
            <h3 className="rec-titulo">Composición</h3>
            <div className="vi-proc-head-btns">
              <button
                type="button"
                className="empresa-boton-secundario"
                onClick={() => setModalExistente(true)}
              >
                + Elemento existente
              </button>
              <button
                type="button"
                className="empresa-boton"
                onClick={() => setModalElem({ elemento: null, padre: { id: actual.id, tipo: actual.tipo } })}
              >
                + Nuevo elemento
              </button>
            </div>
          </div>

          {hijos.length === 0 ? (
            <div className="rec-vacio">Todavía no hay elementos adentro.</div>
          ) : (
            <table className="tabla">
              <thead>
                <tr>
                  <th>Nº</th>
                  <th>Tipo</th>
                  <th>Descripción</th>
                  <th>Cant.</th>
                  <th>Código</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {hijos.map((h, i) => (
                  <tr key={h.composicionId} className="tabla-fila" title="Doble click para entrar" onDoubleClick={() => entrar(h)}>
                    <td>{i + 1}</td>
                    <td>{tipoLabel(h.tipo)}</td>
                    <td>{h.descripcion}</td>
                    <td>{h.cantidad}</td>
                    <td>{h.codigo_cliente ?? '—'}</td>
                    <td className="tabla-acciones">
                      <button type="button" className="empresas-editar" onClick={() => onCambiarCantidad(h)}>
                        Cantidad
                      </button>
                      <button type="button" className="empresas-borrar" onClick={() => onQuitarHijo(h)}>
                        Sacar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : null}

      {/* Procesos: idéntico a proyectos, contra las tablas del catálogo */}
      <div className="vi-proc-head">
        <h3 className="rec-titulo">Procesos</h3>
        <div className="vi-proc-head-btns">
          <button
            type="button"
            className="empresa-boton-secundario"
            onClick={onRedefinir}
            title="Asigna predecesores lineales según el orden actual"
          >
            🔗 Redefinir predecesores
          </button>
          <button type="button" className="empresa-boton" onClick={() => setModalProc({ proceso: null })}>
            + Agregar proceso
          </button>
        </div>
      </div>

      {cargando ? (
        <div className="rec-vacio">Cargando…</div>
      ) : error ? (
        <div className="empresa-form-error">{error}</div>
      ) : procesos.length === 0 ? (
        <div className="rec-vacio">Sin procesos. Definí acá la receta de fabricación de esta pieza.</div>
      ) : (
        procesos.map((p, idx) => {
          const preds = correlatividades.filter((c) => c.sucesorId === p.id)
          return (
            <div key={p.id} className="proc-card">
              <div className="proc-card-body">
                <div className="proc-card-t">
                  <span className="proc-num">{idx + 1}.</span>
                  {nombreProceso(p)}
                  <span className={'proc-badge proc-badge-' + p.modo}>{MODO_LABEL[p.modo]}</span>
                </div>
                <div className="proc-card-s">
                  <div>
                    <b>Duración (1 unidad):</b> {fmtDuracion(p.setupMin + p.operacionMin + p.margenMin)}
                    {p.setupMin ? ` · setup: ${p.setupMin} min` : ''}
                  </div>
                  <div>
                    <b>Máq. ideal:</b> {maqIdealTexto(p)}
                  </div>
                  <div>
                    <b>Op. ideal:</b> {p.operarioId != null ? nombreOperario(p.operarioId) : '—'}
                  </div>
                  {p.detalleTrabajo && (
                    <div>
                      <b>Trabajo:</b> {p.detalleTrabajo}
                    </div>
                  )}
                  <div className="proc-preds">
                    <b>Predecesores:</b>{' '}
                    {preds.length === 0 && <span className="proc-preds-vacio">ninguno</span>}
                    {preds.map((c) => {
                      const pred = procesos.find((x) => x.id === c.predecesorId)
                      return (
                        <span key={c.id} className="proc-pred-chip">
                          ↶ {pred ? nombreProceso(pred) : '(otro elemento)'}
                          <span className="proc-pred-x" title="Quitar predecesor" onClick={() => onQuitarPred(c)}>
                            ×
                          </span>
                        </span>
                      )
                    })}
                  </div>
                </div>
              </div>
              <div className="proc-card-acciones">
                <button type="button" className="proc-btn" disabled={idx === 0} onClick={() => onMoverProc(p, -1)} title="Subir">
                  ↑
                </button>
                <button
                  type="button"
                  className="proc-btn"
                  disabled={idx === procesos.length - 1}
                  onClick={() => onMoverProc(p, 1)}
                  title="Bajar"
                >
                  ↓
                </button>
                <button type="button" className="proc-btn" onClick={() => aplicarPos(p)} title="Mover a posición">
                  #
                </button>
                <button type="button" className="proc-btn" onClick={() => onDuplicarProc(p)} title="Duplicar">
                  ⧉
                </button>
                <button type="button" className="proc-btn" onClick={() => setModalProc({ proceso: p })}>
                  Editar
                </button>
                <button type="button" className="proc-btn proc-btn-x" onClick={() => onEliminarProc(p)}>
                  Borrar
                </button>
              </div>
            </div>
          )
        })
      )}

      {modalProc && recursos && (
        <ModalProcesoElemento
          proceso={modalProc.proceso}
          elementoId={actual.id}
          tiposProceso={recursos.tiposProceso}
          maquinas={recursos.maquinas}
          personal={recursos.personal.filter((p) => p.activo)}
          dom={DOMINIO_PROCESO_MATRIZ}
          onGuardado={onGuardadoProc}
          onCancelar={() => setModalProc(null)}
        />
      )}

      {modalElem && (
        <ModalElementoMatriz
          elemento={modalElem.elemento}
          padre={modalElem.padre}
          onGuardado={async () => {
            setModalElem(null)
            recargar(actual)
          }}
          onCancelar={() => setModalElem(null)}
        />
      )}

      {modalExistente && (
        <ModalAgregarExistente
          padre={{ id: actual.id, tipo: actual.tipo }}
          onAgregado={() => {
            setModalExistente(false)
            recargar(actual)
          }}
          onCancelar={() => setModalExistente(false)}
        />
      )}
    </div>
  )
}

export default VistaElementoMatriz
