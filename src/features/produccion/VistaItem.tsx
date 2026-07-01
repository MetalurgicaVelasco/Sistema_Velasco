import { useEffect, useState } from 'react'
import { supabase } from '../../shared/lib/supabaseClient'
import { cargarRecursos } from '../../shared/lib/recursosApi'
import { nombrePersonal } from '../../shared/types/recursos'
import type { RecursosData } from '../../shared/types/recursos'
import {
  cargarProcesosDeItem,
  eliminarProceso,
  moverProceso,
  duplicarProceso,
  redefinirPredecesores,
  quitarCorrelatividad,
} from './procesosApi'
import { MODO_LABEL, totalMin, fmtDuracion } from './procesoTipos'
import type { Proceso, Correlatividad } from './procesoTipos'
import { fechaCorta } from './proyectoTipos'
import type { Proyecto } from './proyectoTipos'
import type { Item } from './itemTipos'
import ModalProcesoItem from './ModalProcesoItem'

const BUCKET = 'proyectos-fotos'

function VistaItem({
  item,
  proyecto,
  onCerrar,
}: {
  item: Item
  proyecto: Proyecto | null
  onCerrar: () => void
}) {
  const [procesos, setProcesos] = useState<Proceso[]>([])
  const [correlatividades, setCorrelatividades] = useState<Correlatividad[]>([])
  const [recursos, setRecursos] = useState<RecursosData | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [modal, setModal] = useState<{ proceso: Proceso | null } | null>(null)

  async function cargar() {
    setCargando(true)
    try {
      const [pr, rec] = await Promise.all([
        cargarProcesosDeItem(item.id),
        cargarRecursos(),
      ])
      setProcesos(pr.procesos)
      setCorrelatividades(pr.correlatividades)
      setRecursos(rec)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar los procesos.')
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id])

  const cantidad = Number(item.cantidad ?? 1)

  const fotoUrl = item.foto_url
    ? supabase.storage.from(BUCKET).getPublicUrl(item.foto_url).data.publicUrl
    : null

  // ---- Resolución de nombres con recursos ----
  function nombreProceso(p: Proceso): string {
    if (p.tipoProcesoId && recursos) {
      const t = recursos.tiposProceso.find((x) => x.id === p.tipoProcesoId)
      if (t) return t.nombre
    }
    return p.procesoOtro ?? '(sin nombre)'
  }
  function nombreOperario(id: number): string {
    const p = recursos?.personal.find((x) => x.id === id)
    return p ? nombrePersonal(p) : '(?)'
  }
  function nombreMaquina(id: number): string {
    return recursos?.maquinas.find((x) => x.id === id)?.nombre ?? '(?)'
  }

  // Suplentes DERIVADOS de recursos (no se guardan por proceso).
  function maqIdealTexto(p: Proceso): string {
    if (p.maquinaId != null) return nombreMaquina(p.maquinaId)
    if (p.maquinaOtra) return `${p.maquinaOtra} (otra)`
    return '— ninguna —'
  }
  function maqSuplentesTexto(p: Proceso): string {
    if (!recursos || p.tipoProcesoId == null) return ''
    return recursos.maquinas
      .filter(
        (m) => m.tipoProcesoIds.includes(p.tipoProcesoId as number) && m.id !== p.maquinaId,
      )
      .map((m) => m.nombre)
      .join(', ')
  }
  function opSuplentesTexto(p: Proceso): string {
    if (!recursos) return ''
    let ids: number[] = []
    if (p.maquinaId != null) {
      ids = recursos.maquinas.find((m) => m.id === p.maquinaId)?.suplenteIds ?? []
    } else if (p.tipoProcesoId != null) {
      ids = recursos.tiposProceso.find((t) => t.id === p.tipoProcesoId)?.suplenteIds ?? []
    }
    return ids
      .filter((id) => id !== p.operarioId)
      .map(nombreOperario)
      .join(', ')
  }

  // ---- Acciones ----
  function onGuardado() {
    setModal(null)
    cargar()
  }
  async function onEliminar(p: Proceso) {
    if (!window.confirm(`¿Eliminar el proceso "${nombreProceso(p)}"?`)) return
    await eliminarProceso(p.id)
    cargar()
  }
  async function onMover(p: Proceso, delta: number) {
    await moverProceso(item.id, p.id, delta)
    cargar()
  }
  async function onDuplicar(p: Proceso, asRetrabajo: boolean) {
    const msg = asRetrabajo
      ? `¿Crear una copia de "${nombreProceso(p)}" al final, marcada como retrabajo?`
      : `¿Duplicar "${nombreProceso(p)}" al final de la lista?`
    if (!window.confirm(msg)) return
    await duplicarProceso(p.id, asRetrabajo)
    cargar()
  }
  async function onRedefinir() {
    if (
      !window.confirm(
        'Se borran las correlatividades internas del item y se recrean lineales ' +
          'según el orden actual. Las que van a otros items no se tocan. ¿Continuar?',
      )
    )
      return
    await redefinirPredecesores(item.id)
    cargar()
  }
  async function onQuitarPred(c: Correlatividad) {
    await quitarCorrelatividad(c.id)
    cargar()
  }

  return (
    <div className="vista-item">
      <button type="button" className="empresa-boton-secundario" onClick={onCerrar}>
        ← Volver al proyecto
      </button>

      {/* Encabezado del item */}
      <div className="vi-header">
        <div className="vi-titulo">
          <h2>
            Item: {item.descripcion}{' '}
            <span className="vi-cant">×{cantidad}</span>
          </h2>
          <span className="vi-estado">{item.estado}</span>
        </div>
        <div className="vi-datos">
          {fotoUrl ? (
            <img src={fotoUrl} alt="" className="vi-foto" />
          ) : (
            <div className="vi-foto vi-foto-vacia">sin foto</div>
          )}
          <div className="vi-datos-txt">
            <div>
              <b>Proyecto:</b> {proyecto?.descripcion ?? '—'}
            </div>
            <div>
              <b>Cliente:</b> {proyecto?.empresa?.nombre ?? '—'}
            </div>
            <div>
              <b>Pedido:</b> {proyecto?.pedido_nro ?? '—'} · <b>Cantidad:</b>{' '}
              {cantidad}
            </div>
            <div>
              <b>Presentación:</b> {item.presentacion_mat_prima ?? '—'}
            </div>
            <div>
              <b>Fin estipulado:</b> {fechaCorta(item.fecha_fin_estipulada)}
            </div>
          </div>
        </div>
      </div>

      {/* Procesos */}
      <div className="vi-proc-head">
        <h3 className="rec-titulo">Procesos del item</h3>
        <div className="vi-proc-head-btns">
          <button
            type="button"
            className="empresa-boton-secundario"
            onClick={onRedefinir}
            title="Asigna predecesores lineales según el orden actual"
          >
            🔗 Redefinir predecesores
          </button>
          <button
            type="button"
            className="empresa-boton"
            onClick={() => setModal({ proceso: null })}
          >
            + Agregar proceso
          </button>
        </div>
      </div>

      {cargando ? (
        <div className="rec-vacio">Cargando…</div>
      ) : error ? (
        <div className="empresa-form-error">{error}</div>
      ) : procesos.length === 0 ? (
        <div className="rec-vacio">
          Sin procesos. Este item no genera actividades en el tablero.
        </div>
      ) : (
        procesos.map((p, idx) => {
          const preds = correlatividades.filter((c) => c.sucesorId === p.id)
          const supMaq = maqSuplentesTexto(p)
          const supOp = opSuplentesTexto(p)
          return (
            <div
              key={p.id}
              className={'proc-card' + (p.esRetrabajo ? ' proc-card-ret' : '')}
            >
              <div className="proc-card-body">
                <div className="proc-card-t">
                  <span className="proc-num">{idx + 1}.</span>
                  {nombreProceso(p)}
                  <span className={'proc-badge proc-badge-' + p.modo}>
                    {MODO_LABEL[p.modo]}
                  </span>
                  {p.esRetrabajo && (
                    <span className="proc-badge proc-badge-ret">🔁 Retrabajo</span>
                  )}
                </div>
                <div className="proc-card-s">
                  <div>
                    <b>Duración estimada:</b> {fmtDuracion(totalMin(p, cantidad))}
                    {p.setupMin ? ` · setup: ${p.setupMin} min` : ''}
                  </div>
                  <div>
                    <b>Máq. ideal:</b> {maqIdealTexto(p)}
                    {supMaq && (
                      <>
                        {' '}
                        · <b>Suplentes:</b> {supMaq}
                      </>
                    )}
                  </div>
                  <div>
                    <b>Op. ideal:</b>{' '}
                    {p.operarioId != null ? nombreOperario(p.operarioId) : '—'}
                    {supOp && (
                      <>
                        {' '}
                        · <b>Suplentes:</b> {supOp}
                      </>
                    )}
                  </div>
                  {p.detalleTrabajo && (
                    <div>
                      <b>Trabajo:</b> {p.detalleTrabajo}
                    </div>
                  )}
                  <div className="proc-preds">
                    <b>Predecesores:</b>{' '}
                    {preds.length === 0 && (
                      <span className="proc-preds-vacio">ninguno</span>
                    )}
                    {preds.map((c) => {
                      const pred = procesos.find((x) => x.id === c.predecesorId)
                      return (
                        <span key={c.id} className="proc-pred-chip">
                          ↶ {pred ? nombreProceso(pred) : '(otro item)'}
                          <span
                            className="proc-pred-x"
                            title="Quitar predecesor"
                            onClick={() => onQuitarPred(c)}
                          >
                            ×
                          </span>
                        </span>
                      )
                    })}
                  </div>
                </div>
              </div>

              <div className="proc-card-acciones">
                <div className="proc-mover">
                  <button
                    type="button"
                    className="empresa-boton-secundario rec-boton-chico"
                    disabled={idx === 0}
                    onClick={() => onMover(p, -1)}
                    title="Subir"
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    className="empresa-boton-secundario rec-boton-chico"
                    disabled={idx === procesos.length - 1}
                    onClick={() => onMover(p, 1)}
                    title="Bajar"
                  >
                    ▼
                  </button>
                </div>
                <button
                  type="button"
                  className="empresa-boton-secundario rec-boton-chico"
                  onClick={() => setModal({ proceso: p })}
                >
                  Editar
                </button>
                <button
                  type="button"
                  className="empresa-boton-secundario rec-boton-chico"
                  onClick={() => onDuplicar(p, false)}
                >
                  📋 Duplicar
                </button>
                <button
                  type="button"
                  className="empresa-boton-secundario rec-boton-chico"
                  onClick={() => onDuplicar(p, true)}
                >
                  🔁 Retrabajo
                </button>
                <button
                  type="button"
                  className="empresa-boton-peligro rec-boton-chico"
                  onClick={() => onEliminar(p)}
                >
                  Eliminar
                </button>
              </div>
            </div>
          )
        })
      )}

      {modal && recursos && (
        <ModalProcesoItem
          proceso={modal.proceso}
          itemId={item.id}
          tiposProceso={recursos.tiposProceso}
          maquinas={recursos.maquinas}
          personal={recursos.personal.filter((p) => p.activo)}
          onGuardado={onGuardado}
          onCancelar={() => setModal(null)}
        />
      )}
    </div>
  )
}

export default VistaItem
