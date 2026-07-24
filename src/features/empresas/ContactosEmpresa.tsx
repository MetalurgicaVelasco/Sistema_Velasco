import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../shared/lib/supabaseClient'
import Modal from '../../shared/components/Modal'
import MenuContextual from '../../shared/components/MenuContextual'
import TablaConfigurable, { type ColumnaDef } from '../../shared/components/TablaConfigurable'
import PanelColumnas from '../../shared/components/PanelColumnas'
import { useConfigTabla } from '../../shared/hooks/useConfigTabla'
import SelectorConAlta from '../../shared/components/SelectorConAlta'
import type { Opcion } from '../../shared/components/SelectorConAlta'
import ModalNuevaDireccion from './ModalNuevaDireccion'
import { etiquetaDireccion, etiquetaDireccionSinTipo } from './direccionForm'
import type { Direccion } from './direccionForm'

type Contacto = {
  id: number
  nombre: string
  apellido: string | null
  puesto: string | null
  email: string | null
  telefono: string | null
  celular: string | null
  observaciones: string | null
  direccion_id: number | null
  area_id: number | null
  sector_id: number | null
}

type ContactoForm = {
  nombre: string
  apellido: string
  puesto: string
  email: string
  telefono: string
  celular: string
  observaciones: string
  direccionId: number | null
  areaId: number | null
  sectorId: number | null
}

const FORM_VACIO: ContactoForm = {
  nombre: '',
  apellido: '',
  puesto: '',
  email: '',
  telefono: '',
  celular: '',
  observaciones: '',
  direccionId: null,
  areaId: null,
  sectorId: null,
}

function contactoAForm(c: Contacto): ContactoForm {
  return {
    nombre: c.nombre,
    apellido: c.apellido ?? '',
    puesto: c.puesto ?? '',
    email: c.email ?? '',
    telefono: c.telefono ?? '',
    celular: c.celular ?? '',
    observaciones: c.observaciones ?? '',
    direccionId: c.direccion_id,
    areaId: c.area_id,
    sectorId: c.sector_id,
  }
}

function formAGuardar(f: ContactoForm) {
  return {
    nombre: f.nombre.trim(),
    apellido: f.apellido.trim() || null,
    puesto: f.puesto.trim() || null,
    email: f.email.trim() || null,
    telefono: f.telefono.trim() || null,
    celular: f.celular.trim() || null,
    observaciones: f.observaciones.trim() || null,
    direccion_id: f.direccionId,
    area_id: f.areaId,
    sector_id: f.sectorId,
  }
}

// Campos del formulario (se usan en crear y editar).
function CamposContacto({
  valor,
  setValor,
  direcciones,
  onNuevaDireccion,
  areas,
  sectores,
  onAgregarArea,
  onAgregarSector,
}: {
  valor: ContactoForm
  setValor: (v: ContactoForm) => void
  direcciones: Direccion[]
  onNuevaDireccion: () => void
  areas: Opcion[]
  sectores: Opcion[]
  onAgregarArea: (nombre: string) => Promise<Opcion | null>
  onAgregarSector: (nombre: string) => Promise<Opcion | null>
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
        <label className="empresa-campo">
          Apellido
          <input
            className="empresa-input"
            value={valor.apellido}
            onChange={(e) => setValor({ ...valor, apellido: e.target.value })}
          />
        </label>
      </div>

      <label className="empresa-campo">
        Puesto
        <input
          className="empresa-input"
          value={valor.puesto}
          onChange={(e) => setValor({ ...valor, puesto: e.target.value })}
        />
      </label>

      <div className="empresa-campo">
        <span>Área</span>
        <SelectorConAlta
          valor={valor.areaId}
          opciones={areas}
          onCambiar={(id) => setValor({ ...valor, areaId: id })}
          onAgregar={onAgregarArea}
          placeholderNuevo="Nueva área"
        />
      </div>

      <div className="empresa-campo">
        <span>Sector</span>
        <SelectorConAlta
          valor={valor.sectorId}
          opciones={sectores}
          onCambiar={(id) => setValor({ ...valor, sectorId: id })}
          onAgregar={onAgregarSector}
          placeholderNuevo="Nuevo sector"
        />
      </div>

      <div className="empresa-campo">
        <span>Dirección</span>
        <div className="contacto-direccion-fila">
          <select
            className="empresa-input"
            value={valor.direccionId ?? ''}
            onChange={(e) =>
              setValor({
                ...valor,
                direccionId: e.target.value ? Number(e.target.value) : null,
              })
            }
          >
            <option value="">— Sin dirección —</option>
            {direcciones.map((d) => (
              <option key={d.id} value={d.id}>
                {etiquetaDireccion(d)}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="empresa-boton-secundario"
            onClick={onNuevaDireccion}
          >
            + Nueva
          </button>
        </div>
      </div>

      <label className="empresa-campo">
        Email
        <input
          className="empresa-input"
          value={valor.email}
          onChange={(e) => setValor({ ...valor, email: e.target.value })}
        />
      </label>
      <label className="empresa-campo">
        Teléfono
        <input
          className="empresa-input"
          value={valor.telefono}
          onChange={(e) => setValor({ ...valor, telefono: e.target.value })}
        />
      </label>
      <label className="empresa-campo">
        Celular
        <input
          className="empresa-input"
          value={valor.celular}
          onChange={(e) => setValor({ ...valor, celular: e.target.value })}
        />
      </label>
      <label className="empresa-campo">
        Observaciones
        <textarea
          className="empresa-input"
          rows={2}
          value={valor.observaciones}
          onChange={(e) =>
            setValor({ ...valor, observaciones: e.target.value })
          }
        />
      </label>
    </>
  )
}

function ContactosEmpresa({ empresaId }: { empresaId: number }) {
  const [contactos, setContactos] = useState<Contacto[]>([])
  const {
    columnas: configCols,
    setColumnas: setConfigCols,
    orden,
    setOrden,
  } = useConfigTabla('empresas.contactos.columnas', [
    { id: 'nombre', visible: true, ancho: 130 },
    { id: 'apellido', visible: true, ancho: 130 },
    { id: 'puesto', visible: true, ancho: 130 },
    { id: 'area', visible: true, ancho: 120 },
    { id: 'sector', visible: true, ancho: 120 },
    { id: 'direccion', visible: true, ancho: 190 },
    { id: 'tipoDireccion', visible: true, ancho: 130 },
    { id: 'email', visible: true, ancho: 190 },
    { id: 'telefono', visible: true, ancho: 120 },
    { id: 'celular', visible: true, ancho: 120 },
  ])
  const [panelCols, setPanelCols] = useState(false)
  const [direcciones, setDirecciones] = useState<Direccion[]>([])
  const [areas, setAreas] = useState<Opcion[]>([])
  const [sectores, setSectores] = useState<Opcion[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Crear
  const [mostrarNuevo, setMostrarNuevo] = useState(false)
  const [formNuevo, setFormNuevo] = useState<ContactoForm>(FORM_VACIO)
  const [guardandoNuevo, setGuardandoNuevo] = useState(false)
  const [errorNuevo, setErrorNuevo] = useState<string | null>(null)

  // Editar
  const [contactoEditando, setContactoEditando] = useState<Contacto | null>(null)
  const [formEdit, setFormEdit] = useState<ContactoForm>(FORM_VACIO)
  const [guardandoEdit, setGuardandoEdit] = useState(false)
  const [errorEdit, setErrorEdit] = useState<string | null>(null)

  // Borrar
  const [contactoBorrando, setContactoBorrando] = useState<Contacto | null>(null)
  const [borrando, setBorrando] = useState(false)
  const [errorBorrar, setErrorBorrar] = useState<string | null>(null)

  // Nueva dirección desde el modal de contacto (modal sobre modal)
  const [mostrarNuevaDireccion, setMostrarNuevaDireccion] = useState(false)

  async function cargarContactos() {
    setCargando(true)
    setError(null)
    const { data, error } = await supabase
      .from('empresa_contactos')
      .select(
        'id, nombre, apellido, puesto, email, telefono, celular, observaciones, direccion_id, area_id, sector_id',
      )
      .eq('empresa_id', empresaId)
      .order('apellido')
    if (error) {
      setError('No se pudieron cargar los contactos.')
      setCargando(false)
      return
    }
    setContactos(data ?? [])
    setCargando(false)
  }

  async function cargarDirecciones() {
    const { data } = await supabase
      .from('empresa_direcciones')
      .select(
        'id, tipo, calle, numero, piso, depto, observaciones, localidad_id, localidades ( nombre, codigo_postal, provincias ( nombre ) )',
      )
      .eq('empresa_id', empresaId)
      .order('id')
    setDirecciones((data as unknown as Direccion[]) ?? [])
  }

  // Sectores de esta empresa.
  async function cargarSectores() {
    const { data } = await supabase
      .from('empresa_sectores')
      .select('id, nombre')
      .eq('empresa_id', empresaId)
      .order('nombre')
    setSectores(data ?? [])
  }

  // Áreas: catálogo global (mismas para todas las empresas).
  async function cargarAreas() {
    const { data } = await supabase
      .from('contacto_areas')
      .select('id, nombre')
      .order('nombre')
    setAreas(data ?? [])
  }

  useEffect(() => {
    cargarAreas()
  }, [])

  useEffect(() => {
    cargarContactos()
    cargarDirecciones()
    cargarSectores()
  }, [empresaId])

  function abrirNuevo() {
    setFormNuevo(FORM_VACIO)
    setErrorNuevo(null)
    setMostrarNuevo(true)
  }

  async function crearContacto() {
    setErrorNuevo(null)
    if (formNuevo.nombre.trim() === '') {
      setErrorNuevo('El nombre es obligatorio.')
      return
    }
    setGuardandoNuevo(true)
    const { error } = await supabase
      .from('empresa_contactos')
      .insert({ empresa_id: empresaId, ...formAGuardar(formNuevo) })
    setGuardandoNuevo(false)
    if (error) {
      setErrorNuevo('No se pudo crear el contacto.')
      return
    }
    setMostrarNuevo(false)
    cargarContactos()
  }

  function abrirEdicion(c: Contacto) {
    setContactoEditando(c)
    setFormEdit(contactoAForm(c))
    setErrorEdit(null)
  }

  async function guardarEdicion() {
    if (!contactoEditando) return
    setErrorEdit(null)
    if (formEdit.nombre.trim() === '') {
      setErrorEdit('El nombre es obligatorio.')
      return
    }
    setGuardandoEdit(true)
    const { error } = await supabase
      .from('empresa_contactos')
      .update(formAGuardar(formEdit))
      .eq('id', contactoEditando.id)
    setGuardandoEdit(false)
    if (error) {
      setErrorEdit('No se pudieron guardar los cambios.')
      return
    }
    setContactoEditando(null)
    cargarContactos()
  }

  async function confirmarBorrado() {
    if (!contactoBorrando) return
    setErrorBorrar(null)
    setBorrando(true)
    const { error } = await supabase
      .from('empresa_contactos')
      .delete()
      .eq('id', contactoBorrando.id)
    setBorrando(false)
    if (error) {
      setErrorBorrar('No se pudo borrar el contacto.')
      return
    }
    setContactoBorrando(null)
    cargarContactos()
  }

  // Alta al vuelo de un área (catálogo global).
  async function onAgregarArea(nombre: string): Promise<Opcion | null> {
    const { data, error } = await supabase
      .from('contacto_areas')
      .insert({ nombre })
      .select('id, nombre')
      .single()
    if (error || !data) return null
    setAreas((prev) =>
      [...prev, data].sort((a, b) => a.nombre.localeCompare(b.nombre)),
    )
    return data
  }

  // Alta al vuelo de un sector (de esta empresa).
  async function onAgregarSector(nombre: string): Promise<Opcion | null> {
    const { data, error } = await supabase
      .from('empresa_sectores')
      .insert({ empresa_id: empresaId, nombre })
      .select('id, nombre')
      .single()
    if (error || !data) return null
    setSectores((prev) =>
      [...prev, data].sort((a, b) => a.nombre.localeCompare(b.nombre)),
    )
    return data
  }

  // Al crear una dirección desde el modal de contacto.
  function onDireccionCreada(nueva: Direccion) {
    setDirecciones((prev) => [...prev, nueva])
    if (mostrarNuevo) {
      setFormNuevo((f) => ({ ...f, direccionId: nueva.id }))
    } else if (contactoEditando) {
      setFormEdit((f) => ({ ...f, direccionId: nueva.id }))
    }
    setMostrarNuevaDireccion(false)
  }

  const camposComunes = {
    direcciones,
    onNuevaDireccion: () => setMostrarNuevaDireccion(true),
    areas,
    sectores,
    onAgregarArea,
    onAgregarSector,
  }

  const colsContactos: ColumnaDef<Contacto>[] = useMemo(() => {
    const dirDe = (c: Contacto) => direcciones.find((d) => d.id === c.direccion_id)
    return [
      { id: 'nombre', titulo: 'Nombre', tipo: 'texto', valor: (c) => c.nombre },
      { id: 'apellido', titulo: 'Apellido', tipo: 'texto', valor: (c) => c.apellido },
      { id: 'puesto', titulo: 'Puesto', tipo: 'texto', valor: (c) => c.puesto },
      {
        id: 'area',
        titulo: 'Área',
        tipo: 'texto',
        valor: (c) => areas.find((a) => a.id === c.area_id)?.nombre ?? '',
      },
      {
        id: 'sector',
        titulo: 'Sector',
        tipo: 'texto',
        valor: (c) => sectores.find((x) => x.id === c.sector_id)?.nombre ?? '',
      },
      {
        id: 'direccion',
        titulo: 'Dirección',
        tipo: 'texto',
        valor: (c) => {
          const d = dirDe(c)
          return d ? etiquetaDireccionSinTipo(d) : ''
        },
      },
      { id: 'tipoDireccion', titulo: 'Tipo de dirección', tipo: 'texto', valor: (c) => dirDe(c)?.tipo ?? '' },
      { id: 'email', titulo: 'Email', tipo: 'texto', valor: (c) => c.email },
      { id: 'telefono', titulo: 'Teléfono', tipo: 'texto', valor: (c) => c.telefono },
      { id: 'celular', titulo: 'Celular', tipo: 'texto', valor: (c) => c.celular },
    ]
  }, [direcciones, areas, sectores])

  return (
    <div className="subtabla">
      <MenuContextual
        items={[
          { label: 'Nuevo contacto', onSelect: abrirNuevo },
          { label: 'Columnas…', onSelect: () => setPanelCols(true) },
        ]}
      >
      {cargando ? (
        <div className="empresas-estado">Cargando contactos…</div>
      ) : error ? (
        <div className="empresas-estado">{error}</div>
      ) : contactos.length === 0 ? (
        <p className="empresas-vacio">Esta empresa no tiene contactos cargados.</p>
      ) : (
        <TablaConfigurable<Contacto>
          columnas={colsContactos}
          config={configCols}
          onConfig={setConfigCols}
          filas={contactos}
          orden={orden}
          onOrden={setOrden}
          filaKey={(c) => c.id}
          acciones={(c) => (
            <>
              <button type="button" className="empresas-editar" onClick={() => abrirEdicion(c)}>
                Editar
              </button>
              <button
                type="button"
                className="empresas-borrar"
                onClick={() => {
                  setContactoBorrando(c)
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

      {/* Modal: nuevo contacto */}
      {mostrarNuevo && (
        <Modal titulo="Nuevo contacto" onCerrar={() => setMostrarNuevo(false)}>
          <div className="empresa-form-modal">
            <CamposContacto
              valor={formNuevo}
              setValor={setFormNuevo}
              {...camposComunes}
            />
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
                onClick={crearContacto}
                disabled={guardandoNuevo}
              >
                {guardandoNuevo ? 'Guardando…' : 'Crear contacto'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal: editar contacto */}
      {contactoEditando && (
        <Modal
          titulo={`Editar: ${contactoEditando.nombre}`}
          onCerrar={() => setContactoEditando(null)}
        >
          <div className="empresa-form-modal">
            <CamposContacto
              valor={formEdit}
              setValor={setFormEdit}
              {...camposComunes}
            />
            {errorEdit && <p className="empresa-form-error">{errorEdit}</p>}
            <div className="empresa-modal-acciones">
              <button
                type="button"
                className="empresa-boton-secundario"
                onClick={() => setContactoEditando(null)}
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

      {/* Modal: borrar contacto */}
      {contactoBorrando && (
        <Modal titulo="Borrar contacto" onCerrar={() => setContactoBorrando(null)}>
          <div className="empresa-form-modal">
            <p>
              ¿Seguro que querés borrar <strong>{contactoBorrando.nombre}</strong>?
              Esta acción no se puede deshacer.
            </p>
            {errorBorrar && <p className="empresa-form-error">{errorBorrar}</p>}
            <div className="empresa-modal-acciones">
              <button
                type="button"
                className="empresa-boton-secundario"
                onClick={() => setContactoBorrando(null)}
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

      {/* Modal sobre modal: crear dirección desde el contacto */}
      {mostrarNuevaDireccion && (
        <ModalNuevaDireccion
          empresaId={empresaId}
          onCerrar={() => setMostrarNuevaDireccion(false)}
          onCreada={onDireccionCreada}
        />
      )}

      {panelCols && (
        <PanelColumnas
          columnas={colsContactos}
          config={configCols}
          onConfig={setConfigCols}
          onCerrar={() => setPanelCols(false)}
        />
      )}
    </div>
  )
}

export default ContactosEmpresa
