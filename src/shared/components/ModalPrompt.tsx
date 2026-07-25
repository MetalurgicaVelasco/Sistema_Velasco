import { useState } from 'react'
import Modal from './Modal'

// Pide un valor de texto (o número) con la estética del sistema, en reemplazo
// del window.prompt del navegador.
export default function ModalPrompt({
  titulo,
  etiqueta,
  valorInicial = '',
  tipo = 'text',
  textoConfirmar = 'Guardar',
  requerido = true,
  onConfirmar,
  onCancelar,
}: {
  titulo: string
  etiqueta: string
  valorInicial?: string
  tipo?: 'text' | 'number'
  textoConfirmar?: string
  requerido?: boolean
  onConfirmar: (valor: string) => void
  onCancelar: () => void
}) {
  const [valor, setValor] = useState(valorInicial)
  const vacio = requerido && valor.trim() === ''
  return (
    <Modal titulo={titulo} onCerrar={onCancelar} ancho={420}>
      <label className="empresa-campo">
        {etiqueta}
        <input
          className="empresa-input"
          type={tipo}
          value={valor}
          autoFocus
          onChange={(e) => setValor(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !vacio) onConfirmar(valor)
          }}
        />
      </label>
      <div className="pf-acciones">
        <button type="button" className="empresa-boton-secundario" onClick={onCancelar}>
          Cancelar
        </button>
        <button type="button" className="empresa-boton" disabled={vacio} onClick={() => onConfirmar(valor)}>
          {textoConfirmar}
        </button>
      </div>
    </Modal>
  )
}
