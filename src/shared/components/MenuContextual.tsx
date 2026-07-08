import { useState, useEffect, useRef } from 'react'

type ItemMenu = {
  label: string
  onSelect?: () => void
  // Si tiene subItems, al pasar el cursor se despliega un submenú al costado.
  subItems?: ItemMenu[]
}

// Menú contextual reutilizable: envolvé cualquier contenido y, al hacer
// click derecho sobre él, aparece un menú chico con las acciones que le pases.
// `items` puede ser un array fijo o una función del evento (para armar las
// opciones según sobre qué se clickeó). Soporta un nivel de submenú.
function MenuContextual({
  items,
  children,
}: {
  items: ItemMenu[] | ((e: React.MouseEvent) => ItemMenu[])
  children: React.ReactNode
}) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const [itemsResueltos, setItemsResueltos] = useState<ItemMenu[]>([])
  const [abiertoIdx, setAbiertoIdx] = useState<number | null>(null)
  const [subIzquierda, setSubIzquierda] = useState(false)
  const [subOffsetY, setSubOffsetY] = useState(0)
  const subRef = useRef<HTMLUListElement>(null)
  const menuRef = useRef<HTMLUListElement>(null)

  // Si el menú se sale de la pantalla, lo corre hacia adentro (se mide después de
  // pintarlo, cuando ya se conoce su tamaño real).
  useEffect(() => {
    if (!pos || !menuRef.current) return
    const r = menuRef.current.getBoundingClientRect()
    const margen = 6
    let { x, y } = pos
    if (r.right > window.innerWidth) x = Math.max(margen, window.innerWidth - r.width - margen)
    if (r.bottom > window.innerHeight) y = Math.max(margen, window.innerHeight - r.height - margen)
    if (x !== pos.x || y !== pos.y) setPos({ x, y })
  }, [pos])

  function abrir(e: React.MouseEvent) {
    e.preventDefault()
    // Cierra cualquier otro menú contextual abierto (los que ya tienen su listener
    // registrado); este todavía no lo tiene, así que no se cierra a sí mismo.
    window.dispatchEvent(new Event('menuctx-abrir'))
    setItemsResueltos(typeof items === 'function' ? items(e) : items)
    setAbiertoIdx(null)
    setPos({ x: e.clientX, y: e.clientY })
  }

  // Cerrar el menú al clickear en cualquier lado, hacer scroll, apretar Escape,
  // o cuando se abre otro menú contextual.
  useEffect(() => {
    if (!pos) return
    function cerrar() {
      setPos(null)
      setAbiertoIdx(null)
    }
    function onTecla(e: KeyboardEvent) {
      if (e.key === 'Escape') cerrar()
    }
    window.addEventListener('click', cerrar)
    window.addEventListener('scroll', cerrar, true)
    window.addEventListener('menuctx-abrir', cerrar)
    window.addEventListener('keydown', onTecla)
    return () => {
      window.removeEventListener('click', cerrar)
      window.removeEventListener('scroll', cerrar, true)
      window.removeEventListener('menuctx-abrir', cerrar)
      window.removeEventListener('keydown', onTecla)
    }
  }, [pos])

  // Si el submenú se sale por abajo, lo sube lo justo para que entre en pantalla.
  useEffect(() => {
    if (abiertoIdx == null) {
      setSubOffsetY(0)
      return
    }
    const el = subRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const margen = 6
    // r.bottom ya incluye el offset actual: se calcula el excedente sobre el borde.
    const excedente = r.bottom - (window.innerHeight - margen)
    if (excedente > 0) setSubOffsetY((prev) => prev - excedente)
  }, [abiertoIdx])

  function elegir(it: ItemMenu) {
    if (it.subItems) return // los que tienen submenú no hacen nada al click
    it.onSelect?.()
    setPos(null)
    setAbiertoIdx(null)
  }

  return (
    <div className="menu-ctx-zona" onContextMenu={abrir}>
      {children}
      {pos && (
        <ul className="menu-ctx" ref={menuRef} style={{ top: pos.y, left: pos.x }}>
          {itemsResueltos.map((it, i) => (
            <li
              key={i}
              className={it.subItems ? 'menu-ctx-con-sub' : undefined}
              onMouseEnter={(ev) => {
                if (!it.subItems) {
                  setAbiertoIdx(null)
                  return
                }
                // Si no hay lugar a la derecha, el submenú se abre hacia la izquierda.
                const r = (ev.currentTarget as HTMLElement).getBoundingClientRect()
                setSubIzquierda(window.innerWidth - r.right < 180)
                setSubOffsetY(0)
                setAbiertoIdx(i)
              }}
            >
              <button type="button" onClick={() => elegir(it)}>
                {it.label}
                {it.subItems ? <span className="menu-ctx-flecha">▸</span> : null}
              </button>
              {it.subItems && abiertoIdx === i && (
                <ul
                  className={`menu-ctx menu-ctx-sub${subIzquierda ? ' izq' : ''}`}
                  ref={subRef}
                  style={{ top: subOffsetY }}
                >
                  {it.subItems.map((sub, j) => (
                    <li key={j}>
                      <button type="button" onClick={() => elegir(sub)}>
                        {sub.label}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default MenuContextual
