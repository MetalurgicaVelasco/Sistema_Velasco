import { useState } from 'react'
import Modal from '../../shared/components/Modal'
import ModalConfirmar from '../../shared/components/ModalConfirmar'
import { agregarTramo, corregirTramo, borrarTramo, type MotivoPausa } from './actividadApi'
import type { Tramo } from './tiempos'

const MOTIVOS: { id: MotivoPausa; label: string }[] = [
  { id: 'cambio_planificacion', label: 'Cambio de planificación' },
  { id: 'problema_tecnico', label: 'Problema técnico' },
  { id: 'falta_herramienta', label: 'Falta de herramienta o insumo' },
  { id: 'descanso', label: 'Descanso' },
  { id: 'otro', label: 'Otro' },
]
const AUTORIZANTES = ['Nicolás Velasco', 'Héctor Velasco', 'Tomás Sola']

// ISO → 'YYYY-MM-DDTHH:mm' (lo que espera <input type="datetime-local">).
function isoALocal(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}
function localAIso(local: string): string | null {
  if (!local) return null
  const d = new Date(local)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

// Corregir un tramo ya cargado, o agregar uno que no se registró en el momento.
// Los horarios reales (cuándo se tocaron los botones) no se tocan nunca: el
// tramo queda marcado como "editado".
function ModalTramo({
  procesoId,
  tramo,
  onCerrar,
  onGuardado,
}: {
  procesoId: number
  tramo: Tramo | null // null = agregar uno nuevo
  onCerrar: () => void
  onGuardado: () => void
}) {
  const editando = tramo != null
  const [tipo, setTipo] = useState<'trabajo' | 'pausa'>(tramo?.tipo ?? 'trabajo')
  const [inicio, setInicio] = useState(isoALocal(tramo?.inicio ?? null))
  const [fin, setFin] = useState(isoALocal(tramo?.fin ?? null))
  const [motivo, setMotivo] = useState<MotivoPausa | ''>((tramo?.motivo as MotivoPausa) ?? '')
  const [detalle, setDetalle] = useState(tramo?.motivoDetalle ?? '')
  const [autorizadoPor, setAutorizadoPor] = useState(tramo?.autorizadoPor ?? '')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmarBorrar, setConfirmarBorrar] = useState(false)

  const pideDetalle = tipo === 'pausa' && (motivo === 'problema_tecnico' || motivo === 'otro')
  const pideAutorizante = tipo === 'pausa' && motivo === 'cambio_planificacion'

  async function guardar() {
    setError(null)
    const iniIso = localAIso(inicio)
    if (!iniIso) {
      setError('Ingresá la hora de inicio.')
      return
    }
    const finIso = localAIso(fin)
    if (finIso && Date.parse(finIso) < Date.parse(iniIso)) {
      setError('El fin no puede ser anterior al inicio.')
      return
    }
    if (!editando) {
      if (!finIso) {
        setError('Ingresá la hora de fin.')
        return
      }
      if (tipo === 'pausa' && !motivo) {
        setError('Elegí el motivo de la pausa.')
        return
      }
      if (pideDetalle && detalle.trim() === '') {
        setError('Completá el detalle.')
        return
      }
      if (pideAutorizante && !autorizadoPor) {
        setError('Elegí quién dio la orden.')
        return
      }
    }

    setGuardando(true)
    const r = editando
      ? await corregirTramo(tramo!.id, iniIso, finIso)
      : await agregarTramo(procesoId, {
          tipo,
          inicio: iniIso,
          fin: finIso as string,
          motivo: tipo === 'pausa' ? (motivo as MotivoPausa) : null,
          detalle: pideDetalle ? detalle.trim() : null,
          autorizadoPor: pideAutorizante ? autorizadoPor : null,
        })
    setGuardando(false)
    if (r.error) {
      setError(r.error)
      return
    }
    onGuardado()
  }

  async function hacerBorrar() {
    if (!tramo) return
    setGuardando(true)
    const { error: err } = await borrarTramo(tramo.id)
    setGuardando(false)
    setConfirmarBorrar(false)
    if (err) {
      setError(err)
      return
    }
    onGuardado()
  }

  return (
    <Modal
      titulo={editando ? 'Corregir tramo' : 'Agregar tramo'}
      onCerrar={() => (guardando ? undefined : onCerrar())}
      ancho={480}
    >
      {!editando && (
        <div className="tra-tipos">
          <button
            type="button"
            className={'tra-tipo' + (tipo === 'trabajo' ? ' tra-tipo-activo' : '')}
            onClick={() => setTipo('trabajo')}
          >
            Trabajo
          </button>
          <button
            type="button"
            className={'tra-tipo' + (tipo === 'pausa' ? ' tra-tipo-activo' : '')}
            onClick={() => setTipo('pausa')}
          >
            Pausa
          </button>
        </div>
      )}

      <div className="ne-campos">
        <label className="empresa-campo">
          Desde *
          <input
            type="datetime-local"
            className="empresa-input"
            value={inicio}
            onChange={(e) => setInicio(e.target.value)}
          />
        </label>
        <label className="empresa-campo">
          Hasta {editando ? '' : '*'}
          <input
            type="datetime-local"
            className="empresa-input"
            value={fin}
            onChange={(e) => setFin(e.target.value)}
          />
        </label>
      </div>
      {editando && !fin && (
        <p className="pf-ayuda">Sin hora de fin el tramo queda corriendo.</p>
      )}

      {!editando && tipo === 'pausa' && (
        <>
          <label className="empresa-campo">
            Motivo *
            <select
              className="empresa-input"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value as MotivoPausa)}
            >
              <option value="">— elegir —</option>
              {MOTIVOS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
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
              Detalle *
              <input
                className="empresa-input"
                value={detalle}
                onChange={(e) => setDetalle(e.target.value)}
              />
            </label>
          )}
        </>
      )}

      {error && <p className="empresa-form-error">{error}</p>}

      <div className="pf-acciones">
        <button type="button" className="empresa-boton-secundario" disabled={guardando} onClick={onCerrar}>
          Cancelar
        </button>
        {editando && (
          <button
            type="button"
            className="empresa-boton-peligro"
            disabled={guardando}
            onClick={() => setConfirmarBorrar(true)}
          >
            Borrar tramo
          </button>
        )}
        <button type="button" className="empresa-boton" disabled={guardando} onClick={guardar}>
          {guardando ? 'Guardando…' : 'Guardar'}
        </button>
      </div>

      {confirmarBorrar && (
        <ModalConfirmar
          titulo="Borrar tramo"
          mensaje="¿Borrar este tramo? El tiempo que registraba se descuenta del total."
          textoConfirmar="Borrar"
          peligroso
          procesando={guardando}
          onConfirmar={hacerBorrar}
          onCancelar={() => setConfirmarBorrar(false)}
        />
      )}
    </Modal>
  )
}

export default ModalTramo
