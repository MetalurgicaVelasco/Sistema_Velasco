import { useState } from 'react'

// Combo multi-selección con búsqueda: muestra chips de lo elegido + un input
// que filtra las opciones restantes en un desplegable. Al elegir una opción se
// agrega como chip; la × del chip la quita. Genérico sobre ids numéricos.
export type OpcionCombo = { id: number; label: string }

function ComboMultiBuscable({
  opciones,
  seleccionados,
  onAgregar,
  onQuitar,
  placeholder = 'Escribir para buscar…',
}: {
  opciones: OpcionCombo[]
  seleccionados: number[]
  onAgregar: (id: number) => void
  onQuitar: (id: number) => void
  placeholder?: string
}) {
  const [query, setQuery] = useState('')
  const [abierto, setAbierto] = useState(false)

  const set = new Set(seleccionados)
  const q = query.trim().toLowerCase()
  const chips = opciones.filter((o) => set.has(o.id))
  const coincidencias = opciones.filter(
    (o) => !set.has(o.id) && o.label.toLowerCase().includes(q),
  )

  return (
    <div className="cmb">
      <div className="cmb-caja">
        {chips.map((o) => (
          <span key={o.id} className="cmb-chip">
            {o.label}
            <button
              type="button"
              className="cmb-chip-x"
              onClick={() => onQuitar(o.id)}
              aria-label={`Quitar ${o.label}`}
            >
              ×
            </button>
          </span>
        ))}
        <input
          className="cmb-input"
          value={query}
          placeholder={chips.length ? 'Agregar otro…' : placeholder}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setAbierto(true)}
          onBlur={() => setTimeout(() => setAbierto(false), 150)}
        />
      </div>
      {abierto && (
        <div className="cmb-drop">
          {coincidencias.length === 0 ? (
            <div className="cmb-vacio">No hay opciones para mostrar.</div>
          ) : (
            coincidencias.map((o) => (
              <div
                key={o.id}
                className="cmb-opt"
                // onMouseDown (no onClick) para que dispare antes del onBlur.
                onMouseDown={() => {
                  onAgregar(o.id)
                  setQuery('')
                }}
              >
                {o.label}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

export default ComboMultiBuscable
