import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../shared/lib/supabaseClient'
import Modal from '../../shared/components/Modal'
import MenuContextual from '../../shared/components/MenuContextual'
import TablaConfigurable, { type ColumnaDef } from '../../shared/components/TablaConfigurable'
import PanelColumnas from '../../shared/components/PanelColumnas'
import { useConfigTabla } from '../../shared/hooks/useConfigTabla'
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
  const {
    columnas: configCols,
    setColumnas: setConfigCols,
    orden,
    setOrden,
  } = useConfigTabla('empresas.direcciones.columnas', [
    { id: 'tipo', visible: true, ancho: 120 },
    { id: 'calle', visible: true, ancho: 220 },
    { id: 'numero', visible: true, ancho: 80 },
    { id: 'localidad', visible: true, ancho: 220 },
    { id: 'cp', visible: true, ancho: 90 },
  ])
  const [panelCols, setPanelCols] = useState(false)

  const colsDirecciones: ColumnaDef<Direccion>[] = useMemo(
    () => [
      { id: 'tipo', titulo: 'Tipo', tipo: 'texto', valor: (d) => d.tipo },
      { id: 'calle', titulo: 'Calle', tipo: 'texto', valor: (d) => d.calle },
      { id: 'numero', titulo: 'Nº', tipo: 'texto', valor: (d) => d.numero },
      { id: 'localidad', titulo: 'Localidad', tipo: 'texto', valor: (d) => ubicacionTexto(d) },
      { id: 'cp', titulo: 'CP', tipo: 'texto', valor: (d) => d.localidades?.codigo_postal ?? '' },
    ],
    [],
  )
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
        items={[
          { label: 'Nueva dirección', onSelect: () => setMostrarNuevo(true) },
          { label: 'Columnas…', onSelect: () => setPanelCols(true) },
        ]}
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
        <TablaConfigurable<Direccion>
          columnas={colsDirecciones}
          config={configCols}
          onConfig={setConfigCols}
          filas={direcciones}
          orden={orden}
          onOrden={setOrden}
          filaKey={(d) => d.id}
          acciones={(d) => (
            <>
              <button type="button" className="empresas-editar" onClick={() => abrirEdicion(d)}>
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
            </>
          )}
        />
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

      {panelCols && (
        <PanelColumnas
          columnas={colsDirecciones}
          config={configCols}
          onConfig={setConfigCols}
          onCerrar={() => setPanelCols(false)}
        />
      )}
    </div>
  )
}

export default DireccionesEmpresa
