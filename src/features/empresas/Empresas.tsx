import { useState, useEffect } from 'react'
import { supabase } from '../../shared/lib/supabaseClient'
import { contiene } from '../../shared/lib/texto'
import MenuContextual from '../../shared/components/MenuContextual'
import Modal from '../../shared/components/Modal'
import ContactosEmpresa from './ContactosEmpresa'
import DireccionesEmpresa from './DireccionesEmpresa'
import LogoEmpresa from './LogoEmpresa'

type Empresa = {
  id: number
  nombre: string
  codigo: string | null
  cuit: string | null
  razon_social: string | null
  condicion_iva: string | null
  condicion_iibb: string | null
  numero_iibb: string | null
  es_cliente: boolean
  es_proveedor: boolean
  es_transporte: boolean
  foto_url: string | null
}

type EmpresaForm = {
  nombre: string
  codigo: string
  cuit: string
  razon_social: string
  condicion_iva: string
  condicion_iibb: string
  numero_iibb: string
  es_cliente: boolean
  es_proveedor: boolean
  es_transporte: boolean
}

const FORM_VACIO: EmpresaForm = {
  nombre: '',
  codigo: '',
  cuit: '',
  razon_social: '',
  condicion_iva: '',
  condicion_iibb: '',
  numero_iibb: '',
  es_cliente: false,
  es_proveedor: false,
  es_transporte: false,
}

const CONDICIONES_IVA = [
  'Responsable Inscripto',
  'Monotributista',
  'Exento',
  'Consumidor Final',
  'No Responsable',
  'IVA No Alcanzado',
]

const CONDICIONES_IIBB = [
  'Local',
  'Convenio Multilateral',
  'Exento',
  'No inscripto',
]

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

function empresaAForm(e: Empresa): EmpresaForm {
  return {
    nombre: e.nombre,
    codigo: e.codigo ?? '',
    cuit: e.cuit ?? '',
    razon_social: e.razon_social ?? '',
    condicion_iva: e.condicion_iva ?? '',
    condicion_iibb: e.condicion_iibb ?? '',
    numero_iibb: e.numero_iibb ?? '',
    es_cliente: e.es_cliente,
    es_proveedor: e.es_proveedor,
    es_transporte: e.es_transporte,
  }
}

function formAGuardar(f: EmpresaForm) {
  return {
    nombre: f.nombre.trim(),
    codigo: f.codigo.trim() || null,
    cuit: f.cuit.trim() || null,
    razon_social: f.razon_social.trim() || null,
    condicion_iva: f.condicion_iva || null,
    condicion_iibb: f.condicion_iibb || null,
    numero_iibb: f.numero_iibb.trim() || null,
    es_cliente: f.es_cliente,
    es_proveedor: f.es_proveedor,
    es_transporte: f.es_transporte,
  }
}

// Campos del formulario de empresa (se usan en crear y editar).
function CamposEmpresa({
  valor,
  setValor,
}: {
  valor: EmpresaForm
  setValor: (v: EmpresaForm) => void
}) {
  return (
    <>
      <div className="empresa-campo-fila">
        <label className="empresa-campo">
          Nombre *
          <input
            className="empresa-input"
            value={valor.nombre}
            onChange={(e) => setValor({ ...valor, nombre: e.target.value })}
          />
        </label>
        <label className="empresa-campo empresa-campo-chico">
          Código
          <input
            className="empresa-input"
            value={valor.codigo}
            onChange={(e) => setValor({ ...valor, codigo: e.target.value })}
          />
        </label>
      </div>

      <label className="empresa-campo">
        Razón social
        <input
          className="empresa-input"
          value={valor.razon_social}
          onChange={(e) => setValor({ ...valor, razon_social: e.target.value })}
        />
      </label>

      <div className="empresa-campo-fila">
        <label className="empresa-campo">
          CUIT
          <input
            className="empresa-input"
            value={valor.cuit}
            onChange={(e) => setValor({ ...valor, cuit: e.target.value })}
          />
        </label>
        <label className="empresa-campo">
          Condición IVA
          <select
            className="empresa-input"
            value={valor.condicion_iva}
            onChange={(e) =>
              setValor({ ...valor, condicion_iva: e.target.value })
            }
          >
            <option value="">—</option>
            {CONDICIONES_IVA.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="empresa-campo-fila">
        <label className="empresa-campo">
          Condición IIBB
          <select
            className="empresa-input"
            value={valor.condicion_iibb}
            onChange={(e) =>
              setValor({ ...valor, condicion_iibb: e.target.value })
            }
          >
            <option value="">—</option>
            {CONDICIONES_IIBB.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="empresa-campo">
          Número IIBB
          <input
            className="empresa-input"
            value={valor.numero_iibb}
            onChange={(e) =>
              setValor({ ...valor, numero_iibb: e.target.value })
            }
          />
        </label>
      </div>

      <div className="empresa-roles">
        <label>
          <input
            type="checkbox"
            checked={valor.es_cliente}
            onChange={(e) => setValor({ ...valor, es_cliente: e.target.checked })}
          />
          Cliente
        </label>
        <label>
          <input
            type="checkbox"
            checked={valor.es_proveedor}
            onChange={(e) =>
              setValor({ ...valor, es_proveedor: e.target.checked })
            }
          />
          Proveedor
        </label>
        <label>
          <input
            type="checkbox"
            checked={valor.es_transporte}
            onChange={(e) =>
              setValor({ ...valor, es_transporte: e.target.checked })
            }
          />
          Transporte
        </label>
      </div>
    </>
  )
}

function Empresas() {
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [seleccionadaId, setSeleccionadaId] = useState<number | null>(null)
  const empresaSeleccionada =
    empresas.find((e) => e.id === seleccionadaId) ?? null

  // Filtros (franja 1)
  const [busqueda, setBusqueda] = useState('')
  const [filtroCodigo, setFiltroCodigo] = useState('')
  const [filtroNombre, setFiltroNombre] = useState('')
  const [filtroRazon, setFiltroRazon] = useState('')
  const [filtroApellido, setFiltroApellido] = useState('')
  const [filtroRoles, setFiltroRoles] = useState({
    cliente: false,
    proveedor: false,
    transporte: false,
  })

  // Snapshot de contactos (empresa_id + apellido) para filtrar por apellido.
  const [contactos, setContactos] = useState<
    { empresa_id: number; apellido: string | null }[]
  >([])

  const hayFiltros =
    busqueda.trim() !== '' ||
    filtroCodigo.trim() !== '' ||
    filtroNombre.trim() !== '' ||
    filtroRazon.trim() !== '' ||
    filtroApellido.trim() !== '' ||
    filtroRoles.cliente ||
    filtroRoles.proveedor ||
    filtroRoles.transporte

  function limpiarFiltros() {
    setBusqueda('')
    setFiltroCodigo('')
    setFiltroNombre('')
    setFiltroRazon('')
    setFiltroApellido('')
    setFiltroRoles({ cliente: false, proveedor: false, transporte: false })
  }

  function toggleRol(rol: 'cliente' | 'proveedor' | 'transporte') {
    setFiltroRoles((prev) => ({ ...prev, [rol]: !prev[rol] }))
  }

  // IDs de empresas que tienen un contacto con apellido que matchea.
  // Se calcula una vez (no por empresa) para no recorrer los contactos de más.
  const apellido = filtroApellido.trim()
  const idsPorApellido =
    apellido === ''
      ? null
      : new Set(
          contactos
            .filter((c) => contiene(c.apellido ?? '', apellido))
            .map((c) => c.empresa_id),
        )

  const empresasFiltradas = empresas.filter((e) => {
    // Buscador general: nombre, código o CUIT (sin tildes)
    const texto = busqueda.trim()
    const pasaTexto =
      texto === '' ||
      contiene(e.nombre, texto) ||
      contiene(e.codigo ?? '', texto) ||
      contiene(e.cuit ?? '', texto)

    // Campos por separado (cada uno sobre su columna)
    const pasaCodigo =
      filtroCodigo.trim() === '' || contiene(e.codigo ?? '', filtroCodigo)
    const pasaNombre =
      filtroNombre.trim() === '' || contiene(e.nombre, filtroNombre)
    const pasaRazon =
      filtroRazon.trim() === '' || contiene(e.razon_social ?? '', filtroRazon)
    const pasaApellido = idsPorApellido === null || idsPorApellido.has(e.id)

    // Roles: si no hay ninguno tildado, pasan todas. Si hay, lógica O.
    const algunRol =
      filtroRoles.cliente || filtroRoles.proveedor || filtroRoles.transporte
    const pasaRoles =
      !algunRol ||
      (filtroRoles.cliente && e.es_cliente) ||
      (filtroRoles.proveedor && e.es_proveedor) ||
      (filtroRoles.transporte && e.es_transporte)

    return (
      pasaTexto &&
      pasaCodigo &&
      pasaNombre &&
      pasaRazon &&
      pasaApellido &&
      pasaRoles
    )
  })

  const [tabDetalle, setTabDetalle] = useState('general')
  const [tabEnlazados, setTabEnlazados] = useState('proyectos')

  const [mostrarNuevo, setMostrarNuevo] = useState(false)
  const [formNuevo, setFormNuevo] = useState<EmpresaForm>(FORM_VACIO)
  const [guardandoNuevo, setGuardandoNuevo] = useState(false)
  const [errorNuevo, setErrorNuevo] = useState<string | null>(null)

  const [empresaEditando, setEmpresaEditando] = useState<Empresa | null>(null)
  const [formEdit, setFormEdit] = useState<EmpresaForm>(FORM_VACIO)
  const [guardandoEdit, setGuardandoEdit] = useState(false)
  const [errorEdit, setErrorEdit] = useState<string | null>(null)

  const [empresaBorrando, setEmpresaBorrando] = useState<Empresa | null>(null)
  const [borrando, setBorrando] = useState(false)
  const [errorBorrar, setErrorBorrar] = useState<string | null>(null)

  async function cargarEmpresas() {
    setCargando(true)
    setError(null)
    const { data, error } = await supabase
      .from('empresas')
      .select(
        'id, nombre, codigo, cuit, razon_social, condicion_iva, condicion_iibb, numero_iibb, es_cliente, es_proveedor, es_transporte, foto_url',
      )
      .order('nombre')
    if (error) {
      setError('No se pudieron cargar las empresas.')
      setCargando(false)
      return
    }
    setEmpresas(data ?? [])
    setCargando(false)
  }

  // Snapshot de contactos para el filtro por apellido.
  async function cargarContactos() {
    const { data } = await supabase
      .from('empresa_contactos')
      .select('empresa_id, apellido')
    setContactos(data ?? [])
  }

  useEffect(() => {
    cargarEmpresas()
    cargarContactos()
  }, [])

  function abrirNuevo() {
    setFormNuevo(FORM_VACIO)
    setErrorNuevo(null)
    setMostrarNuevo(true)
  }

  async function crearEmpresa() {
    setErrorNuevo(null)
    if (formNuevo.nombre.trim() === '') {
      setErrorNuevo('El nombre es obligatorio.')
      return
    }
    setGuardandoNuevo(true)
    const { error } = await supabase
      .from('empresas')
      .insert(formAGuardar(formNuevo))
    setGuardandoNuevo(false)
    if (error) {
      setErrorNuevo('No se pudo crear la empresa.')
      return
    }
    setMostrarNuevo(false)
    cargarEmpresas()
  }

  function abrirEdicion(empresa: Empresa) {
    setEmpresaEditando(empresa)
    setFormEdit(empresaAForm(empresa))
    setErrorEdit(null)
  }

  async function guardarEdicion() {
    if (!empresaEditando) return
    setErrorEdit(null)
    if (formEdit.nombre.trim() === '') {
      setErrorEdit('El nombre es obligatorio.')
      return
    }
    setGuardandoEdit(true)
    const { error } = await supabase
      .from('empresas')
      .update(formAGuardar(formEdit))
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
      {/* Franja 1: Filtros */}
      <div className="franja franja-filtros">
        <div className="filtros-barra">
          <input
            className="filtro-busqueda"
            placeholder="Buscar por nombre, código o CUIT…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
          <div className="filtros-campos">
            <input
              className="filtro-campo"
              placeholder="Código"
              value={filtroCodigo}
              onChange={(e) => setFiltroCodigo(e.target.value)}
            />
            <input
              className="filtro-campo"
              placeholder="Nombre"
              value={filtroNombre}
              onChange={(e) => setFiltroNombre(e.target.value)}
            />
            <input
              className="filtro-campo"
              placeholder="Razón social"
              value={filtroRazon}
              onChange={(e) => setFiltroRazon(e.target.value)}
            />
            <input
              className="filtro-campo"
              placeholder="Apellido contacto"
              value={filtroApellido}
              onChange={(e) => setFiltroApellido(e.target.value)}
            />
          </div>
          <div className="filtro-roles">
            <label className="filtro-check">
              <input
                type="checkbox"
                checked={filtroRoles.cliente}
                onChange={() => toggleRol('cliente')}
              />
              Cliente
            </label>
            <label className="filtro-check">
              <input
                type="checkbox"
                checked={filtroRoles.proveedor}
                onChange={() => toggleRol('proveedor')}
              />
              Proveedor
            </label>
            <label className="filtro-check">
              <input
                type="checkbox"
                checked={filtroRoles.transporte}
                onChange={() => toggleRol('transporte')}
              />
              Transporte
            </label>
          </div>
          {hayFiltros && (
            <button
              type="button"
              className="filtro-limpiar"
              onClick={limpiarFiltros}
            >
              Limpiar
            </button>
          )}
        </div>
      </div>

      {/* Franja 2: Lista */}
      <div className="franja franja-lista">
        <MenuContextual
          items={[{ label: 'Nueva empresa', onSelect: abrirNuevo }]}
        >
        {cargando ? (
          <div className="empresas-estado">Cargando empresas…</div>
        ) : error ? (
          <div className="empresas-estado">{error}</div>
        ) : empresas.length === 0 ? (
          <p className="empresas-vacio">Todavía no hay empresas cargadas.</p>
        ) : empresasFiltradas.length === 0 ? (
          <p className="empresas-vacio">
            Ninguna empresa coincide con los filtros.
          </p>
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
              {empresasFiltradas.map((empresa) => (
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
        </MenuContextual>
      </div>

      {/* Franja 3: Detalle */}
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
                  <div className="detalle-cuerpo">
                    <LogoEmpresa
                      empresaId={empresaSeleccionada.id}
                      fotoUrl={empresaSeleccionada.foto_url}
                      onCambio={cargarEmpresas}
                    />
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
                      <span className="detalle-label">Razón social</span>
                      <span>{empresaSeleccionada.razon_social ?? '—'}</span>
                    </div>
                    <div>
                      <span className="detalle-label">Condición IVA</span>
                      <span>{empresaSeleccionada.condicion_iva ?? '—'}</span>
                    </div>
                    <div>
                      <span className="detalle-label">Condición IIBB</span>
                      <span>{empresaSeleccionada.condicion_iibb ?? '—'}</span>
                    </div>
                    <div>
                      <span className="detalle-label">Número IIBB</span>
                      <span>{empresaSeleccionada.numero_iibb ?? '—'}</span>
                    </div>
                    <div>
                      <span className="detalle-label">Roles</span>
                      <span>{rolesTexto(empresaSeleccionada)}</span>
                    </div>
                  </div>
                  </div>
                </div>
              ) : tabDetalle === 'contactos' ? (
                <ContactosEmpresa empresaId={empresaSeleccionada.id} />
              ) : tabDetalle === 'direcciones' ? (
                <DireccionesEmpresa empresaId={empresaSeleccionada.id} />
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

      {/* Franja 4: Enlazados */}
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

      {/* Modal: Nueva empresa */}
      {mostrarNuevo && (
        <Modal titulo="Nueva empresa" onCerrar={() => setMostrarNuevo(false)}>
          <div className="empresa-form-modal">
            <CamposEmpresa valor={formNuevo} setValor={setFormNuevo} />
            {errorNuevo && <p className="empresa-form-error">{errorNuevo}</p>}
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
                disabled={guardandoNuevo}
              >
                {guardandoNuevo ? 'Guardando…' : 'Crear empresa'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal: Editar empresa */}
      {empresaEditando && (
        <Modal
          titulo={`Editar: ${empresaEditando.nombre}`}
          onCerrar={() => setEmpresaEditando(null)}
        >
          <div className="empresa-form-modal">
            <CamposEmpresa valor={formEdit} setValor={setFormEdit} />
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

      {/* Modal: Borrar empresa */}
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
