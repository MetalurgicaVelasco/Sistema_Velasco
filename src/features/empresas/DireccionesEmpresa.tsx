import { useState, useEffect } from 'react'
import { supabase } from '../../shared/lib/supabaseClient'
import Modal from '../../shared/components/Modal'
import MenuContextual from '../../shared/components/MenuContextual'
import ModalNuevaDireccion from './ModalNuevaDireccion'
import {
  CamposDireccion,
  direccionAForm,
  formAGuardarDireccion,
  guardarCpLocalidadSiHace,
  ubicacionTexto,
  FORM_VACIO_DIRECCION,
} from './direccionForm'
import type { Direccion, DireccionForm } from './direccionForm'

function DireccionesEmpresa({ empresaId }: { empresaId: number }) {
  const [direcciones, setDirecciones] = useState<Direccion[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [mostrarNuevo, setMostrarNuevo] = useState(false)

  const [direccionEditando, setDireccionEditando] = useState<Direccion | null>(
    null,
  )
  const [formEdit, setFormEdit] = useState<DireccionForm>(FORM_VACIO_DIRECCION)
  const [guardandoEdit, setGuardandoEdit] = useState(false)
  const [errorEdit, setErrorEdit] = useState<string | null>(null)

  const [direccionBorrando, setDireccionBorrando] = useState<Direccion | null>(
    null,
  )
  const [borrando, setBorrando] = useState(false)
  const [errorBorrar, setErrorBorrar] = useState<string | null>(null)

  async function cargarDirecciones() {
    setCargando(true)
    setError(null)
    const { data, error } = await supabase
      .from('empresa_direcciones')
      .select(
        'id, tipo, calle, numero, piso, depto, observaciones, localidad_id, localidades ( nombre, codigo_postal, provincias ( nombre ) )',
      )
      .eq('empresa_id', empresaId)
      .order('id')
    if (error) {
      setError('No se pudieron cargar las direcciones.')
      setCargando(false)
      return
    }
    setDirecciones((data as unknown as Direccion[]) ?? [])
    setCargando(false)
  }

  useEffect(() => {
    cargarDirecciones()
  }, [empresaId])

  function abrirEdicion(d: Direccion) {
    setDireccionEditando(d)
    setFormEdit(direccionAForm(d))
    setErrorEdit(null)
  }

  async function guardarEdicion() {
    if (!direccionEditando) return
    setErrorEdit(null)
    if (!formEdit.localidadId) {
      setErrorEdit('Elegí una localidad.')
      return
    }
    setGuardandoEdit(true)
    await guardarCpLocalidadSiHace(formEdit)
    const { error } = await supabase
      .from('empresa_direcciones')
      .update(formAGuardarDireccion(formEdit))
      .eq('id', direccionEditando.id)
    setGuardandoEdit(false)
    if (error) {
      setErrorEdit('No se pudieron guardar los cambios.')
      return
    }
    setDireccionEditando(null)
    cargarDirecciones()
  }

  async function confirmarBorrado() {
    if (!direccionBorrando) return
    setErrorBorrar(null)
    setBorrando(true)
    const { error } = await supabase
      .from('empresa_direcciones')
      .delete()
      .eq('id', direccionBorrando.id)
    setBorrando(false)
    if (error) {
      setErrorBorrar('No se pudo borrar la dirección.')
      return
    }
    setDireccionBorrando(null)
    cargarDirecciones()
  }

  return (
    <div className="subtabla">
      <MenuContextual
        items={[{ label: 'Nueva dirección', onSelect: () => setMostrarNuevo(true) }]}
      >
      {cargando ? (
        <div className="empresas-estado">Cargando direcciones…</div>
      ) : error ? (
        <div className="empresas-estado">{error}</div>
      ) : direcciones.length === 0 ? (
        <p className="empresas-vacio">
          Esta empresa no tiene direcciones cargadas.
        </p>
      ) : (
        <table className="tabla">
          <thead>
            <tr>
              <th>Tipo</th>
              <th>Calle</th>
              <th>Nº</th>
              <th>Localidad</th>
              <th>CP</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {direcciones.map((d) => (
              <tr key={d.id} className="tabla-fila">
                <td>{d.tipo ?? '—'}</td>
                <td>{d.calle ?? '—'}</td>
                <td>{d.numero ?? '—'}</td>
                <td>{ubicacionTexto(d)}</td>
                <td>{d.localidades?.codigo_postal ?? '—'}</td>
                <td className="tabla-acciones">
                  <button
                    type="button"
                    className="empresas-editar"
                    onClick={() => abrirEdicion(d)}
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    className="empresas-borrar"
                    onClick={() => {
                      setDireccionBorrando(d)
                      setErrorBorrar(null)
                    }}
                  >
                    Borrar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      </MenuContextual>

      {/* Modal: nueva dirección (componente reutilizable) */}
      {mostrarNuevo && (
        <ModalNuevaDireccion
          empresaId={empresaId}
          onCerrar={() => setMostrarNuevo(false)}
          onCreada={() => {
            setMostrarNuevo(false)
            cargarDirecciones()
          }}
        />
      )}

      {/* Modal: editar dirección */}
      {direccionEditando && (
        <Modal
          titulo="Editar dirección"
          onCerrar={() => setDireccionEditando(null)}
        >
          <div className="empresa-form-modal">
            <CamposDireccion valor={formEdit} setValor={setFormEdit} />
            {errorEdit && <p className="empresa-form-error">{errorEdit}</p>}
            <div className="empresa-modal-acciones">
              <button
                type="button"
                className="empresa-boton-secundario"
                onClick={() => setDireccionEditando(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="empresa-boton"
                onClick={guardarEdicion}
                disabled={guardandoEdit}
              >
                {guardandoEdit ? 'Guardando…' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal: borrar dirección */}
      {direccionBorrando && (
        <Modal
          titulo="Borrar dirección"
          onCerrar={() => setDireccionBorrando(null)}
        >
          <div className="empresa-form-modal">
            <p>¿Seguro que querés borrar esta dirección? No se puede deshacer.</p>
            {errorBorrar && <p className="empresa-form-error">{errorBorrar}</p>}
            <div className="empresa-modal-acciones">
              <button
                type="button"
                className="empresa-boton-secundario"
                onClick={() => setDireccionBorrando(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="empresa-boton-peligro"
                onClick={confirmarBorrado}
                disabled={borrando}
              >
                {borrando ? 'Borrando…' : 'Borrar'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

export default DireccionesEmpresa
