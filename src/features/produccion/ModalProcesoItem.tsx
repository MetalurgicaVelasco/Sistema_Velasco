import { useState } from 'react'
import { nombrePersonal } from '../../shared/types/recursos'
import type { TipoProceso, Maquina, Personal } from '../../shared/types/recursos'
import { guardarProceso } from './procesosApi'
import type { Proceso, ModoProceso } from './procesoTipos'

// Modal para crear o editar un proceso de un item. Los suplentes de máquina y
// operario NO se editan acá: se derivan de recursos y se muestran en la tarjeta.
function ModalProcesoItem({
  proceso,
  itemId,
  tiposProceso,
  maquinas,
  personal,
  onGuardado,
  onCancelar,
}: {
  proceso: Proceso | null
  itemId: number
  tiposProceso: TipoProceso[]
  maquinas: Maquina[]
  personal: Personal[]
  onGuardado: () => void
  onCancelar: () => void
}) {
  const esEditar = proceso != null

  // Proceso: id del tipo, o 'OTRO' (nombre libre).
  const [procSel, setProcSel] = useState<string>(
    proceso ? (proceso.tipoProcesoId ? String(proceso.tipoProcesoId) : 'OTRO') : '',
  )
  const [procOtro, setProcOtro] = useState(proceso?.procesoOtro ?? '')

  const [setup, setSetup] = useState(String(proceso?.setupMin ?? 0))
  const [operacion, setOperacion] = useState(String(proceso?.operacionMin ?? 0))
  const [margen, setMargen] = useState(String(proceso?.margenMin ?? 0))
  const [modo, setModo] = useState<ModoProceso>(proceso?.modo ?? 'manual')

  // Máquina: id, 'OTRA' (texto) o 'NINGUNA'.
  const [maqSel, setMaqSel] = useState<string>(
    proceso
      ? proceso.maquinaId
        ? String(proceso.maquinaId)
        : proceso.maquinaOtra
          ? 'OTRA'
          : 'NINGUNA'
      : '',
  )
  const [maqOtra, setMaqOtra] = useState(proceso?.maquinaOtra ?? '')
  const [opSel, setOpSel] = useState<string>(
    proceso?.operarioId ? String(proceso.operarioId) : '',
  )
  const [esRetrabajo, setEsRetrabajo] = useState(proceso?.esRetrabajo ?? false)
  const [detalle, setDetalle] = useState(proceso?.detalleTrabajo ?? '')

  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  const tiposOrden = tiposProceso
    .slice()
    .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0) || a.nombre.localeCompare(b.nombre))
  const maquinasOrden = maquinas
    .slice()
    .sort((a, b) => a.nombre.localeCompare(b.nombre))
  const personalOrden = personal
    .slice()
    .sort((a, b) => nombrePersonal(a).localeCompare(nombrePersonal(b)))

  async function guardar() {
    if (!procSel) {
      setError('Elegí un proceso.')
      return
    }
    if (procSel === 'OTRO' && procOtro.trim() === '') {
      setError('Especificá el nombre del proceso ("Otro").')
      return
    }
    if (!maqSel) {
      setError('Elegí una máquina (o "Ninguna").')
      return
    }
    if (maqSel === 'OTRA' && maqOtra.trim() === '') {
      setError('Especificá el nombre de la máquina ("Otra").')
      return
    }

    setGuardando(true)
    const { error: err } = await guardarProceso({
      id: proceso?.id ?? null,
      itemId,
      tipoProcesoId: procSel === 'OTRO' ? null : Number(procSel),
      procesoOtro: procSel === 'OTRO' ? procOtro.trim() : null,
      modo,
      setupMin: Number(setup) || 0,
      operacionMin: Number(operacion) || 0,
      margenMin: Number(margen) || 0,
      maquinaId: maqSel === 'OTRA' || maqSel === 'NINGUNA' ? null : Number(maqSel),
      maquinaOtra: maqSel === 'OTRA' ? maqOtra.trim() : null,
      operarioId: opSel ? Number(opSel) : null,
      detalleTrabajo: detalle.trim() || null,
      esRetrabajo,
    })
    setGuardando(false)
    if (err) {
      setError(err)
      return
    }
    onGuardado()
  }

  return (
    <div className="pf-modal-fondo" onClick={onCancelar}>
      <div className="rec-modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="pf-modal-titulo">
          {esEditar ? 'Editar proceso' : 'Nuevo proceso'}
        </h3>

        {/* Proceso */}
        <label className="empresa-campo">
          Proceso *
          <select
            className="empresa-input"
            value={procSel}
            onChange={(e) => setProcSel(e.target.value)}
          >
            <option value="">— elegir proceso —</option>
            {tiposOrden.map((t) => (
              <option key={t.id} value={String(t.id)}>
                {t.nombre}
              </option>
            ))}
            <option value="OTRO">Otro (especificar)</option>
          </select>
        </label>
        {procSel === 'OTRO' && (
          <label className="empresa-campo">
            Nombre del proceso
            <input
              className="empresa-input"
              value={procOtro}
              onChange={(e) => setProcOtro(e.target.value)}
              placeholder="Ej. Granallado"
            />
          </label>
        )}

        {/* Tiempos */}
        <div className="proc-fila-3">
          <label className="empresa-campo">
            Setup (min)
            <input
              type="number"
              className="empresa-input"
              value={setup}
              min="0"
              step="5"
              onChange={(e) => setSetup(e.target.value)}
            />
          </label>
          <label className="empresa-campo">
            Operación (min/pieza)
            <input
              type="number"
              className="empresa-input"
              value={operacion}
              min="0"
              step="0.1"
              onChange={(e) => setOperacion(e.target.value)}
            />
          </label>
          <label className="empresa-campo">
            Margen (min)
            <input
              type="number"
              className="empresa-input"
              value={margen}
              min="0"
              step="10"
              onChange={(e) => setMargen(e.target.value)}
            />
          </label>
        </div>
        <span className="pf-ayuda">
          Total = setup + cantidad del item × operación (+ margen).
        </span>

        {/* Modo */}
        <div className="empresa-campo">
          <span className="pf-label">Tipo *</span>
          <div className="proc-modos">
            {(
              [
                ['manual', 'Manual', 'El operario está presente todo el tiempo.'],
                [
                  'semi_automatica',
                  'Semi-automática',
                  'Setup y la máquina sigue sola hasta fin de jornada; retoma al otro día.',
                ],
                [
                  'automatica',
                  'Automática',
                  'Setup y la máquina corre 24/7 hasta terminar.',
                ],
              ] as [ModoProceso, string, string][]
            ).map(([val, titulo, desc]) => (
              <label
                key={val}
                className={'proc-modo' + (modo === val ? ' proc-modo-sel' : '')}
              >
                <input
                  type="radio"
                  name="modo"
                  checked={modo === val}
                  onChange={() => setModo(val)}
                />
                <span>
                  <strong>{titulo}</strong>
                  <span className="proc-modo-desc">{desc}</span>
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Máquina */}
        <label className="empresa-campo">
          Máquina ideal *
          <select
            className="empresa-input"
            value={maqSel}
            onChange={(e) => setMaqSel(e.target.value)}
          >
            <option value="">— elegir —</option>
            {maquinasOrden.map((m) => (
              <option key={m.id} value={String(m.id)}>
                {m.nombre}
              </option>
            ))}
            <option value="OTRA">Otra (especificar)</option>
            <option value="NINGUNA">Ninguna (sin máquina)</option>
          </select>
        </label>
        {maqSel === 'OTRA' && (
          <label className="empresa-campo">
            Nombre de la máquina
            <input
              className="empresa-input"
              value={maqOtra}
              onChange={(e) => setMaqOtra(e.target.value)}
            />
          </label>
        )}

        {/* Operario */}
        <label className="empresa-campo">
          Operario ideal
          <select
            className="empresa-input"
            value={opSel}
            onChange={(e) => setOpSel(e.target.value)}
          >
            <option value="">— sin operario —</option>
            {personalOrden.map((p) => (
              <option key={p.id} value={String(p.id)}>
                {nombrePersonal(p)}
              </option>
            ))}
          </select>
        </label>

        {/* Es retrabajo */}
        <label className="filtro-check">
          <input
            type="checkbox"
            checked={esRetrabajo}
            onChange={(e) => setEsRetrabajo(e.target.checked)}
          />
          🔁 Es retrabajo
        </label>

        {/* Detalle de tareas */}
        <label className="empresa-campo">
          Detalle de tareas (para la orden de trabajo)
          <textarea
            className="empresa-input"
            rows={3}
            value={detalle}
            onChange={(e) => setDetalle(e.target.value)}
            placeholder="Ej. Tornear según plano. Consultar dudas con Nicolás."
          />
        </label>

        {error && <p className="empresa-form-error">{error}</p>}

        <div className="pf-acciones">
          <button
            type="button"
            className="empresa-boton-secundario"
            onClick={onCancelar}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="empresa-boton"
            onClick={guardar}
            disabled={guardando}
          >
            {guardando ? 'Guardando…' : esEditar ? 'Guardar' : 'Agregar'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ModalProcesoItem
