import { useState, useEffect } from 'react'
import { supabase } from '../../shared/lib/supabaseClient'
import Modal from '../../shared/components/Modal'
import SelectorLocalidad from '../../shared/components/SelectorLocalidad'

type Direccion = {
  id: number
  tipo: string | null
  calle: string | null
  numero: string | null
  piso: string | null
  depto: string | null
  observaciones: string | null
  localidad_id: string | null
  localidades: {
    nombre: string
    codigo_postal: string | null
    provincias: { nombre: string } | null
  } | null
}

type DireccionForm = {
  tipo: string
  calle: string
  numero: string
  piso: string
  depto: string
  observaciones: string
  localidadId: string | null
  localidadEtiqueta: string
  cp: string // CP de la localidad
  cpFaltante: boolean // true si la localidad no tenía CP cargado
}

const FORM_VACIO: DireccionForm = {
  tipo: '',
  calle: '',
  numero: '',
  piso: '',
  depto: '',
  observaciones: '',
  localidadId: null,
  localidadEtiqueta: '',
  cp: '',
  cpFaltante: false,
}

function direccionAForm(d: Direccion): DireccionForm {
  const cp = d.localidades?.codigo_postal ?? ''
  const etiqueta = d.localidades
    ? `${d.localidades.nombre}, ${d.localidades.provincias?.nombre ?? ''}`
    : ''
  return {
    tipo: d.tipo ?? '',
    calle: d.calle ?? '',
    numero: d.numero ?? '',
    piso: d.piso ?? '',
    depto: d.depto ?? '',
    observaciones: d.observaciones ?? '',
    localidadId: d.localidad_id,
    localidadEtiqueta: etiqueta,
    cp,
    cpFaltante: !!d.localidad_id && cp === '',
  }
}

// Lo que se guarda en la dirección (el CP NO va acá: vive en la localidad).
function formAGuardar(f: DireccionForm) {
  return {
    tipo: f.tipo || null,
    calle: f.calle.trim() || null,
    numero: f.numero.trim() || null,
    piso: f.piso.trim() || null,
    depto: f.depto.trim() || null,
    observaciones: f.observaciones.trim() || null,
    localidad_id: f.localidadId,
  }
}

function ubicacionTexto(d: Direccion): string {
  if (!d.localidades) return '—'
  const prov = d.localidades.provincias?.nombre ?? ''
  return `${d.localidades.nombre}${prov ? ', ' + prov : ''}`
}

function CamposDireccion({
  valor,
  setValor,
}: {
  valor: DireccionForm
  setValor: (v: DireccionForm) => void
}) {
  return (
    <>
      <label className="empresa-campo">
        Tipo
        <select
          className="empresa-input"
          value={valor.tipo}
          onChange={(e) => setValor({ ...valor, tipo: e.target.value })}
        >
          <option value="">—</option>
          <option value="Fiscal">Fiscal</option>
          <option value="Laboral">Laboral</option>
        </select>
      </label>

      <div className="empresa-campo-fila">
        <label className="empresa-campo">
          Calle
          <input
            className="empresa-input"
            value={valor.calle}
            onChange={(e) => setValor({ ...valor, calle: e.target.value })}
          />
        </label>
        <label className="empresa-campo empresa-campo-chico">
          Número
          <input
            className="empresa-input"
            value={valor.numero}
            onChange={(e) => setValor({ ...valor, numero: e.target.value })}
          />
        </label>
      </div>

      <div className="empresa-campo-fila">
        <label className="empresa-campo empresa-campo-chico">
          Piso
          <input
            className="empresa-input"
            value={valor.piso}
            onChange={(e) => setValor({ ...valor, piso: e.target.value })}
          />
        </label>
        <label className="empresa-campo empresa-campo-chico">
          Depto
          <input
            className="empresa-input"
            value={valor.depto}
            onChange={(e) => setValor({ ...valor, depto: e.target.value })}
          />
        </label>
      </div>

      <div className="empresa-campo">
        <span>
          Localidad
          {valor.localidadId && (
            <strong className="localidad-elegida">
              {' '}
              · {valor.localidadEtiqueta}
            </strong>
          )}
        </span>
        <SelectorLocalidad
          localidadId={valor.localidadId}
          onCambiar={(id, etiqueta, cp) =>
            setValor({
              ...valor,
              localidadId: id,
              localidadEtiqueta: etiqueta,
              cp: cp ?? '',
              cpFaltante: !cp,
            })
          }
        />
      </div>

      {/* Código postal: viene de la localidad. Si falta, se carga una vez. */}
      {valor.localidadId && (
        <label className="empresa-campo">
          Código postal
          {valor.cpFaltante ? (
            <>
              <input
                className="empresa-input"
                value={valor.cp}
                placeholder="Cargá el CP de esta localidad"
                onChange={(e) => setValor({ ...valor, cp: e.target.value })}
              />
              <span className="cp-hint">
                Esta localidad no tiene CP cargado. Lo que pongas queda guardado
                en la localidad para siempre.
              </span>
            </>
          ) : (
            <input className="empresa-input cp-auto" value={valor.cp} readOnly />
          )}
        </label>
      )}

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

function DireccionesEmpresa({ empresaId }: { empresaId: number }) {
  const [direcciones, setDirecciones] = useState<Direccion[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [mostrarNuevo, setMostrarNuevo] = useState(false)
  const [formNuevo, setFormNuevo] = useState<DireccionForm>(FORM_VACIO)
  const [guardandoNuevo, setGuardandoNuevo] = useState(false)
  const [errorNuevo, setErrorNuevo] = useState<string | null>(null)

  const [direccionEditando, setDireccionEditando] = useState<Direccion | null>(
    null,
  )
  const [formEdit, setFormEdit] = useState<DireccionForm>(FORM_VACIO)
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

  // Si la localidad no tenía CP y se cargó uno, lo guardamos EN la localidad.
  async function guardarCpLocalidadSiHace(f: DireccionForm) {
    if (f.cpFaltante && f.localidadId && f.cp.trim() !== '') {
      await supabase
        .from('localidades')
        .update({ codigo_postal: f.cp.trim() })
        .eq('id', f.localidadId)
    }
  }

  function abrirNuevo() {
    setFormNuevo(FORM_VACIO)
    setErrorNuevo(null)
    setMostrarNuevo(true)
  }

  async function crearDireccion() {
    setErrorNuevo(null)
    if (!formNuevo.localidadId) {
      setErrorNuevo('Elegí una localidad.')
      return
    }
    setGuardandoNuevo(true)
    await guardarCpLocalidadSiHace(formNuevo)
    const { error } = await supabase
      .from('empresa_direcciones')
      .insert({ empresa_id: empresaId, ...formAGuardar(formNuevo) })
    setGuardandoNuevo(false)
    if (error) {
      setErrorNuevo('No se pudo crear la dirección.')
      return
    }
    setMostrarNuevo(false)
    cargarDirecciones()
  }

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
      .update(formAGuardar(formEdit))
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
      <div className="subtabla-barra">
        <button type="button" className="empresa-boton" onClick={abrirNuevo}>
          + Nueva dirección
        </button>
      </div>

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

      {/* Modal: nueva dirección */}
      {mostrarNuevo && (
        <Modal titulo="Nueva dirección" onCerrar={() => setMostrarNuevo(false)}>
          <div className="empresa-form-modal">
            <CamposDireccion valor={formNuevo} setValor={setFormNuevo} />
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
                onClick={crearDireccion}
                disabled={guardandoNuevo}
              >
                {guardandoNuevo ? 'Guardando…' : 'Crear dirección'}
              </button>
            </div>
          </div>
        </Modal>
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
