import { useState, useEffect } from 'react'

type ItemMenu = {
  label: string
  onSelect: () => void
}

// Menú contextual reutilizable: envolvé cualquier contenido y, al hacer
// click derecho sobre él, aparece un menú chico con las acciones que le pases.
function MenuContextual({
  items,
  children,
}: {
  items: ItemMenu[] | ((e: React.MouseEvent) => ItemMenu[])
  children: React.ReactNode
}) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const [itemsResueltos, setItemsResueltos] = useState<ItemMenu[]>([])

  function abrir(e: React.MouseEvent) {
    e.preventDefault()
    // Si items es una función, se evalúa con el evento del clic derecho (permite
    // armar opciones según sobre qué se clickeó). Si es un array, se usa tal cual.
    setItemsResueltos(typeof items === 'function' ? items(e) : items)
    setPos({ x: e.clientX, y: e.clientY })
  }

  // Cerrar el menú al clickear en cualquier lado, hacer scroll o apretar Escape.
  useEffect(() => {
    if (!pos) return
    function cerrar() {
      setPos(null)
    }
    function onTecla(e: KeyboardEvent) {
      if (e.key === 'Escape') setPos(null)
    }
    window.addEventListener('click', cerrar)
    window.addEventListener('scroll', cerrar, true)
    window.addEventListener('contextmenu', cerrar)
    window.addEventListener('keydown', onTecla)
    return () => {
      window.removeEventListener('click', cerrar)
      window.removeEventListener('scroll', cerrar, true)
      window.removeEventListener('contextmenu', cerrar)
      window.removeEventListener('keydown', onTecla)
    }
  }, [pos])

  return (
    <div className="menu-ctx-zona" onContextMenu={abrir}>
      {children}
      {pos && (
        <ul className="menu-ctx" style={{ top: pos.y, left: pos.x }}>
          {itemsResueltos.map((it, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={() => {
                  it.onSelect()
                  setPos(null)
                }}
              >
                {it.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default MenuContextual
