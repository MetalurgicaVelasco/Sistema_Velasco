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

// Pestañas de cada franja (id interno + etiqueta visible).
const TABS_DETALLE = [
  { id: 'general', label: 'General' },
  { id: 'contactos', label: 'Contactos' },
  { id: 'direcciones', label: 'Direcciones' },
  { id: 'transportes', label: 'Transportes' },
]

const TABS_ENLAZADOS = [
  { id: 'proyectos', label: 'Proyectos' },
  { id: 'pedidos', label: 'Pedidos' },
  { id: 'facturas', label: 'Facturas' },
  { id: 'remitos', label: 'Remitos' },
  { id: 'ordenes-compra', label: 'Órdenes de compra' },
  { id: 'recibos', label: 'Recibos' },
  { id: 'pagos', label: 'Pagos' },
]

function rolesTexto(e: Empresa): string {
  const r: string[] = []
  if (e.es_cliente) r.push('Cliente')
  if (e.es_proveedor) r.push('Proveedor')
  if (e.es_transporte) r.push('Transporte')
  return r.join(', ') || '—'
}

function Empresas() {
  // --- Listado ---
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // --- Selección ---
  const [seleccionadaId, setSeleccionadaId] = useState<number | null>(null)
  const empresaSeleccionada =
    empresas.find((e) => e.id === seleccionadaId) ?? null

  // --- Pestañas activas ---
  const [tabDetalle, setTabDetalle] = useState('general')
  const [tabEnlazados, setTabEnlazados] = useState('proyectos')

  // --- Modal "Nueva empresa" ---
  const [mostrarNuevo, setMostrarNuevo] = useState(false)
  const [nombre, setNombre] = useState('')
  const [codigo, setCodigo] = useState('')
  const [cuit, setCuit] = useState('')
  const [esCliente, setEsCliente] = useState(false)
  const [esProveedor, setEsProveedor] = useState(false)
  const [esTransporte, setEsTransporte] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [errorForm, setErrorForm] = useState<string | null>(null)

  // --- Modal edición ---
  const [empresaEditando, setEmpresaEditando] = useState<Empresa | null>(null)
  const [editNombre, setEditNombre] = useState('')
  const [editCodigo, setEditCodigo] = useState('')
  const [editCuit, setEditCuit] = useState('')
  const [editEsCliente, setEditEsCliente] = useState(false)
  const [editEsProveedor, setEditEsProveedor] = useState(false)
  const [editEsTransporte, setEditEsTransporte] = useState(false)
  const [guardandoEdit, setGuardandoEdit] = useState(false)
  const [errorEdit, setErrorEdit] = useState<string | null>(null)

  // --- Modal borrado ---
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

  function abrirNuevo() {
    setNombre('')
    setCodigo('')
    setCuit('')
    setEsCliente(false)
    setEsProveedor(false)
    setEsTransporte(false)
    setErrorForm(null)
    setMostrarNuevo(true)
  }

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
    setMostrarNuevo(false)
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
    const { error } = await supabase
      .from('empresas')
      .delete()
      .eq('id', empresaBorrando.id)
    setBorrando(false)
    if (error) {
      setErrorBorrar('No se pudo borrar la empresa.')
      return
    }
    if (seleccionadaId === empresaBorrando.id) setSeleccionadaId(null)
    setEmpresaBorrando(null)
    cargarEmpresas()
  }

  return (
    <div className="empresas-franjas">
      {/* ---------- Franja 1: Filtros (por ahora, solo crear) ---------- */}
      <div className="franja franja-filtros">
        <div className="franja-filtros-barra">
          <button type="button" className="empresa-boton" onClick={abrirNuevo}>
            + Nueva empresa
          </button>
        </div>
      </div>

      {/* ---------- Franja 2: Lista ---------- */}
      <div className="franja franja-lista">
        {cargando ? (
          <div className="empresas-estado">Cargando empresas…</div>
        ) : error ? (
          <div className="empresas-estado">{error}</div>
        ) : empresas.length === 0 ? (
          <p className="empresas-vacio">Todavía no hay empresas cargadas.</p>
        ) : (
          <table className="tabla">
            <thead>
              <tr>
                <th>Código</th>
                <th>Nombre</th>
                <th>CUIT</th>
                <th>Roles</th>
              </tr>
            </thead>
            <tbody>
              {empresas.map((empresa) => (
                <tr
                  key={empresa.id}
                  className={
                    'tabla-fila' +
                    (empresa.id === seleccionadaId ? ' seleccionada' : '')
                  }
                  onClick={() => setSeleccionadaId(empresa.id)}
                >
                  <td>{empresa.codigo ?? '—'}</td>
                  <td>{empresa.nombre}</td>
                  <td>{empresa.cuit ?? '—'}</td>
                  <td>{rolesTexto(empresa)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ---------- Franja 3: Detalle (pestañas, "General" = datos) ---------- */}
      <div className="franja franja-detalle">
        {empresaSeleccionada ? (
          <>
            <div className="enlazados-tabs">
              {TABS_DETALLE.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={
                    'enlazados-tab' + (tab.id === tabDetalle ? ' activa' : '')
                  }
                  onClick={() => setTabDetalle(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="enlazados-contenido">
              {tabDetalle === 'general' ? (
                <div className="detalle">
                  <div className="detalle-header">
                    <h3 className="detalle-titulo">
                      {empresaSeleccionada.nombre}
                    </h3>
                    <div className="detalle-acciones">
                      <button
                        type="button"
                        className="empresas-editar"
                        onClick={() => abrirEdicion(empresaSeleccionada)}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className="empresas-borrar"
                        onClick={() => {
                          setEmpresaBorrando(empresaSeleccionada)
                          setErrorBorrar(null)
                        }}
                      >
                        Borrar
                      </button>
                    </div>
                  </div>
                  <div className="detalle-campos">
                    <div>
                      <span className="detalle-label">Código</span>
                      <span>{empresaSeleccionada.codigo ?? '—'}</span>
                    </div>
                    <div>
                      <span className="detalle-label">CUIT</span>
                      <span>{empresaSeleccionada.cuit ?? '—'}</span>
                    </div>
                    <div>
                      <span className="detalle-label">Roles</span>
                      <span>{rolesTexto(empresaSeleccionada)}</span>
                    </div>
                  </div>
                </div>
              ) : (
                'Esta sección se construye más adelante.'
              )}
            </div>
          </>
        ) : (
          <div className="empresas-estado">
            Seleccioná una empresa para ver su detalle.
          </div>
        )}
      </div>

      {/* ---------- Franja 4: Enlazados (comerciales) ---------- */}
      <div className="franja franja-enlazados">
        <div className="enlazados-tabs">
          {TABS_ENLAZADOS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={
                'enlazados-tab' + (tab.id === tabEnlazados ? ' activa' : '')
              }
              onClick={() => setTabEnlazados(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="enlazados-contenido">
          {empresaSeleccionada
            ? 'Esta sección se construye más adelante.'
            : 'Seleccioná una empresa.'}
        </div>
      </div>

      {/* ---------- Modal: Nueva empresa ---------- */}
      {mostrarNuevo && (
        <Modal titulo="Nueva empresa" onCerrar={() => setMostrarNuevo(false)}>
          <div className="empresa-form-modal">
            <label className="empresa-campo">
              Nombre *
              <input
                className="empresa-input"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
              />
            </label>
            <label className="empresa-campo">
              Código
              <input
                className="empresa-input"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
              />
            </label>
            <label className="empresa-campo">
              CUIT
              <input
                className="empresa-input"
                value={cuit}
                onChange={(e) => setCuit(e.target.value)}
              />
            </label>
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
            <div className="empresa-modal-acciones">
              <button
                type="button"
                className="empresa-boton-secundario"
                onClick={() => setMostrarNuevo(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="empresa-boton"
                onClick={crearEmpresa}
                disabled={guardando}
              >
                {guardando ? 'Guardando…' : 'Crear empresa'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ---------- Modal: Editar ---------- */}
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

      {/* ---------- Modal: Borrar ---------- */}
      {empresaBorrando && (
        <Modal titulo="Borrar empresa" onCerrar={() => setEmpresaBorrando(null)}>
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
