import { useState } from 'react'
import Modal from '../../shared/components/Modal'
import { nombrePersonal } from '../../shared/types/recursos'
import type { TipoProceso, Maquina, Personal } from '../../shared/types/recursos'
import { guardarProceso } from './procesosApi'
import type { Proceso, ModoProceso } from './procesoTipos'

// Modal para crear o editar un proceso de un item. Los suplentes de máquina y
// operario NO se editan acá: se derivan de recursos y se muestran en la tarjeta.
// Usa el <Modal> compartido (arrastrable, no cierra al click afuera, × fija).
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

  const MODOS: [ModoProceso, string, string][] = [
    ['manual', 'Manual', 'El operario está presente todo el tiempo de la actividad.'],
    [
      'semi_automatica',
      'Semi-automática',
      'Setup y la máquina sigue sola hasta fin de jornada; retoma al otro día.',
    ],
    ['automatica', 'Automática', 'Setup y la máquina corre 24/7 hasta terminar.'],
  ]

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
    <Modal
      titulo={esEditar ? 'Editar proceso' : 'Nuevo proceso'}
      onCerrar={onCancelar}
      ancho={680}
    >
      {/* Proceso */}
      <div className="ef">
        <div className="ef-l">
          Proceso <span className="ef-req">*</span>
        </div>
        <select
          className="ef-i"
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
        {procSel === 'OTRO' && (
          <input
            className="ef-i"
            style={{ marginTop: 6 }}
            value={procOtro}
            onChange={(e) => setProcOtro(e.target.value)}
            placeholder="Especificá el proceso…"
          />
        )}
        <div className="ef-help">
          Es lo que se muestra en el bloque del tablero junto al item.
        </div>
      </div>

      {/* Tiempos */}
      <div className="proc-fila-3">
        <div className="ef">
          <div className="ef-l">Tiempo de setup (min)</div>
          <input
            type="number"
            className="ef-i"
            value={setup}
            min="0"
            step="5"
            onChange={(e) => setSetup(e.target.value)}
          />
        </div>
        <div className="ef">
          <div className="ef-l">
            Tiempo de operación (min) <span className="ef-req">*</span>
          </div>
          <input
            type="number"
            className="ef-i"
            value={operacion}
            min="0"
            step="0.1"
            onChange={(e) => setOperacion(e.target.value)}
          />
        </div>
        <div className="ef">
          <div className="ef-l">Margen (min)</div>
          <input
            type="number"
            className="ef-i"
            value={margen}
            min="0"
            step="10"
            onChange={(e) => setMargen(e.target.value)}
          />
        </div>
      </div>
      <div className="ef-help" style={{ marginTop: -6, marginBottom: 12 }}>
        El <b>setup</b> es el seteo de la máquina, una sola vez. La{' '}
        <b>operación</b> es por pieza. Total = setup + cantidad del item ×
        operación, y el <b>margen</b> se suma al total.
      </div>

      {/* Modo */}
      <div className="ef">
        <div className="ef-l">
          Tipo <span className="ef-req">*</span>
        </div>
        <div className="proc-modos">
          {MODOS.map(([val, titulo, desc]) => (
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
      <div className="ef">
        <div className="ef-l">
          Máquina ideal <span className="ef-req">*</span>
        </div>
        <select
          className="ef-i"
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
        {maqSel === 'OTRA' && (
          <input
            className="ef-i"
            style={{ marginTop: 6 }}
            value={maqOtra}
            onChange={(e) => setMaqOtra(e.target.value)}
            placeholder="Especificá la máquina…"
          />
        )}
      </div>

      {/* Operario */}
      <div className="ef">
        <div className="ef-l">Operario ideal</div>
        <select
          className="ef-i"
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
      </div>

      {/* Es retrabajo */}
      <div className={'proc-retrabajo-box' + (esRetrabajo ? ' on' : '')}>
        <label>
          <input
            type="checkbox"
            checked={esRetrabajo}
            onChange={(e) => setEsRetrabajo(e.target.checked)}
          />
          🔁 Es retrabajo
        </label>
      </div>

      {/* Detalle de tareas */}
      <div className="ef">
        <div className="ef-l">Detalle de tareas (para la orden de trabajo)</div>
        <textarea
          className="ef-i"
          rows={3}
          value={detalle}
          onChange={(e) => setDetalle(e.target.value)}
          placeholder="Ej. Tornear según plano. Consultar dudas con Nicolás."
        />
      </div>

      {error && <p className="empresa-form-error">{error}</p>}

      <div className="ef-actions">
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
    </Modal>
  )
}

export default ModalProcesoItem
