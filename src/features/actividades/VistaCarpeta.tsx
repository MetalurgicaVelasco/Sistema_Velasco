import { useState, useEffect } from 'react'
import VisorFotos from '../../shared/components/VisorFotos'
import { cargarCarpeta, type Carpeta } from './carpetaApi'
import { comoDuracion } from './tiempos'

function fmt(d: string | null): string {
  return d ? d.split('-').reverse().join('/') : '—'
}

// La carpeta completa del ítem, en solo lectura: portada con los datos y la
// lista de procesos, y debajo una orden de trabajo por proceso. Se recorre
// scrolleando, como pasar las hojas.
function VistaCarpeta({
  elementoId,
  proyectoId = null,
  procesoActualId,
  onVolver,
}: {
  elementoId: number
  proyectoId?: number | null
  procesoActualId?: number
  onVolver: () => void
}) {
  const [carpeta, setCarpeta] = useState<Carpeta | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let vivo = true
    cargarCarpeta(elementoId)
      .then((c) => {
        if (vivo) setCarpeta(c)
      })
      .catch((e) => {
        if (vivo) setError(e instanceof Error ? e.message : 'No se pudo cargar la carpeta.')
      })
      .finally(() => {
        if (vivo) setCargando(false)
      })
    return () => {
      vivo = false
    }
  }, [elementoId])

  if (cargando) return <div className="act-vacio">Cargando carpeta…</div>
  if (!carpeta) return <div className="act-vacio">{error ?? 'No se encontró la carpeta.'}</div>

  const { portada: p, procesos } = carpeta

  // Ir a la orden de trabajo de un proceso desde la tabla de la portada.
  function irAProceso(id: number) {
    document.getElementById('carp-ot-' + id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="act-pantalla">
      <button type="button" className="act-volver" onClick={onVolver}>
        ← Volver a la actividad
      </button>

      {/* ── Portada ── */}
      <div className="carp-hoja">
        <div className="carp-cab">
          <img src="/logo-velasco.png" alt="Metalúrgica Velasco" className="carp-logo" />
          <div className="carp-cab-tit">Planilla de trabajo</div>
        </div>

        <table className="carp-info">
          <tbody>
            <tr>
              <td className="carp-lbl">Cliente</td>
              <td className="carp-val carp-val-grande" colSpan={3}>{p.cliente}</td>
            </tr>
            <tr className="carp-shade">
              <td className="carp-lbl">Proyecto</td>
              <td className="carp-val" colSpan={3}>{p.proyecto || '—'}</td>
            </tr>
            <tr>
              <td className="carp-lbl">Ítem</td>
              <td className="carp-val carp-val-grande" colSpan={3}>{p.item}</td>
            </tr>
            <tr className="carp-shade">
              <td className="carp-lbl">Número de pedido</td>
              <td className="carp-val carp-val-fuerte">{p.pedidoNro ?? '—'}</td>
              <td className="carp-lbl">Contacto</td>
              <td className="carp-val">{p.contacto ?? '—'}</td>
            </tr>
            <tr>
              <td className="carp-lbl">Cantidad a realizar</td>
              <td className="carp-val carp-val-fuerte">{p.cantidad}</td>
              <td className="carp-lbl">Teléfono</td>
              <td className="carp-val">{p.telefono ?? '—'}</td>
            </tr>
            <tr className="carp-shade">
              <td className="carp-lbl">Material</td>
              <td className="carp-val">{p.material ?? '—'}</td>
              <td className="carp-lbl">Forma MP</td>
              <td className="carp-val">{p.formaMp ?? '—'}</td>
            </tr>
            <tr>
              <td className="carp-lbl">Fecha de ingreso</td>
              <td className="carp-val">{fmt(p.fechaIngreso)}</td>
              <td className="carp-lbl">Fecha fin estip.</td>
              <td className="carp-val">{fmt(p.fechaFinEstipulada)}</td>
            </tr>
          </tbody>
        </table>

        <table className="carp-procs">
          <thead>
            <tr>
              <th>Nº</th>
              <th>Proceso</th>
              <th>Responsable</th>
              <th>Realizado</th>
            </tr>
          </thead>
          <tbody>
            {procesos.map((pr) => (
              <tr
                key={pr.id}
                className={
                  (pr.numero % 2 === 0 ? 'carp-shade ' : '') +
                  (pr.id === procesoActualId ? 'carp-fila-actual' : '')
                }
                onClick={() => irAProceso(pr.id)}
                title="Ver la orden de trabajo"
              >
                <td className="carp-num">{pr.numero}</td>
                <td>
                  {pr.proceso.toUpperCase()}
                  {pr.id === procesoActualId && <span className="carp-aqui">tu actividad</span>}
                </td>
                <td className="carp-centro">
                  {pr.responsable ? <b>{pr.responsable}</b> : '—'}
                  {pr.suplentes.length > 0 && (
                    <span className="carp-suplentes"> / {pr.suplentes.join(' / ')}</span>
                  )}
                </td>
                <td className="carp-centro carp-check">
                  {pr.hecho ? (pr.porOperario ? '✓' : '✔') : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Todas las fotos: primero las de la pieza, después las del proyecto. */}
        <div className="carp-visor">
          <VisorFotos elementoId={elementoId} proyectoId={proyectoId} />
        </div>
      </div>

      {/* ── Una orden de trabajo por proceso ── */}
      {procesos.map((pr) => (
        <div
          key={pr.id}
          id={'carp-ot-' + pr.id}
          className={'carp-hoja carp-ot' + (pr.id === procesoActualId ? ' carp-ot-actual' : '')}
        >
          <div className="ot-band">
            <span className="ot-band-proc">{pr.proceso}</span>
            {pr.id === procesoActualId && <span className="carp-aqui carp-aqui-band">tu actividad</span>}
            <span className="ot-band-num">
              Orden de trabajo {pr.numero}/{procesos.length}
            </span>
            {pr.hecho && <span className="carp-hecha">✓ realizado</span>}
          </div>

          <div className="carp-ot-cuerpo">
            <div className="ot-grid">
              <div className="ot-dato">
                <span className="ot-lbl">Responsable</span>
                <span className="ot-val">
                  {pr.responsable ? <b>{pr.responsable}</b> : '—'}
                  {pr.suplentes.length > 0 && (
                    <span className="carp-suplentes"> / {pr.suplentes.join(' / ')}</span>
                  )}
                </span>
              </div>
              <div className="ot-dato">
                <span className="ot-lbl">Máquina</span>
                <span className="ot-val">{pr.maquina ?? '—'}</span>
              </div>
              <div className="ot-dato">
                <span className="ot-lbl">Planificado</span>
                <span className="ot-val">{fmt(pr.planFecha)}</span>
              </div>
              <div className="ot-dato">
                <span className="ot-lbl">Tiempo estimado</span>
                <span className="ot-val">{comoDuracion(pr.minutosEstimados * 60000)}</span>
              </div>
            </div>

            {pr.detalleTrabajo && (
              <div className="ot-trabajo">
                <span className="ot-lbl">Trabajo a realizar</span>
                <div className="ot-trabajo-txt">{pr.detalleTrabajo}</div>
              </div>
            )}

            {/* Lo que cargó quien ya lo hizo: es el dato más útil para el que
                sigue. Se muestran siempre, aunque estén vacíos, para que se vea
                que el campo existe y quedó sin completar. */}
            <div className="carp-cargado">
              <span className="ot-lbl">Lo que se registró</span>
              <div className="carp-cargado-fila">
                <b>Material utilizado:</b>{' '}
                {pr.materialUtilizado || <span className="carp-sin-dato">sin completar</span>}
              </div>
              <div className="carp-cargado-fila">
                <b>Observaciones:</b>{' '}
                {pr.observacionesOperario || <span className="carp-sin-dato">sin completar</span>}
              </div>
            </div>
          </div>
        </div>
      ))}

      {error && <p className="empresa-form-error">{error}</p>}
    </div>
  )
}

export default VistaCarpeta
