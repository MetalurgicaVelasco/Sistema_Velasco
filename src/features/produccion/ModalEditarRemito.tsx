import { useState } from 'react'
import Modal from '../../shared/components/Modal'
import { actualizarRemito, PREFIJO_IMPRESO_REMITO } from './remitosApi'

// Edición de un remito ya cargado: solo número y fecha (la cobertura no se
// edita; para cambiarla, borrar y rehacer).
function ModalEditarRemito({
  remitoId,
  numeroInicial,
  fechaInicial,
  onCerrar,
  onGuardado,
}: {
  remitoId: number
  numeroInicial: string // los 4 dígitos
  fechaInicial: string
  onCerrar: () => void
  onGuardado: () => void
}) {
  const [numero, setNumero] = useState(numeroInicial)
  const [fecha, setFecha] = useState(fechaInicial)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function guardar() {
    setError(null)
    setGuardando(true)
    const { error: err } = await actualizarRemito(remitoId, numero, fecha)
    setGuardando(false)
    if (err) {
      setError(err)
      return
    }
    onGuardado()
  }

  return (
    <Modal titulo="Editar remito" onCerrar={onCerrar} ancho={460}>
      <div className="ne-campos">
        <label className="empresa-campo">
          Nº de remito *
          <div className="ne-numimp">
            <span className="ne-numimp-pref">{PREFIJO_IMPRESO_REMITO}</span>
            <input
              className="empresa-input"
              maxLength={4}
              placeholder="0000"
              value={numero}
              onChange={(e) => setNumero(e.target.value.replace(/\D/g, ''))}
            />
          </div>
        </label>
        <label className="empresa-campo">
          Fecha *
          <input type="date" className="empresa-input" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </label>
      </div>

      {error && <p className="empresa-form-error">{error}</p>}

      <div className="pf-acciones">
        <button type="button" className="empresa-boton-secundario" onClick={onCerrar}>
          Cancelar
        </button>
        <button type="button" className="empresa-boton" onClick={guardar} disabled={guardando}>
          {guardando ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </div>
    </Modal>
  )
}

export default ModalEditarRemito
