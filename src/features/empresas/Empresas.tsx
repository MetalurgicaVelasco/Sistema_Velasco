import { useState, useEffect } from 'react'
import { supabase } from '../../shared/lib/supabaseClient'

type Empresa = {
  id: number
  nombre: string
  codigo: string | null
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

  // Pide las empresas a Supabase (la usamos al cargar y después de crear).
  async function cargarEmpresas() {
    setCargando(true)
    setError(null)

    const { data, error } = await supabase
      .from('empresas')
      .select('id, nombre, codigo')
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

    // Validación mínima: el nombre es obligatorio.
    if (nombre.trim() === '') {
      setErrorForm('El nombre es obligatorio.')
      return
    }

    setGuardando(true)

    // Escribimos la empresa nueva en la base.
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

    // Limpiamos el formulario y refrescamos la lista.
    setNombre('')
    setCodigo('')
    setCuit('')
    setEsCliente(false)
    setEsProveedor(false)
    setEsTransporte(false)
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
              <span>{empresa.nombre}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default Empresas
