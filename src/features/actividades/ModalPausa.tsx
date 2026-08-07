import { useState } from 'react'
import Modal from '../../shared/components/Modal'
import type { DatosPausa, MotivoPausa } from './actividadApi'

const MOTIVOS: { id: MotivoPausa; label: string }[] = [
  { id: 'cambio_planificacion', label: 'Cambio de planificación' },
  { id: 'problema_tecnico', label: 'Problema técnico' },
  { id: 'falta_herramienta', label: 'Falta de herramienta o insumo' },
  { id: 'descanso', label: 'Descanso' },
  { id: 'otro', label: 'Otro' },
]

// Quiénes pueden ordenar un cambio de planificación.
const AUTORIZANTES = ['Nicolás Velasco', 'Héctor Velasco', 'Tomás Sola']

// Al pausar hay que decir por qué. Es obligatorio en el momento: después nadie
// se acuerda, y sin el motivo la interrupción no sirve como dato.
function ModalPausa({
  onConfirmar,
  onCancelar,
}: {
  onConfirmar: (p: DatosPausa) => void
  onCancelar: () => void
}) {
  const [motivo, setMotivo] = useState<MotivoPausa | null>(null)
  const [detalle, setDetalle] = useState('')
  const [autorizadoPor, setAutorizadoPor] = useState('')

  const pideDetalle = motivo === 'problema_tecnico' || motivo === 'otro'
  const pideAutorizante = motivo === 'cambio_planificacion'
  const listo =
    motivo != null &&
    (!pideDetalle || detalle.trim() !== '') &&
    (!pideAutorizante || autorizadoPor !== '')

  return (
    <Modal titulo="¿Por qué pausás?" onCerrar={onCancelar} ancho={480}>
      <div className="pau-opciones">
        {MOTIVOS.map((m) => (
          <button
            key={m.id}
            type="button"
            className={'pau-op' + (motivo === m.id ? ' pau-op-activa' : '')}
            onClick={() => setMotivo(m.id)}
          >
            {m.label}
          </button>
        ))}
      </div>

      {pideAutorizante && (
        <label className="empresa-campo">
          ¿Quién dio la orden? *
          <select
            className="empresa-input"
            value={autorizadoPor}
            onChange={(e) => setAutorizadoPor(e.target.value)}
          >
            <option value="">— elegir —</option>
            {AUTORIZANTES.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>
      )}

      {pideDetalle && (
        <label className="empresa-campo">
          {motivo === 'problema_tecnico' ? '¿Qué pasó? *' : 'Especificá *'}
          <input
            className="empresa-input"
            autoFocus
            placeholder={
              motivo === 'problema_tecnico' ? 'Ej: se rompió la herramienta' : 'Motivo de la pausa'
            }
            value={detalle}
            onChange={(e) => setDetalle(e.target.value)}
          />
        </label>
      )}

      <div className="pf-acciones">
        <button type="button" className="empresa-boton-secundario" onClick={onCancelar}>
          Cancelar
        </button>
        <button
          type="button"
          className="empresa-boton"
          disabled={!listo}
          onClick={() =>
            onConfirmar({
              motivo: motivo as MotivoPausa,
              detalle: pideDetalle ? detalle.trim() : null,
              autorizadoPor: pideAutorizante ? autorizadoPor : null,
            })
          }
        >
          Pausar
        </button>
      </div>
    </Modal>
  )
}

export default ModalPausa
