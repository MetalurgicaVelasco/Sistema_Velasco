import { useState } from 'react'
import { supabase } from '../../shared/lib/supabaseClient'
import CajaFoto from './CajaFoto'
import SelectorConAlta from '../../shared/components/SelectorConAlta'
import { ESTADOS_ELEMENTO } from './elementoTipos'
import type { ElementoDraft, Material } from './elementoTipos'
import { tipoLabel } from './elementosApi'

const BUCKET = 'proyectos-fotos'

// Modal para cargar/editar un item. Trabaja sobre una copia del borrador y,
// al guardar, se la devuelve al padre (que recién persiste al guardar el
// proyecto entero). La foto se retiene como archivo, no se sube acá.
function ModalItem({
  draft,
  materiales,
  onAgregarMaterial,
  onGuardar,
  onCancelar,
}: {
  draft: ElementoDraft
  materiales: Material[]
  onAgregarMaterial: (nombre: string) => Promise<Material | null>
  onGuardar: (d: ElementoDraft) => void | Promise<void>
  onCancelar: () => void
}) {
  const [d, setD] = useState<ElementoDraft>(draft)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  const previewUrl =
    d.fotoPreview ??
    (d.fotoUrl
      ? supabase.storage.from(BUCKET).getPublicUrl(d.fotoUrl).data.publicUrl
      : null)

  function elegirFoto(file: File) {
    if (d.fotoPreview) URL.revokeObjectURL(d.fotoPreview)
    setD({ ...d, fotoArchivo: file, fotoPreview: URL.createObjectURL(file) })
  }

  function quitarFoto() {
    if (d.fotoPreview) URL.revokeObjectURL(d.fotoPreview)
    setD({ ...d, fotoArchivo: null, fotoPreview: null, fotoUrl: null })
  }

  async function guardar() {
    if (guardando) return
    if (d.descripcion.trim() === '') {
      setErrorMsg('La descripción es obligatoria.')
      return
    }
    setGuardando(true)
    try {
      await onGuardar(d)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="pf-modal-fondo" onClick={onCancelar}>
      <div className="item-modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="pf-modal-titulo">
          {d.dbId == null
            ? 'Nuevo ' + tipoLabel(d.tipo)
            : 'Editar ' + tipoLabel(d.tipo)}
        </h3>

        {/* Tipo del elemento */}
        <label className="empresa-campo">
          Tipo
          <select
            className="empresa-input"
            value={d.tipo}
            onChange={(e) => setD({ ...d, tipo: e.target.value })}
          >
            <option value="conjunto">Conjunto</option>
            <option value="subconjunto">Subconjunto</option>
            <option value="componente">Componente</option>
          </select>
        </label>

        {/* Descripción + Cantidad */}
        <div className="empresa-campo-fila">
          <label className="empresa-campo pf-campo-ancho">
            Descripción *
            <textarea
              className="empresa-input"
              rows={2}
              placeholder="Ej. Eje principal"
              value={d.descripcion}
              onChange={(e) => setD({ ...d, descripcion: e.target.value })}
            />
          </label>
          <label className="empresa-campo">
            Cantidad
            <input
              type="number"
              className="empresa-input"
              value={d.cantidad}
              onChange={(e) => setD({ ...d, cantidad: e.target.value })}
            />
          </label>
        </div>

        {/* Estado del item (resaltado) */}
        <label className="empresa-campo item-estado-box">
          Estado del item
          <select
            className="empresa-input"
            value={d.estado}
            onChange={(e) => setD({ ...d, estado: e.target.value })}
          >
            {ESTADOS_ELEMENTO.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>

        {/* Código del cliente + Material */}
        <div className="empresa-campo-fila">
          <label className="empresa-campo">
            Código del cliente
            <input
              className="empresa-input"
              placeholder="Ej. 4517-AB"
              value={d.codigoCliente}
              onChange={(e) => setD({ ...d, codigoCliente: e.target.value })}
            />
          </label>
          <label className="empresa-campo">
            Material
            <SelectorConAlta
              valor={d.materialId}
              opciones={materiales}
              onCambiar={(id) => setD({ ...d, materialId: id })}
              onAgregar={onAgregarMaterial}
              placeholderNuevo="Nuevo material"
            />
          </label>
        </div>

        {/* Presentación MP + Fecha fin estipulada */}
        <div className="empresa-campo-fila">
          <label className="empresa-campo">
            Presentación materia prima
            <input
              className="empresa-input"
              placeholder="Ej. Ø290 x 1 1/2 pulg"
              value={d.presentacionMatPrima}
              onChange={(e) =>
                setD({ ...d, presentacionMatPrima: e.target.value })
              }
            />
          </label>
          <label className="empresa-campo">
            Fecha de fin estipulada
            <input
              type="date"
              className="empresa-input"
              value={d.fechaFinEstipulada}
              onChange={(e) =>
                setD({ ...d, fechaFinEstipulada: e.target.value })
              }
            />
          </label>
        </div>

        {/* Flags */}
        <label className="filtro-check item-check">
          <input
            type="checkbox"
            checked={d.esRetrabajo}
            onChange={(e) => setD({ ...d, esRetrabajo: e.target.checked })}
          />
          <span>
            <strong>Es retrabajo</strong> — trabajo correctivo. No aparece en
            notas de envío ni remitos.
          </span>
        </label>
        <label className="filtro-check item-check">
          <input
            type="checkbox"
            checked={d.esDispositivo}
            onChange={(e) => setD({ ...d, esDispositivo: e.target.checked })}
          />
          <span>
            <strong>Es dispositivo o pieza auxiliar</strong> — pieza necesaria
            para fabricar el trabajo (ej. una mordaza). No aparece en notas de
            envío ni remitos.
          </span>
        </label>

        {/* Foto del item */}
        <div className="empresa-campo">
          <span className="pf-label">Foto del item (opcional)</span>
          <CajaFoto
            previewUrl={previewUrl}
            onElegir={elegirFoto}
            onQuitar={quitarFoto}
          />
          <span className="pf-ayuda">Si la dejás vacía, se usa la del proyecto.</span>
        </div>

        {errorMsg && <p className="empresa-form-error">{errorMsg}</p>}

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
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ModalItem
