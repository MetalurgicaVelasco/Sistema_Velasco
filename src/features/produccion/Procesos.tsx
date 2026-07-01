import { useEffect, useState } from 'react'
import ModalProceso from './ModalProceso'
import { cargarRecursos } from '../../shared/lib/recursosApi'
import { nombrePersonal } from '../../shared/types/recursos'
import type {
  TipoProceso,
  Maquina,
  Personal,
} from '../../shared/types/recursos'

// Módulo Producción > Procesos: el catálogo de tipos de proceso del taller.
function Procesos() {
  const [tiposProceso, setTiposProceso] = useState<TipoProceso[]>([])
  const [maquinas, setMaquinas] = useState<Maquina[]>([])
  const [personal, setPersonal] = useState<Personal[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // null = modal cerrado; { tp: TipoProceso | null } = abierto (null adentro
  // significa "nuevo").
  const [modal, setModal] = useState<{ tp: TipoProceso | null } | null>(null)

  async function cargar() {
    setCargando(true)
    try {
      const data = await cargarRecursos()
      setTiposProceso(data.tiposProceso)
      setMaquinas(data.maquinas)
      setPersonal(data.personal)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar los procesos.')
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    cargar()
  }, [])

  function nombrePorId(id: number): string {
    const p = personal.find((x) => x.id === id)
    return p ? nombrePersonal(p) : '(?)'
  }

  // Texto de la columna "Operario" según el tipo de proceso.
  function textoOperario(tp: TipoProceso): string {
    if (tp.llevaMaquina) return '— lo define la máquina —'
    const ideal = tp.operarioIdealId
      ? nombrePorId(tp.operarioIdealId)
      : '(sin operario)'
    const supl = tp.suplenteIds.length
      ? ' · supl: ' + tp.suplenteIds.map(nombrePorId).join(', ')
      : ''
    return ideal + supl
  }

  function onGuardado() {
    setModal(null)
    cargar()
  }

  return (
    <div className="rec-vista">
      <div className="rec-head-bar">
        <h2 className="rec-titulo">Procesos</h2>
        <button
          type="button"
          className="empresa-boton"
          onClick={() => setModal({ tp: null })}
        >
          + Nuevo proceso
        </button>
      </div>
      <p className="rec-ayuda">
        Los procesos <strong>con máquina</strong> toman el operario de la
        máquina elegida. Los <strong>sin máquina</strong> (Compra, Control,
        Despacho) usan el operario que definas acá.
      </p>

      {cargando ? (
        <div className="rec-vacio">Cargando…</div>
      ) : error ? (
        <div className="empresa-form-error">{error}</div>
      ) : tiposProceso.length === 0 ? (
        <div className="rec-vacio">No hay procesos cargados.</div>
      ) : (
        <div className="rec-lista">
          <div className="rec-col-head">
            <div style={{ flex: 1 }}>Proceso</div>
            <div style={{ width: 120 }}>Lleva máquina</div>
            <div style={{ width: 280 }}>Operario (procesos sin máquina)</div>
            <div style={{ width: 90 }} />
          </div>
          {tiposProceso.map((tp) => (
            <div key={tp.id} className="rec-fila">
              <div style={{ flex: 1 }} className="rec-nombre">
                {tp.nombre}
              </div>
              <div style={{ width: 120 }} className="rec-celda">
                {tp.llevaMaquina ? '🛠 Sí' : 'No'}
              </div>
              <div
                style={{ width: 280 }}
                className={
                  tp.llevaMaquina ? 'rec-celda rec-celda-tenue' : 'rec-celda'
                }
              >
                {textoOperario(tp)}
              </div>
              <div style={{ width: 90, textAlign: 'right' }}>
                <button
                  type="button"
                  className="empresa-boton-secundario rec-boton-chico"
                  onClick={() => setModal({ tp })}
                >
                  Editar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <ModalProceso
          tipoProceso={modal.tp}
          tiposProceso={tiposProceso}
          maquinas={maquinas}
          personal={personal}
          onGuardado={onGuardado}
          onCancelar={() => setModal(null)}
        />
      )}
    </div>
  )
}

export default Procesos
