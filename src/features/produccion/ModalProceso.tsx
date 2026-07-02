import { useState } from 'react'
import ChecklistColumnas from '../../shared/components/ChecklistColumnas'
import { nombrePersonal } from '../../shared/types/recursos'
import type { TipoProceso, Maquina, Personal } from '../../shared/types/recursos'
import {
  guardarTipoProceso,
  eliminarTipoProceso,
} from '../../shared/lib/recursosApi'

// Modal para crear o editar un tipo de proceso. Persiste directo (no en lote):
// al guardar/eliminar con éxito avisa al padre para que recargue y cierre.
function ModalProceso({
  tipoProceso,
  tiposProceso,
  maquinas,
  personal,
  onGuardado,
  onCancelar,
}: {
  tipoProceso: TipoProceso | null
  tiposProceso: TipoProceso[]
  maquinas: Maquina[]
  personal: Personal[]
  onGuardado: () => void
  onCancelar: () => void
}) {
  const esEditar = tipoProceso != null

  const [nombre, setNombre] = useState(tipoProceso?.nombre ?? '')
  // Por defecto un proceso nuevo lleva máquina (es el caso más común).
  const [llevaMaquina, setLlevaMaquina] = useState(
    tipoProceso?.llevaMaquina ?? true,
  )
  const [operarioIdealId, setOperarioIdealId] = useState<number | null>(
    tipoProceso?.operarioIdealId ?? null,
  )
  const [suplenteIds, setSuplenteIds] = useState<number[]>(
    tipoProceso?.suplenteIds ?? [],
  )
  const [maquinaIds, setMaquinaIds] = useState<number[]>(
    tipoProceso?.maquinaIds ?? [],
  )
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  function toggleSuplente(id: number) {
    setSuplenteIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }
  function toggleMaquina(id: number) {
    setMaquinaIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  async function guardar() {
    const limpio = nombre.trim()
    if (limpio === '') {
      setError('Ingresá el nombre del proceso.')
      return
    }
    // Nombre único (excluye el propio en edición).
    const dup = tiposProceso.some(
      (t) =>
        t.nombre.toLowerCase() === limpio.toLowerCase() &&
        t.id !== tipoProceso?.id,
    )
    if (dup) {
      setError('Ya existe un proceso con ese nombre.')
      return
    }

    setGuardando(true)
    const { error: err } = await guardarTipoProceso({
      id: tipoProceso?.id ?? null,
      nombre: limpio,
      llevaMaquina,
      operarioIdealId: llevaMaquina ? null : operarioIdealId,
      suplenteIds: llevaMaquina ? [] : suplenteIds,
      maquinaIds: llevaMaquina ? maquinaIds : [],
    })
    setGuardando(false)
    if (err) {
      setError(err)
      return
    }
    onGuardado()
  }

  async function eliminar() {
    if (!tipoProceso) return
    const ok = window.confirm(
      `¿Eliminar el proceso "${tipoProceso.nombre}"? Los procesos ya cargados ` +
        `en la matriz y en los proyectos no se ven afectados, pero no vas a ` +
        `poder elegirlo para nuevos.`,
    )
    if (!ok) return
    setGuardando(true)
    const { error: err } = await eliminarTipoProceso(tipoProceso.id)
    setGuardando(false)
    if (err) {
      setError(err)
      return
    }
    onGuardado()
  }

  // Opciones ordenadas alfabéticamente para las listas.
  const opcionesMaquinas = maquinas
    .slice()
    .sort((a, b) => a.nombre.localeCompare(b.nombre))
    .map((m) => ({ id: m.id, label: m.nombre }))
  const personalActivo = personal
    .filter((p) => p.activo)
    .slice()
    .sort((a, b) => nombrePersonal(a).localeCompare(nombrePersonal(b)))
  const opcionesSuplentes = personalActivo.map((p) => ({
    id: p.id,
    label: nombrePersonal(p),
  }))

  return (
    <div className="pf-modal-fondo" onClick={onCancelar}>
      <div className="rec-modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="pf-modal-titulo">
          {esEditar ? 'Editar proceso' : 'Nuevo proceso'}
        </h3>

        <label className="empresa-campo">
          Nombre del proceso *
          <input
            className="empresa-input"
            placeholder="Ej. Torneado"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            autoFocus
          />
        </label>

        <label className="filtro-check rec-check">
          <input
            type="checkbox"
            checked={llevaMaquina}
            onChange={(e) => setLlevaMaquina(e.target.checked)}
          />
          <span>
            <strong>Este proceso se hace en una máquina</strong> — si lo tildás,
            el operario lo define la máquina (Activos &gt; Máquinas). Si no,
            definí el operario acá abajo.
          </span>
        </label>

        {llevaMaquina ? (
          <div className="empresa-campo">
            <span className="pf-label">Máquinas donde se realiza</span>
            <ChecklistColumnas
              opciones={opcionesMaquinas}
              seleccionados={maquinaIds}
              onToggle={toggleMaquina}
              vacio="No hay máquinas cargadas todavía."
            />
            <span className="pf-ayuda">
              Marcá las máquinas que pueden hacer este proceso. Se refleja en
              Activos &gt; Máquinas.
            </span>
          </div>
        ) : (
          <>
            <label className="empresa-campo">
              Operario ideal
              <select
                className="empresa-input"
                value={operarioIdealId ?? ''}
                onChange={(e) =>
                  setOperarioIdealId(
                    e.target.value ? Number(e.target.value) : null,
                  )
                }
              >
                <option value="">— sin operario —</option>
                {personalActivo.map((p) => (
                  <option key={p.id} value={p.id}>
                    {nombrePersonal(p)}
                  </option>
                ))}
              </select>
            </label>
            <div className="empresa-campo">
              <span className="pf-label">Operarios suplentes</span>
              <ChecklistColumnas
                opciones={opcionesSuplentes}
                seleccionados={suplenteIds}
                onToggle={toggleSuplente}
                vacio="No hay personal cargado todavía."
              />
            </div>
          </>
        )}

        {error && <p className="empresa-form-error">{error}</p>}

        <div className="pf-acciones">
          <button
            type="button"
            className="empresa-boton-secundario"
            onClick={onCancelar}
          >
            Cancelar
          </button>
          {esEditar && (
            <button
              type="button"
              className="empresa-boton-peligro"
              onClick={eliminar}
              disabled={guardando}
            >
              Eliminar
            </button>
          )}
          <button
            type="button"
            className="empresa-boton"
            onClick={guardar}
            disabled={guardando}
          >
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ModalProceso
