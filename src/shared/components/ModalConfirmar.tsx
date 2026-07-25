import { type ReactNode } from 'react'
import Modal from './Modal'

// Confirmación (o aviso) con la estética del sistema, para no usar los
// window.confirm / window.alert del navegador. Con `soloAceptar` funciona como
// un aviso de un solo botón.
export default function ModalConfirmar({
  titulo,
  mensaje,
  textoConfirmar = 'Aceptar',
  textoCancelar = 'Cancelar',
  peligroso = false,
  procesando = false,
  soloAceptar = false,
  onConfirmar,
  onCancelar,
}: {
  titulo: string
  mensaje: ReactNode
  textoConfirmar?: string
  textoCancelar?: string
  peligroso?: boolean
  procesando?: boolean
  soloAceptar?: boolean
  onConfirmar: () => void
  onCancelar: () => void
}) {
  return (
    <Modal titulo={titulo} onCerrar={() => (procesando ? undefined : onCancelar())} ancho={460}>
      <div className="pred-intro">{mensaje}</div>
      <div className="pf-acciones">
        {!soloAceptar && (
          <button
            type="button"
            className="empresa-boton-secundario"
            disabled={procesando}
            onClick={onCancelar}
          >
            {textoCancelar}
          </button>
        )}
        <button
          type="button"
          className={peligroso ? 'empresa-boton-peligro' : 'empresa-boton'}
          disabled={procesando}
          onClick={onConfirmar}
        >
          {procesando ? '…' : textoConfirmar}
        </button>
      </div>
    </Modal>
  )
}
