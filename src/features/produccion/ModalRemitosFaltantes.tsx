import Modal from '../../shared/components/Modal'
import type { ItemIncompleto } from './cierreProyecto'

// Aviso (no bloqueo) al cerrar un proyecto con ítems sin remito completo.
// Reutiliza las clases del modal de predecesores para no sumar CSS nuevo.
export default function ModalRemitosFaltantes({
  items,
  onCancelar,
  onCerrarIgual,
}: {
  items: ItemIncompleto[]
  onCancelar: () => void
  onCerrarIgual: () => void
}) {
  return (
    <Modal titulo="Ítems sin remito completo" onCerrar={onCancelar} ancho={540}>
      <p className="pred-intro">
        El proyecto tiene ítems que todavía no se remitieron en su totalidad. Si lo cerrás igual,
        esos ítems quedan como no entregados.
      </p>
      <div className="pred-lista">
        {items.map((it, i) => (
          <div key={i} className={'pred-item' + (i % 2 ? ' pred-item-alt' : '')}>
            <div className="pred-txt">
              <div className="pred-proc">{it.descripcion}</div>
              <div className="pred-el">
                Remitido {it.remitido} de {it.total} — faltan {it.faltante}
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="pred-acciones">
        <button type="button" className="empresa-boton-secundario" onClick={onCancelar}>
          Cancelar cierre
        </button>
        <button type="button" className="empresa-boton-peligro" onClick={onCerrarIgual}>
          Cerrar igualmente
        </button>
      </div>
    </Modal>
  )
}
