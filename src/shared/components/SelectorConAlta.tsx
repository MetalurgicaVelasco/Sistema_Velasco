import { useState } from 'react'

export type Opcion = { id: number; nombre: string }

// Valor centinela de la opción "+ Nuevo …" del desplegable.
const NUEVO = '__nuevo__'

// Desplegable de un catálogo con una opción "+ Nuevo …" AL FINAL de la lista:
// así siempre está a la vista al abrir el desplegable, sin tener que scrollear ni
// ocupar espacio con un botón al costado.
// onAgregar inserta el valor (lo hace quien lo usa) y devuelve la opción creada.
function SelectorConAlta({
  valor,
  opciones,
  onCambiar,
  onAgregar,
  placeholderNuevo = 'Nuevo valor',
}: {
  valor: number | null
  opciones: Opcion[]
  onCambiar: (id: number | null) => void
  onAgregar: (nombre: string) => Promise<Opcion | null>
  placeholderNuevo?: string
}) {
  const [agregando, setAgregando] = useState(false)
  const [nuevo, setNuevo] = useState('')
  const [guardando, setGuardando] = useState(false)

  async function confirmar() {
    const nombre = nuevo.trim()
    if (nombre === '') return
    setGuardando(true)
    const creada = await onAgregar(nombre)
    setGuardando(false)
    if (creada) {
      onCambiar(creada.id)
      setNuevo('')
      setAgregando(false)
    }
  }

  if (agregando) {
    return (
      <div className="selector-alta">
        <input
          className="empresa-input"
          placeholder={placeholderNuevo}
          value={nuevo}
          autoFocus
          onChange={(e) => setNuevo(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              confirmar()
            }
          }}
        />
        <button
          type="button"
          className="empresa-boton"
          onClick={confirmar}
          disabled={guardando}
        >
          {guardando ? '…' : 'Agregar'}
        </button>
        <button
          type="button"
          className="empresa-boton-secundario"
          onClick={() => {
            setAgregando(false)
            setNuevo('')
          }}
        >
          Cancelar
        </button>
      </div>
    )
  }

  return (
    <select
      className="empresa-input"
      value={valor ?? ''}
      onChange={(e) => {
        if (e.target.value === NUEVO) {
          setAgregando(true)
          return
        }
        onCambiar(e.target.value ? Number(e.target.value) : null)
      }}
    >
      <option value="">— Ninguno —</option>
      {opciones.map((o) => (
        <option key={o.id} value={o.id}>
          {o.nombre}
        </option>
      ))}
      {/* Última opción: siempre visible al abrir, no hay que scrollear. */}
      <option value={NUEVO}>+ {placeholderNuevo}…</option>
    </select>
  )
}

export default SelectorConAlta
