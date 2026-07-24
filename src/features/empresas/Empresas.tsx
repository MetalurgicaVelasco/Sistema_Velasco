import { useState, useEffect, useRef, useMemo } from 'react'
import type { NavFiltro } from '../../shared/types/navegacion'
import { supabase } from '../../shared/lib/supabaseClient'
import { contiene } from '../../shared/lib/texto'
import MenuContextual from '../../shared/components/MenuContextual'
import Modal from '../../shared/components/Modal'
import ContactosEmpresa from './ContactosEmpresa'
import DireccionesEmpresa from './DireccionesEmpresa'
import SectoresEmpresa from './SectoresEmpresa'
import { crearSectorGeneral } from './sectoresApi'
import LogoEmpresa from './LogoEmpresa'
import TablaConfigurable, { type ColumnaDef } from '../../shared/components/TablaConfigurable'
import PanelColumnas from '../../shared/components/PanelColumnas'
import RemitosNdEEmpresa from './RemitosNdEEmpresa'
import { useConfigTabla } from '../../shared/hooks/useConfigTabla'

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
  // Las ubicaciones (Sector → Equipo) solo tienen sentido en clientes: es donde
  // se instalan las piezas del catálogo.
  { id: 'sectores', label: 'Sectores y Equipos', soloCliente: true },
  { id: 'transportes', label: 'Transportes' },
]

const TABS_ENLAZADOS = [
  { id: 'proyectos', label: 'Proyectos' },
  { id: 'pedidos', label: 'Pedidos' },
  { id: 'facturas', label: 'Facturas' },
  { id: 'remitos', label: 'Remitos y NdE' },
  { id: 'ordenes-compra', label: 'Órdenes de compra' },
  { id: 'recibos', label: 'Recibos' },
  { id: 'pagos', label: 'Pagos' },
]

// CUIT argentino: dos dígitos, guion, ocho dígitos, guion, dígito verificador.
function formatCuit(cuit: string | null): string {
  if (!cuit) return '—'
  const d = cuit.replace(/\D/g, '')
  if (d.length === 11) return `${d.slice(0, 2)}-${d.slice(2, 10)}-${d.slice(10)}`
  return cuit
}

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

function Empresas({ filtroEntrante }: { filtroEntrante?: NavFiltro | null }) {
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [seleccionadaId, setSeleccionadaId] = useState<number | null>(null)
  const empresaSeleccionada =
    empresas.find((e) => e.id === seleccionadaId) ?? null

  // Refs para navegación con teclado (foco) y auto-scroll de la fila activa.
  const listaEmpRef = useRef<HTMLDivElement>(null)
  const filaEmpSelRef = useRef<HTMLTableRowElement>(null)

  // Franja 2: columnas configurables (mostrar/ocultar, ancho, posición) + orden
  // por título, persistido por usuario.
  const {
    columnas: configF2,
    setColumnas: setConfigF2,
    orden: ordenF2,
    setOrden: setOrdenF2,
  } = useConfigTabla('empresas.f2.columnas', [
    { id: 'codigo', visible: true, ancho: 100 },
    { id: 'nombre', visible: true, ancho: 280 },
    { id: 'cuit', visible: true, ancho: 140 },
    { id: 'roles', visible: true, ancho: 220 },
  ])
  const [panelColsF2, setPanelColsF2] = useState(false)

  const colsEmpresas: ColumnaDef<Empresa>[] = useMemo(
    () => [
      { id: 'codigo', titulo: 'Código', tipo: 'texto', valor: (e) => e.codigo },
      { id: 'nombre', titulo: 'Nombre', tipo: 'texto', valor: (e) => e.nombre },
      { id: 'cuit', titulo: 'CUIT', tipo: 'texto', valor: (e) => e.cuit, render: (e) => formatCuit(e.cuit) },
      { id: 'roles', titulo: 'Roles', tipo: 'texto', valor: (e) => rolesTexto(e) },
    ],
    [],
  )
  // Preview del logo dentro del modal de edición (se actualiza al pegar/quitar).
  const [logoUrlEdit, setLogoUrlEdit] = useState<string | null>(null)
  // La "fila" del detalle (franja 3) se puede seleccionar aunque sea única.
  const [detalleSel, setDetalleSel] = useState(false)

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

  // Filtro entrante (salto desde otro módulo, ej: click en la empresa de un
  // proyecto): limpia los filtros y filtra por el NOMBRE de esa empresa,
  // dejándola seleccionada. Se aplica una vez por
  // salto (aplicadoRef evita re-aplicar cuando recargan las empresas).
  const aplicadoRef = useRef<NavFiltro | null>(null)
  useEffect(() => {
    if (!filtroEntrante || empresas.length === 0) return
    if (aplicadoRef.current === filtroEntrante) return
    aplicadoRef.current = filtroEntrante
    const emp = empresas.find((e) => e.id === filtroEntrante.empresaId)
    limpiarFiltros()
    if (emp) setFiltroNombre(emp.nombre)
    setSeleccionadaId(filtroEntrante.empresaId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtroEntrante, empresas])

  // Auto-scroll de la fila seleccionada al moverse con el teclado.
  useEffect(() => {
    filaEmpSelRef.current?.scrollIntoView({ block: 'nearest' })
    setDetalleSel(false)
  }, [seleccionadaId])

  // Navegación con teclado en la lista (↑/↓ mueve el selector, Enter = Editar).
  function onKeyEmpresas(e: React.KeyboardEvent) {
    if (empresasFiltradas.length === 0) return
    const idx = empresasFiltradas.findIndex((x) => x.id === seleccionadaId)
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSeleccionadaId(
        empresasFiltradas[
          idx < 0 ? 0 : Math.min(idx + 1, empresasFiltradas.length - 1)
        ].id,
      )
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSeleccionadaId(empresasFiltradas[idx < 0 ? 0 : Math.max(idx - 1, 0)].id)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (empresaSeleccionada) abrirEdicion(empresaSeleccionada)
    }
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
  const [tabModal, setTabModal] = useState('general')
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
    const { data, error } = await supabase
      .from('empresas')
      .insert(formAGuardar(formNuevo))
      .select('id')
      .single()
    if (error || !data) {
      setGuardandoNuevo(false)
      setErrorNuevo('No se pudo crear la empresa.')
      return
    }
    // Una empresa cliente nace con su "Sector General" (y su equipo general
    // adentro): garantiza que siempre haya una ubicación válida para el catálogo.
    if (formNuevo.es_cliente) {
      try {
        await crearSectorGeneral(data.id)
      } catch {
        /* la empresa ya está creada; el sector se puede cargar a mano */
      }
    }
    setGuardandoNuevo(false)
    setMostrarNuevo(false)
    cargarEmpresas()
  }

  function abrirEdicion(empresa: Empresa) {
    setEmpresaEditando(empresa)
    setFormEdit(empresaAForm(empresa))
    setLogoUrlEdit(empresa.foto_url)
    setErrorEdit(null)
    setTabModal('general')
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
    <div className="vista-franjas">
      {/* Franja 1: Filtros */}
      <div className="franja franja-filtros">
        <div className="filtros-barra">
          {/* Columna 1: búsqueda global + nombre + razón social (3 filas) */}
          <div className="filtros-col">
            <span className="filtro-lbl">Búsqueda global</span>
            <input
              className="filtro-input"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
            <span className="filtro-lbl">Nombre Empresa</span>
            <input
              className="filtro-input"
              value={filtroNombre}
              onChange={(e) => setFiltroNombre(e.target.value)}
            />
            <span className="filtro-lbl">Razón social</span>
            <input
              className="filtro-input"
              value={filtroRazon}
              onChange={(e) => setFiltroRazon(e.target.value)}
            />
          </div>

          {/* Columna 2: código + apellido de contacto */}
          <div className="filtros-col">
            <span className="filtro-lbl">Código</span>
            <input
              className="filtro-input"
              value={filtroCodigo}
              onChange={(e) => setFiltroCodigo(e.target.value)}
            />
            <span className="filtro-lbl">Apellido contacto</span>
            <input
              className="filtro-input"
              value={filtroApellido}
              onChange={(e) => setFiltroApellido(e.target.value)}
            />
          </div>

          {/* Columna 3: cuadrito de roles (checkboxes apilados) */}
          <div className="filtro-roles-caja">
            <span className="filtro-roles-tit">Roles</span>
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
          items={(e) => {
            const fila = (e.target as HTMLElement).closest('[data-empresa-id]')
            const id = fila ? Number(fila.getAttribute('data-empresa-id')) : null
            const emp = id != null ? empresas.find((x) => x.id === id) : null
            return [
              ...(emp ? [{ label: `Editar "${emp.nombre}"`, onSelect: () => abrirEdicion(emp) }] : []),
              { label: 'Nueva empresa', onSelect: abrirNuevo },
              { label: 'Columnas…', onSelect: () => setPanelColsF2(true) },
            ]
          }}
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
          <div
            className="lista-focus"
            tabIndex={0}
            ref={listaEmpRef}
            onKeyDown={onKeyEmpresas}
          >
          <TablaConfigurable<Empresa>
            columnas={colsEmpresas}
            config={configF2}
            onConfig={setConfigF2}
            filas={empresasFiltradas}
            orden={ordenF2}
            onOrden={setOrdenF2}
            filaKey={(e) => e.id}
            filaClase={(e) => (e.id === seleccionadaId ? 'seleccionada' : '')}
            filaData={(e) => ({ 'data-empresa-id': e.id })}
            filaRef={(e) => (e.id === seleccionadaId ? filaEmpSelRef : undefined)}
            onFilaClick={(e) => {
              setSeleccionadaId(e.id)
              listaEmpRef.current?.focus()
            }}
            onFilaContextMenu={(e) => setSeleccionadaId(e.id)}
          />
          </div>
        )}
        </MenuContextual>
      </div>

      {/* Franja 3: Detalle */}
      <div className="franja franja-detalle">
        {empresaSeleccionada ? (
          <>
            <div className="enlazados-tabs">
              {TABS_DETALLE.filter((tab) => !tab.soloCliente || empresaSeleccionada.es_cliente).map((tab) => (
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
                  <MenuContextual
                    items={[
                      {
                        label: 'Editar',
                        onSelect: () => abrirEdicion(empresaSeleccionada),
                      },
                      {
                        label: 'Borrar',
                        onSelect: () => {
                          setEmpresaBorrando(empresaSeleccionada)
                          setErrorBorrar(null)
                        },
                      },
                    ]}
                  >
                    <div
                      className={
                        'detalle-cuerpo detalle-fila' +
                        (detalleSel ? ' seleccionada' : '')
                      }
                      onClick={() => setDetalleSel(true)}
                    >
                      <LogoEmpresa
                        soloLectura
                        empresaId={empresaSeleccionada.id}
                        fotoUrl={empresaSeleccionada.foto_url}
                      />
                      <div className="detalle-campos">
                        <div>
                          <span className="detalle-label">Nombre</span>
                          <span>{empresaSeleccionada.nombre}</span>
                        </div>
                        <div>
                          <span className="detalle-label">Código</span>
                          <span>{empresaSeleccionada.codigo ?? '—'}</span>
                        </div>
                        <div>
                          <span className="detalle-label">CUIT</span>
                          <span>{formatCuit(empresaSeleccionada.cuit)}</span>
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
                        <div className="detalle-acciones-inline">
                          <button
                            type="button"
                            className="empresas-editar"
                            onClick={(e) => {
                              e.stopPropagation()
                              abrirEdicion(empresaSeleccionada)
                            }}
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            className="empresas-borrar"
                            onClick={(e) => {
                              e.stopPropagation()
                              setEmpresaBorrando(empresaSeleccionada)
                              setErrorBorrar(null)
                            }}
                          >
                            Borrar
                          </button>
                        </div>
                      </div>
                    </div>
                  </MenuContextual>
                </div>
              ) : tabDetalle === 'contactos' ? (
                <ContactosEmpresa empresaId={empresaSeleccionada.id} />
              ) : tabDetalle === 'direcciones' ? (
                <DireccionesEmpresa empresaId={empresaSeleccionada.id} />
              ) : tabDetalle === 'sectores' ? (
                <SectoresEmpresa empresaId={empresaSeleccionada.id} />
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
          {!empresaSeleccionada ? (
            <div className="enlazados-aviso">Seleccioná una empresa.</div>
          ) : tabEnlazados === 'remitos' ? (
            <RemitosNdEEmpresa empresaId={empresaSeleccionada.id} />
          ) : (
            <div className="enlazados-aviso">Esta sección se construye más adelante.</div>
          )}
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
          ancho={860}
        >
          {/* Pestañas dentro del modal: todo lo de la empresa se edita acá, sin
              salir. Ojo: solo "General" difiere el guardado (botón Guardar); las
              demás pestañas persisten al instante. */}
          <div className="enlazados-tabs emp-modal-tabs">
            {TABS_DETALLE.filter((t) => t.id !== 'transportes')
              .filter((t) => !t.soloCliente || empresaEditando.es_cliente)
              .map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={'enlazados-tab' + (tab.id === tabModal ? ' activa' : '')}
                  onClick={() => setTabModal(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
          </div>

          {tabModal === 'general' ? (
            <div className="empresa-form-modal">
              <div className="empresa-logo-editar">
                <span className="empresa-logo-label">Logo</span>
                <LogoEmpresa
                  empresaId={empresaEditando.id}
                  fotoUrl={logoUrlEdit}
                  onCambio={(ruta) => {
                    setLogoUrlEdit(ruta)
                    cargarEmpresas()
                  }}
                />
              </div>
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
          ) : (
            <div className="emp-modal-tab-cont">
              {tabModal === 'contactos' ? (
                <ContactosEmpresa empresaId={empresaEditando.id} />
              ) : tabModal === 'direcciones' ? (
                <DireccionesEmpresa empresaId={empresaEditando.id} />
              ) : tabModal === 'sectores' ? (
                <SectoresEmpresa empresaId={empresaEditando.id} />
              ) : null}
              <p className="emp-modal-nota">
                Los cambios de esta pestaña se guardan al instante.
              </p>
            </div>
          )}
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

      {panelColsF2 && (
        <PanelColumnas
          columnas={colsEmpresas}
          config={configF2}
          onConfig={setConfigF2}
          onCerrar={() => setPanelColsF2(false)}
        />
      )}
    </div>
  )
}

export default Empresas
