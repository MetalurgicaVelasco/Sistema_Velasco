import { useState } from 'react'
import { supabase } from '../../shared/lib/supabaseClient'
import Modal from '../../shared/components/Modal'
// CajaFoto vive por ahora en produccion; idealmente va a shared (pendiente de
// una pasada de orden). Se importa cruzado para no mover archivos en este paso.
import CajaFoto from '../produccion/CajaFoto'
import ChecklistColumnas from '../../shared/components/ChecklistColumnas'
import { nombrePersonal } from '../../shared/types/recursos'
import type { Maquina, TipoProceso, Personal } from '../../shared/types/recursos'
import { guardarMaquina } from '../../shared/lib/recursosApi'

const BUCKET = 'proyectos-fotos'

// Modal para crear o editar una máquina. Persiste directo; al guardar avisa al
// padre para que recargue y cierre. La foto se retiene como archivo y la sube
// la capa de datos al guardar (necesita el id de la máquina).
function ModalMaquina({
  maquina,
  tiposProceso,
  personal,
  onGuardado,
  onCancelar,
}: {
  maquina: Maquina | null
  tiposProceso: TipoProceso[]
  personal: Personal[]
  onGuardado: () => void
  onCancelar: () => void
}) {
  const esEditar = maquina != null

  const [nombre, setNombre] = useState(maquina?.nombre ?? '')
  const [fotoUrl, setFotoUrl] = useState<string | null>(maquina?.fotoUrl ?? null)
  const [fotoArchivo, setFotoArchivo] = useState<File | null>(null)
  const [fotoPreview, setFotoPreview] = useState<string | null>(null)
  const [tipoProcesoIds, setTipoProcesoIds] = useState<number[]>(
    maquina?.tipoProcesoIds ?? [],
  )
  const [operarioIdealId, setOperarioIdealId] = useState<number | null>(
    maquina?.operarioIdealId ?? null,
  )
  const [suplenteIds, setSuplenteIds] = useState<number[]>(
    maquina?.suplenteIds ?? [],
  )
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  const previewUrl =
    fotoPreview ??
    (fotoUrl
      ? supabase.storage.from(BUCKET).getPublicUrl(fotoUrl).data.publicUrl
      : null)

  function elegirFoto(file: File) {
    if (fotoPreview) URL.revokeObjectURL(fotoPreview)
    setFotoArchivo(file)
    setFotoPreview(URL.createObjectURL(file))
  }
  function quitarFoto() {
    if (fotoPreview) URL.revokeObjectURL(fotoPreview)
    setFotoArchivo(null)
    setFotoPreview(null)
    setFotoUrl(null)
  }

  function toggleProceso(id: number) {
    setTipoProcesoIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }
  function toggleSuplente(id: number) {
    setSuplenteIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  async function guardar() {
    if (nombre.trim() === '') {
      setError('El nombre es obligatorio.')
      return
    }
    setGuardando(true)
    const { error: err } = await guardarMaquina({
      id: maquina?.id ?? null,
      nombre,
      fotoUrl,
      fotoArchivo,
      tipoProcesoIds,
      operarioIdealId,
      suplenteIds,
    })
    setGuardando(false)
    if (err) {
      setError(err)
      return
    }
    onGuardado()
  }

  const opcionesProcesos = tiposProceso
    .slice()
    .sort((a, b) => a.nombre.localeCompare(b.nombre))
    .map((t) => ({ id: t.id, label: t.nombre }))
  const personalActivo = personal
    .filter((p) => p.activo)
    .slice()
    .sort((a, b) => nombrePersonal(a).localeCompare(nombrePersonal(b)))
  const opcionesSuplentes = personalActivo.map((p) => ({
    id: p.id,
    label: nombrePersonal(p),
  }))

  return (
    <Modal titulo={esEditar ? 'Editar máquina' : 'Nueva máquina'} onCerrar={onCancelar} ancho={620}>

        <label className="empresa-campo">
          Nombre *
          <input
            className="empresa-input"
            placeholder="Ej. VF3-YT"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            autoFocus
          />
        </label>

        <div className="empresa-campo">
          <span className="pf-label">Foto (opcional)</span>
          <CajaFoto
            previewUrl={previewUrl}
            onElegir={elegirFoto}
            onQuitar={quitarFoto}
          />
        </div>

        <div className="empresa-campo">
          <span className="pf-label">Procesos que realiza</span>
          <ChecklistColumnas
            opciones={opcionesProcesos}
            seleccionados={tipoProcesoIds}
            onToggle={toggleProceso}
            vacio="No hay procesos cargados todavía."
          />
          <span className="pf-ayuda">
            Si no marcás ninguno, la máquina aparece como opción en todos los
            procesos (no se filtra).
          </span>
        </div>

        <label className="empresa-campo">
          Operario ideal
          <select
            className="empresa-input"
            value={operarioIdealId ?? ''}
            onChange={(e) =>
              setOperarioIdealId(e.target.value ? Number(e.target.value) : null)
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
          <span className="pf-ayuda">
            Operarios que también pueden usar esta máquina.
          </span>
        </div>

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
            {guardando ? 'Guardando…' : esEditar ? 'Guardar' : 'Crear'}
          </button>
        </div>
    </Modal>
  )
}

export default ModalMaquina
