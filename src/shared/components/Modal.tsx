import type { ReactNode } from 'react'

type ModalProps = {
  titulo: string
  onCerrar: () => void
  children: ReactNode // lo que se ponga entre <Modal> y </Modal>
}

function Modal({ titulo, onCerrar, children }: ModalProps) {
  return (
    // Fondo oscuro. NO cierra al clickear afuera (decisión de diseño del sistema):
    // el modal se cierra solo con la X o con sus botones.
    <div className="modal-overlay">
      <div className="modal-caja">
        {/* Header fijo: la X queda siempre visible aunque el cuerpo scrollee. */}
        <div className="modal-header">
          <h3 className="modal-titulo">{titulo}</h3>
          <button type="button" className="modal-cerrar" onClick={onCerrar}>
            ×
          </button>
        </div>
        {/* Solo esta zona scrollea. */}
        <div className="modal-cuerpo">{children}</div>
      </div>
    </div>
  )
}

export default Modal
