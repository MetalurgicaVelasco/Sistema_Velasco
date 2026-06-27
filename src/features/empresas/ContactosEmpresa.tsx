import { useState, useEffect } from 'react'
import { supabase } from '../../shared/lib/supabaseClient'
import Modal from '../../shared/components/Modal'

type Contacto = {
  id: number
  nombre: string
  puesto: string | null
  area: string | null
  email: string | null
  telefono: string | null
  celular: string | null
  observaciones: string | null
}

// Forma del formulario (todos los campos como texto).
type ContactoForm = {
  nombre: string
  puesto: string
  area: string
  email: string
  telefono: string
  celular: string
  observaciones: string
}

const FORM_VACIO: ContactoForm = {
  nombre: '',
  puesto: '',
  area: '',
  email: '',
  telefono: '',
  celular: '',
  observaciones: '',
}

// Convierte un Contacto (de la base) al formato del formulario.
function contactoAForm(c: Contacto): ContactoForm {
  return {
    nombre: c.nombre,
    puesto: c.puesto ?? '',
    area: c.area ?? '',
    email: c.email ?? '',
    telefono: c.telefono ?? '',
    celular: c.celular ?? '',
    observaciones: c.observaciones ?? '',
  }
}

// Convierte el formulario al objeto que guardamos (vacíos -> null).
function formAGuardar(f: ContactoForm) {
  return {
    nombre: f.nombre.trim(),
    puesto: f.puesto.trim() || null,
    area: f.area.trim() || null,
    email: f.email.trim() || null,
    telefono: f.telefono.trim() || null,
    celular: f.celular.trim() || null,
    observaciones: f.observaciones.trim() || null,
  }
}

// Componente chico para los campos del formulario (se usa en crear y editar).
function CamposContacto({
  valor,
  setValor,
}: {
  valor: ContactoForm
  setValor: (v: ContactoForm) => void
}) {
  return (
    <>
      <label className="empresa-campo">
        Nombre *
        <input
          className="empresa-input"
          value={valor.nombre}
          onChange={(e) => setValor({ ...valor, nombre: e.target.value })}
        />
      </label>
      <label className="empresa-campo">
        Puesto
        <input
          className="empresa-input"
          value={valor.puesto}
          onChange={(e) => setValor({ ...valor, puesto: e.target.value })}
        />
      </label>
      <label className="empresa-campo">
        Área
        <input
          className="empresa-input"
          value={valor.area}
          onChange={(e) => setValor({ ...valor, area: e.target.value })}
        />
      </label>
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

  async function cargarContactos() {
    setCargando(true)
    setError(null)
    const { data, error } = await supabase
      .from('empresa_contactos')
      .select('id, nombre, puesto, area, email, telefono, celular, observaciones')
      .eq('empresa_id', empresaId)
      .order('nombre')
    if (error) {
      setError('No se pudieron cargar los contactos.')
      setCargando(false)
      return
    }
    setContactos(data ?? [])
    setCargando(false)
  }

  // Se recarga cada vez que cambia la empresa seleccionada.
  useEffect(() => {
    cargarContactos()
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

  return (
    <div className="subtabla">
      <div className="subtabla-barra">
        <button type="button" className="empresa-boton" onClick={abrirNuevo}>
          + Nuevo contacto
        </button>
      </div>

      {cargando ? (
        <div className="empresas-estado">Cargando contactos…</div>
      ) : error ? (
        <div className="empresas-estado">{error}</div>
      ) : contactos.length === 0 ? (
        <p className="empresas-vacio">Esta empresa no tiene contactos cargados.</p>
      ) : (
        <table className="tabla">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Puesto</th>
              <th>Área</th>
              <th>Email</th>
              <th>Teléfono</th>
              <th>Celular</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {contactos.map((c) => (
              <tr key={c.id} className="tabla-fila">
                <td>{c.nombre}</td>
                <td>{c.puesto ?? '—'}</td>
                <td>{c.area ?? '—'}</td>
                <td>{c.email ?? '—'}</td>
                <td>{c.telefono ?? '—'}</td>
                <td>{c.celular ?? '—'}</td>
                <td className="tabla-acciones">
                  <button
                    type="button"
                    className="empresas-editar"
                    onClick={() => abrirEdicion(c)}
                  >
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
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Modal: nuevo contacto */}
      {mostrarNuevo && (
        <Modal titulo="Nuevo contacto" onCerrar={() => setMostrarNuevo(false)}>
          <div className="empresa-form-modal">
            <CamposContacto valor={formNuevo} setValor={setFormNuevo} />
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
            <CamposContacto valor={formEdit} setValor={setFormEdit} />
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
    </div>
  )
}

export default ContactosEmpresa
