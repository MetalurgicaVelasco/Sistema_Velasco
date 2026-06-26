import { useState, useEffect } from 'react'
import { supabase } from '../../shared/lib/supabaseClient'

// La "forma" de una empresa, para los campos que mostramos por ahora.
type Empresa = {
  id: number
  nombre: string
  codigo: string | null
}

function Empresas() {
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Función que le pide las empresas a Supabase.
    async function cargarEmpresas() {
      setCargando(true)
      setError(null)

      // Traemos id, nombre y código, ordenados por nombre.
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

    cargarEmpresas()
  }, [])

  if (cargando) {
    return <div className="empresas-estado">Cargando empresas…</div>
  }

  if (error) {
    return <div className="empresas-estado">{error}</div>
  }

  return (
    <div className="empresas">
      <h2 className="empresas-titulo">Empresas ({empresas.length})</h2>

      {empresas.length === 0 ? (
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
