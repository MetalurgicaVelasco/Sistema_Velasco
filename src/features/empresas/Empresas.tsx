import { useState, useEffect } from 'react'
import { supabase } from '../../shared/lib/supabaseClient'
import Modal from '../../shared/components/Modal'

type Empresa = {
  id: number
  nombre: string
  codigo: string | null
  cuit: string | null
  es_cliente: boolean
  es_proveedor: boolean
  es_transporte: boolean
}

function Empresas() {
  // --- Listado ---
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // --- Formulario de creación ---
  const [nombre, setNombre] = useState('')
  const [codigo, setCodigo] = useState('')
  const [cuit, setCuit] = useState('')
  const [esCliente, setEsCliente] = useState(false)
  const [esProveedor, setEsProveedor] = useState(false)
  const [esTransporte, setEsTransporte] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [errorForm, setErrorForm] = useState<string | null>(null)

  // --- Edición (modal) ---
  const [empresaEditando, setEmpresaEditando] = useState<Empresa | null>(null)
  const [editNombre, setEditNombre] = useState('')
  const [editCodigo, setEditCodigo] = useState('')
  const [editCuit, setEditCuit] = useState('')
  const [editEsCliente, setEditEsCliente] = useState(false)
  const [editEsProveedor, setEditEsProveedor] = useState(false)
  const [editEsTransporte, setEditEsTransporte] = useState(false)
  const [guardandoEdit, setGuardandoEdit] = useState(false)
  const [errorEdit, setErrorEdit] = useState<string | null>(null)

  // --- Borrado (modal de confirmación) ---
  const [empresaBorrando, setEmpresaBorrando] = useState<Empresa | null>(null)
  const [borrando, setBorrando] = useState(false)
  const [errorBorrar, setErrorBorrar] = useState<string | null>(null)

  async function cargarEmpresas() {
    setCargando(true)
    setError(null)

    const { data, error } = await supabase
      .from('empresas')
      .select('id, nombre, codigo, cuit, es_cliente, es_proveedor, es_transporte')
      .order('nombre')

    if (error) {
      setError('No se pudieron cargar las empresas.')
      setCargando(false)
      return
    }

    setEmpresas(data ?? [])
    setCargando(false)
  }

  useEffect(() => {
    cargarEmpresas()
  }, [])

  async function crearEmpresa() {
    setErrorForm(null)

    if (nombre.trim() === '') {
      setErrorForm('El nombre es obligatorio.')
      return
    }

    setGuardando(true)

    const { error } = await supabase.from('empresas').insert({
      nombre: nombre.trim(),
      codigo: codigo.trim() || null,
      cuit: cuit.trim() || null,
      es_cliente: esCliente,
      es_proveedor: esProveedor,
      es_transporte: esTransporte,
    })

    setGuardando(false)

    if (error) {
      setErrorForm('No se pudo crear la empresa.')
      return
    }

    setNombre('')
    setCodigo('')
    setCuit('')
    setEsCliente(false)
    setEsProveedor(false)
    setEsTransporte(false)
    cargarEmpresas()
  }

  function abrirEdicion(empresa: Empresa) {
    setEmpresaEditando(empresa)
    setEditNombre(empresa.nombre)
    setEditCodigo(empresa.codigo ?? '')
    setEditCuit(empresa.cuit ?? '')
    setEditEsCliente(empresa.es_cliente)
    setEditEsProveedor(empresa.es_proveedor)
    setEditEsTransporte(empresa.es_transporte)
    setErrorEdit(null)
  }

  async function guardarEdicion() {
    if (!empresaEditando) return
    setErrorEdit(null)

    if (editNombre.trim() === '') {
      setErrorEdit('El nombre es obligatorio.')
      return
    }

    setGuardandoEdit(true)

    const { error } = await supabase
      .from('empresas')
      .update({
        nombre: editNombre.trim(),
        codigo: editCodigo.trim() || null,
        cuit: editCuit.trim() || null,
        es_cliente: editEsCliente,
        es_proveedor: editEsProveedor,
        es_transporte: editEsTransporte,
      })
      .eq('id', empresaEditando.id)

    setGuardandoEdit(false)

    if (error) {
      setErrorEdit('No se pudieron guardar los cambios.')
      return
    }

    setEmpresaEditando(null)
    cargarEmpresas()
  }

  async function confirmarBorrado() {
    if (!empresaBorrando) return
    setErrorBorrar(null)
    setBorrando(true)

    // .eq('id', ...) -> borra SOLO esta empresa.
    const { error } = await supabase
      .from('empresas')
      .delete()
      .eq('id', empresaBorrando.id)

    setBorrando(false)

    if (error) {
      setErrorBorrar('No se pudo borrar la empresa.')
      return
    }

    setEmpresaBorrando(null) // cierra el modal
    cargarEmpresas()
  }

  return (
    <div className="empresas">
      <h2 className="empresas-titulo">Empresas</h2>

      {/* Formulario de creación */}
      <div className="empresa-form">
        <input
          className="empresa-input"
          placeholder="Nombre *"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
        />
        <input
          className="empresa-input"
          placeholder="Código"
          value={codigo}
          onChange={(e) => setCodigo(e.target.value)}
        />
        <input
          className="empresa-input"
          placeholder="CUIT"
          value={cuit}
          onChange={(e) => setCuit(e.target.value)}
        />

        <div className="empresa-roles">
          <label>
            <input
              type="checkbox"
              checked={esCliente}
              onChange={(e) => setEsCliente(e.target.checked)}
            />
            Cliente
          </label>
          <label>
            <input
              type="checkbox"
              checked={esProveedor}
              onChange={(e) => setEsProveedor(e.target.checked)}
            />
            Proveedor
          </label>
          <label>
            <input
              type="checkbox"
              checked={esTransporte}
              onChange={(e) => setEsTransporte(e.target.checked)}
            />
            Transporte
          </label>
        </div>

        {errorForm && <p className="empresa-form-error">{errorForm}</p>}

        <button
          type="button"
          className="empresa-boton"
          onClick={crearEmpresa}
          disabled={guardando}
        >
          {guardando ? 'Guardando…' : 'Crear empresa'}
        </button>
      </div>

      {/* Listado */}
      {cargando ? (
        <div className="empresas-estado">Cargando empresas…</div>
      ) : error ? (
        <div className="empresas-estado">{error}</div>
      ) : empresas.length === 0 ? (
        <p className="empresas-vacio">Todavía no hay empresas cargadas.</p>
      ) : (
        <ul className="empresas-lista">
          {empresas.map((empresa) => (
            <li key={empresa.id} className="empresas-item">
              {empresa.codigo && (
                <span className="empresas-codigo">{empresa.codigo}</span>
              )}
              <span className="empresas-nombre">{empresa.nombre}</span>
              <button
                type="button"
                className="empresas-editar"
                onClick={() => abrirEdicion(empresa)}
              >
                Editar
              </button>
              <button
                type="button"
                className="empresas-borrar"
                onClick={() => {
                  setEmpresaBorrando(empresa)
                  setErrorBorrar(null)
                }}
              >
                Borrar
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Modal de edición */}
      {empresaEditando && (
        <Modal
          titulo={`Editar: ${empresaEditando.nombre}`}
          onCerrar={() => setEmpresaEditando(null)}
        >
          <div className="empresa-form-modal">
            <label className="empresa-campo">
              Nombre *
              <input
                className="empresa-input"
                value={editNombre}
                onChange={(e) => setEditNombre(e.target.value)}
              />
            </label>
            <label className="empresa-campo">
              Código
              <input
                className="empresa-input"
                value={editCodigo}
                onChange={(e) => setEditCodigo(e.target.value)}
              />
            </label>
            <label className="empresa-campo">
              CUIT
              <input
                className="empresa-input"
                value={editCuit}
                onChange={(e) => setEditCuit(e.target.value)}
              />
            </label>

            <div className="empresa-roles">
              <label>
                <input
                  type="checkbox"
                  checked={editEsCliente}
                  onChange={(e) => setEditEsCliente(e.target.checked)}
                />
                Cliente
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={editEsProveedor}
                  onChange={(e) => setEditEsProveedor(e.target.checked)}
                />
                Proveedor
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={editEsTransporte}
                  onChange={(e) => setEditEsTransporte(e.target.checked)}
                />
                Transporte
              </label>
            </div>

            {errorEdit && <p className="empresa-form-error">{errorEdit}</p>}

            <div className="empresa-modal-acciones">
              <button
                type="button"
                className="empresa-boton-secundario"
                onClick={() => setEmpresaEditando(null)}
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

      {/* Modal de confirmación de borrado (reutiliza el mismo Modal) */}
      {empresaBorrando && (
        <Modal
          titulo="Borrar empresa"
          onCerrar={() => setEmpresaBorrando(null)}
        >
          <div className="empresa-form-modal">
            <p>
              ¿Seguro que querés borrar <strong>{empresaBorrando.nombre}</strong>?
              Esta acción no se puede deshacer.
            </p>

            {errorBorrar && <p className="empresa-form-error">{errorBorrar}</p>}

            <div className="empresa-modal-acciones">
              <button
                type="button"
                className="empresa-boton-secundario"
                onClick={() => setEmpresaBorrando(null)}
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

export default Empresas
