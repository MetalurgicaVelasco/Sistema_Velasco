import { useState } from 'react'
import { contiene } from '../lib/texto'

type Empresa = { id: number; nombre: string }

// Combobox: un input donde escribís y filtra las empresas (sin tildes),
// mostrando un desplegable de coincidencias para elegir.
function BuscadorEmpresa({
  empresas,
  valorId,
  onElegir,
  placeholder = 'Buscar…',
}: {
  empresas: Empresa[]
  valorId: number | null
  onElegir: (id: number | null) => void
  placeholder?: string
}) {
  const [texto, setTexto] = useState('')
  const [abierto, setAbierto] = useState(false)

  const elegida = empresas.find((e) => e.id === valorId) ?? null

  // Mientras está abierto se muestra lo tipeado; cerrado, el nombre elegido.
  const valorInput = abierto ? texto : elegida?.nombre ?? ''

  const filtradas = (
    texto.trim()
      ? empresas.filter((e) => contiene(e.nombre, texto))
      : empresas
  ).slice(0, 8)

  return (
    <div className="buscador-empresa">
      <input
        className="empresa-input"
        placeholder={placeholder}
        value={valorInput}
        onChange={(e) => {
          setTexto(e.target.value)
          if (!abierto) setAbierto(true)
        }}
        onFocus={() => {
          setTexto('')
          setAbierto(true)
        }}
        onBlur={() => setAbierto(false)}
      />
      {elegida && !abierto && (
        <button
          type="button"
          className="buscador-empresa-limpiar"
          title="Quitar"
          onClick={() => onElegir(null)}
        >
          ✕
        </button>
      )}

      {abierto && filtradas.length > 0 && (
        <ul className="buscador-empresa-lista">
          {filtradas.map((e) => (
            <li key={e.id}>
              <button
                type="button"
                // onMouseDown (no onClick) para que el clic registre
                // antes de que el input pierda el foco y se cierre la lista.
                onMouseDown={(ev) => {
                  ev.preventDefault()
                  onElegir(e.id)
                  setAbierto(false)
                  setTexto('')
                }}
              >
                {e.nombre}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default BuscadorEmpresa
