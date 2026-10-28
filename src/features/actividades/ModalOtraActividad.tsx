import Modal from '../../shared/components/Modal'
import { defTipo } from './tiposOperacion'
import { horaDe } from './tiempos'
import type { ActividadEnCurso } from './actividadApi'

// Aviso de control: el operario quiere arrancar algo, pero tiene otra actividad
// en marcha. No se puede hacer dos cosas manuales a la vez, así que primero hay
// que ir a esa actividad y pausarla o finalizarla.
function ModalOtraActividad({
  otra,
  onIr,
  onCerrar,
}: {
  otra: ActividadEnCurso
  onIr: () => void
  onCerrar: () => void
}) {
  return (
    <Modal titulo="Hay otra actividad en curso" onCerrar={onCerrar} ancho={460}>
      <p className="oa-texto">
        Todavía está corriendo la actividad <b>{otra.proceso}</b>
        {otra.descripcion && <> — {otra.descripcion}</>}.
      </p>
      <p className="oa-detalle">
        {defTipo(otra.tipoOperacion).label} desde las {horaDe(otra.inicio)}. Pausala o finalizala
        antes de empezar acá.
      </p>
      <div className="pf-acciones">
        <button type="button" className="empresa-boton-secundario" onClick={onCerrar}>
          Cerrar
        </button>
        <button type="button" className="empresa-boton" onClick={onIr}>
          Ir a la actividad
        </button>
      </div>
    </Modal>
  )
}

export default ModalOtraActividad
