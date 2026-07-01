import { useEffect, useRef, type ReactNode } from 'react'

type ModalProps = {
  titulo: string
  onCerrar: () => void
  children: ReactNode // lo que se ponga entre <Modal> y </Modal>
  ancho?: number // ancho del modal en px (default 420, definido en CSS)
}

// Modal estándar del sistema. Cumple los 3 requisitos fijados en ARQUITECTURA:
//  1. NO se cierra al clickear afuera (solo con la ×, Cancelar o Esc).
//  2. Se arrastra tomándolo de la barra de título.
//  3. El header con la × queda fijo; solo el cuerpo scrollea.
function Modal({ titulo, onCerrar, children, ancho }: ModalProps) {
  const cajaRef = useRef<HTMLDivElement>(null)
  const pos = useRef({ x: 0, y: 0 })

  // Cerrar con Esc.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCerrar()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onCerrar])

  // Arrastrar tomando el header. No arrastra si el click cae en un botón (la ×).
  function onHeaderMouseDown(e: React.MouseEvent) {
    if ((e.target as HTMLElement).closest('button')) return
    e.preventDefault()
    const startX = e.clientX
    const startY = e.clientY
    const inicial = { ...pos.current }
    function onMove(ev: MouseEvent) {
      pos.current = {
        x: inicial.x + (ev.clientX - startX),
        y: inicial.y + (ev.clientY - startY),
      }
      if (cajaRef.current) {
        cajaRef.current.style.transform = `translate(${pos.current.x}px, ${pos.current.y}px)`
      }
    }
    function onUp() {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  return (
    <div className="modal-overlay">
      <div
        className="modal-caja"
        ref={cajaRef}
        style={ancho ? { width: ancho } : undefined}
      >
        <div className="modal-header" onMouseDown={onHeaderMouseDown}>
          <h3 className="modal-titulo">{titulo}</h3>
          <button type="button" className="modal-cerrar" onClick={onCerrar}>
            ×
          </button>
        </div>
        <div className="modal-cuerpo">{children}</div>
      </div>
    </div>
  )
}

export default Modal
