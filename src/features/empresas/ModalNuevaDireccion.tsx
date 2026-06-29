import { useState } from 'react'
import { supabase } from '../../shared/lib/supabaseClient'
import Modal from '../../shared/components/Modal'
import {
  CamposDireccion,
  FORM_VACIO_DIRECCION,
  formAGuardarDireccion,
  guardarCpLocalidadSiHace,
} from './direccionForm'
import type { Direccion, DireccionForm } from './direccionForm'

// Modal de alta de dirección reutilizable. Lo usan Direcciones (para su
// "+ nueva") y Contactos (para "nueva dirección desde el contacto").
// Avisa la dirección creada por onCreada, para que quien lo abrió la use.
function ModalNuevaDireccion({
  empresaId,
  onCerrar,
  onCreada,
}: {
  empresaId: number
  onCerrar: () => void
  onCreada: (d: Direccion) => void
}) {
  const [form, setForm] = useState<DireccionForm>(FORM_VACIO_DIRECCION)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function crear() {
    setError(null)
    if (!form.localidadId) {
      setError('Elegí una localidad.')
      return
    }
    setGuardando(true)
    await guardarCpLocalidadSiHace(form)
    const { data, error } = await supabase
      .from('empresa_direcciones')
      .insert({ empresa_id: empresaId, ...formAGuardarDireccion(form) })
      .select(
        'id, tipo, calle, numero, piso, depto, observaciones, localidad_id, localidades ( nombre, codigo_postal, provincias ( nombre ) )',
      )
      .single()
    setGuardando(false)
    if (error || !data) {
      setError('No se pudo crear la dirección.')
      return
    }
    onCreada(data as unknown as Direccion)
  }

  return (
    <Modal titulo="Nueva dirección" onCerrar={onCerrar}>
      <div className="empresa-form-modal">
        <CamposDireccion valor={form} setValor={setForm} />
        {error && <p className="empresa-form-error">{error}</p>}
        <div className="empresa-modal-acciones">
          <button
            type="button"
            className="empresa-boton-secundario"
            onClick={onCerrar}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="empresa-boton"
            onClick={crear}
            disabled={guardando}
          >
            {guardando ? 'Guardando…' : 'Crear dirección'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

export default ModalNuevaDireccion
