import { useState, useEffect, useRef } from 'react'

// Botón "Envío" con desplegable, replicando el del sistema viejo: un solo botón
// neutro que agrupa las acciones de envío del proyecto.
function MenuEnvio({
  onNotaEnvio,
  onCargarRemito,
  onNotaExterna,
}: {
  onNotaEnvio: () => void
  onCargarRemito?: () => void // sin handler = opción deshabilitada
  onNotaExterna: () => void
}) {
  const [abierto, setAbierto] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!abierto) return
    function onDoc(e: globalThis.MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [abierto])

  function elegir(fn?: () => void) {
    setAbierto(false)
    fn?.()
  }

  return (
    <div className="envio-menu" ref={ref}>
      <button
        type="button"
        className="envio-btn"
        title="Acciones de envío"
        onClick={() => setAbierto((a) => !a)}
      >
        🚚 Envío ▾
      </button>
      {abierto && (
        <div className="envio-menu-lista">
          <button
            type="button"
            className="envio-op"
            title="Generar nota de envío para este proyecto"
            onClick={() => elegir(onNotaEnvio)}
          >
            🚚 Nota de Envío
          </button>
          <button
            type="button"
            className="envio-op"
            title={
              onCargarRemito
                ? 'Cargar un remito para este proyecto'
                : 'Todavía no está implementado'
            }
            disabled={!onCargarRemito}
            onClick={() => elegir(onCargarRemito)}
          >
            📥 Cargar Remito
          </button>
          <button
            type="button"
            className="envio-op"
            title="Registrar una nota de envío que se confeccionó fuera del sistema"
            onClick={() => elegir(onNotaExterna)}
          >
            📥 Cargar NDE externa
          </button>
        </div>
      )}
    </div>
  )
}

export default MenuEnvio
