import { useEffect, useState } from 'react'
import { supabase } from '../../shared/lib/supabaseClient'
import MenuContextual from '../../shared/components/MenuContextual'
import ModalElementoMatriz from './ModalElementoMatriz'
import ModalAgregarExistente from './ModalAgregarExistente'
import VistaElementoMatriz from './VistaElementoMatriz'
import { tipoLabel } from './elementosApi'
import { contiene } from '../../shared/lib/texto'
import {
  cargarMatriz,
  cargarComposicion,
  quitarHijo,
  desactivarElementoMatriz,
  type ClienteNodo,
  type ElementoMatriz,
  type HijoComposicion,
} from './matrizApi'

const BUCKET = 'proyectos-fotos'
const BUCKET_LOGOS = 'empresas-logos' // los logos de empresa viven en otro bucket

// Matriz de Productos: el catálogo de piezas, agrupado por dónde se instala cada
// una (Cliente → Sector → Equipo) y desplegable por su composición.
//
// Una pieza es REUTILIZABLE: el mismo componente puede estar en varios conjuntos,
// con cantidades distintas. Por eso los hijos se cargan por composición, no por
// un `parent_id` en la fila.
function Matriz() {
  const [clientes, setClientes] = useState<ClienteNodo[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filtros
  const [busqueda, setBusqueda] = useState('')
  const [codigos, setCodigos] = useState('')
  const [filtroCliente, setFiltroCliente] = useState<number | ''>('')
  const [filtroSector, setFiltroSector] = useState<number | ''>('')
  const [filtroEquipo, setFiltroEquipo] = useState<number | ''>('')
  const [filtroTipo, setFiltroTipo] = useState<string>('')

  // Nodos expandidos y composición cargada (lazy). La clave del elemento incluye
  // la ruta, porque la misma pieza puede aparecer en varios lugares del árbol.
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set())
  const [composicion, setComposicion] = useState<Record<number, HijoComposicion[]>>({})

  // Modales
  const [modalElem, setModalElem] = useState<
    { elemento: ElementoMatriz | null; padre: { id: number; tipo: string } | null } | null
  >(null)
  const [modalExistente, setModalExistente] = useState<{ id: number; tipo: string } | null>(null)
  // Pieza abierta en su vista de detalle (espejo de VistaElemento en proyectos).
  const [elementoAbierto, setElementoAbierto] = useState<ElementoMatriz | null>(null)

  async function recargar() {
    setCargando(true)
    try {
      setClientes(await cargarMatriz())
      setComposicion({})
      setAbiertos(new Set()) // al recargar, todo colapsado
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar la matriz.')
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    recargar()
  }, [])

  async function toggle(clave: string, elementoId?: number) {
    const abriendo = !abiertos.has(clave)
    setAbiertos((prev) => {
      const n = new Set(prev)
      if (n.has(clave)) n.delete(clave)
      else n.add(clave)
      return n
    })
    if (abriendo && elementoId != null && !composicion[elementoId]) {
      const hijos = await cargarComposicion(elementoId)
      setComposicion((prev) => ({ ...prev, [elementoId]: hijos }))
    }
  }

  function fotoUrl(path: string | null): string | null {
    return path ? supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl : null
  }
  function logoUrl(path: string | null): string | null {
    return path ? supabase.storage.from(BUCKET_LOGOS).getPublicUrl(path).data.publicUrl : null
  }

  function pasaElemento(el: ElementoMatriz): boolean {
    if (filtroTipo && el.tipo !== filtroTipo) return false
    if (busqueda.trim() && !contiene(el.descripcion, busqueda)) return false
    if (codigos.trim() && !contiene(`${el.codigo_cliente ?? ''} ${el.id}`, codigos)) return false
    return true
  }

  const vista = clientes
    .filter((c) => filtroCliente === '' || c.id === filtroCliente)
    .map((c) => ({
      ...c,
      sectores: c.sectores
        .filter((s) => filtroSector === '' || s.id === filtroSector)
        .map((s) => ({
          ...s,
          equipos: s.equipos
            .filter((e) => filtroEquipo === '' || e.id === filtroEquipo)
            .map((e) => ({ ...e, elementos: e.elementos.filter(pasaElemento) }))
            .filter((e) => e.elementos.length > 0),
        }))
        .filter((s) => s.equipos.length > 0),
    }))
    .filter((c) => c.sectores.length > 0)

  const sectoresDelCliente = filtroCliente === '' ? [] : (clientes.find((c) => c.id === filtroCliente)?.sectores ?? [])
  const equiposDelSector =
    filtroSector === '' ? [] : (sectoresDelCliente.find((s) => s.id === filtroSector)?.equipos ?? [])

  const hayFiltros =
    busqueda.trim() !== '' || codigos.trim() !== '' || filtroCliente !== '' || filtroSector !== '' || filtroTipo !== ''

  function limpiar() {
    setBusqueda('')
    setCodigos('')
    setFiltroCliente('')
    setFiltroSector('')
    setFiltroEquipo('')
    setFiltroTipo('')
  }

  async function sacarDelConjunto(h: HijoComposicion, padreId: number) {
    if (!window.confirm(`¿Sacar "${h.descripcion}" de este conjunto? La pieza sigue en el catálogo.`)) return
    await quitarHijo(h.composicionId)
    const hijos = await cargarComposicion(padreId)
    setComposicion((prev) => ({ ...prev, [padreId]: hijos }))
  }

  async function desactivar(el: ElementoMatriz) {
    if (!window.confirm(`¿Dar de baja "${el.descripcion}" del catálogo?`)) return
    try {
      await desactivarElementoMatriz(el.id)
      recargar()
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'No se pudo dar de baja.')
    }
  }

  // Cada pieza es una tarjeta. Al expandirse, sus hijos van dentro de un recuadro
  // interior con fondo tenue: así se ve el nivel de anidamiento (como el viejo).
  function NodoElemento({
    el,
    ruta,
    padreId,
    cantidad,
    composicionId,
  }: {
    el: ElementoMatriz
    ruta: string
    padreId: number | null
    cantidad?: number
    composicionId?: number
  }) {
    const clave = `${ruta}/${el.id}`
    const abierto = abiertos.has(clave)
    const esHoja = el.tipo === 'componente'
    const hijos = composicion[el.id] ?? []
    const foto = fotoUrl(el.foto_url)

    return (
      <div className="mtz-card" data-elemento-id={el.id}>
        <div
          className="mtz-fila"
          title="Doble click para abrir"
          onDoubleClick={() => setElementoAbierto(el)}
          onClick={() => (esHoja ? undefined : toggle(clave, el.id))}
        >
          {esHoja ? <span className="mtz-espacio" /> : <button className="mtz-toggle">{abierto ? '▼' : '▶'}</button>}
          <span className="mtz-emoji mtz-emoji-nivel">🔧</span>
          {foto ? (
            <img src={foto} alt="" className="mtz-foto mtz-foto-elemento" onError={(e) => (e.currentTarget.style.display = 'none')} />
          ) : null}
          <div className="mtz-cuerpo">
            <div className="mtz-titulo">{el.descripcion}</div>
            <div className="mtz-meta">
              {tipoLabel(el.tipo)}
              {cantidad != null ? ` · ×${cantidad} en este conjunto` : ''}
              {el.codigo_cliente ? ` · ${el.codigo_cliente}` : ''}
            </div>
          </div>
          <span className="mtz-acciones" onClick={(e) => e.stopPropagation()}>
            {!esHoja ? (
              <>
                <button className="mtz-btn" onClick={() => setModalElem({ elemento: null, padre: { id: el.id, tipo: el.tipo } })}>
                  + Nuevo
                </button>
                <button className="mtz-btn" onClick={() => setModalExistente({ id: el.id, tipo: el.tipo })}>
                  + Existente
                </button>
              </>
            ) : null}
            <button className="mtz-btn" onClick={() => setModalElem({ elemento: el, padre: null })}>
              Editar
            </button>
            {composicionId != null && padreId != null ? (
              <button className="mtz-btn mtz-btn-x" onClick={() => sacarDelConjunto({ ...el, cantidad: cantidad ?? 1, composicionId }, padreId)}>
                Sacar
              </button>
            ) : (
              <button className="mtz-btn mtz-btn-x" onClick={() => desactivar(el)}>
                Baja
              </button>
            )}
          </span>
        </div>
        {abierto ? (
          <div className="mtz-hijos mtz-hijos-nivel">
            {hijos.length === 0 ? (
              <div className="mtz-sin-hijos">Sin elementos adentro.</div>
            ) : (
              hijos.map((h) => (
                <NodoElemento
                  key={h.composicionId}
                  el={h}
                  ruta={clave}
                  padreId={el.id}
                  cantidad={h.cantidad}
                  composicionId={h.composicionId}
                />
              ))
            )}
          </div>
        ) : null}
      </div>
    )
  }

  function itemsMenu() {
    return [{ label: 'Nuevo elemento', onSelect: () => setModalElem({ elemento: null, padre: null }) }]
  }

  if (elementoAbierto) {
    return (
      <VistaElementoMatriz
        elemento={elementoAbierto}
        onCerrar={() => {
          setElementoAbierto(null)
          recargar()
        }}
      />
    )
  }

  return (
    <div className="mtz-vista">
      {/* Filtros: mismo patrón que Empresas — grilla título + campo por columna */}
      <div className="franja franja-filtros">
        <div className="filtros-barra">
          <div className="filtros-col">
            <span className="filtro-lbl">Buscar</span>
            <input className="filtro-input" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
            <span className="filtro-lbl">Códigos</span>
            <input className="filtro-input" value={codigos} onChange={(e) => setCodigos(e.target.value)} />
          </div>

          <div className="filtros-col">
            <span className="filtro-lbl">Cliente</span>
            <select
              className="filtro-input"
              value={filtroCliente}
              onChange={(e) => {
                setFiltroCliente(e.target.value === '' ? '' : Number(e.target.value))
                setFiltroSector('')
                setFiltroEquipo('')
              }}
            >
              <option value="">Todos</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
            <span className="filtro-lbl">Sector</span>
            <select
              className="filtro-input"
              value={filtroSector}
              disabled={filtroCliente === ''}
              onChange={(e) => {
                setFiltroSector(e.target.value === '' ? '' : Number(e.target.value))
                setFiltroEquipo('')
              }}
            >
              <option value="">Todos</option>
              {sectoresDelCliente.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre}
                </option>
              ))}
            </select>
          </div>

          <div className="filtros-col">
            <span className="filtro-lbl">Equipo</span>
            <select
              className="filtro-input"
              value={filtroEquipo}
              disabled={filtroSector === ''}
              onChange={(e) => setFiltroEquipo(e.target.value === '' ? '' : Number(e.target.value))}
            >
              <option value="">Todos</option>
              {equiposDelSector.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nombre}
                </option>
              ))}
            </select>
            <span className="filtro-lbl">Tipo</span>
            <select className="filtro-input" value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)}>
              <option value="">Todos</option>
              <option value="conjunto">Conjunto</option>
              <option value="subconjunto">Subconjunto</option>
              <option value="componente">Componente</option>
            </select>
          </div>

          <div className="mtz-filtros-acciones">
            <button className="empresa-boton" onClick={() => setModalElem({ elemento: null, padre: null })}>
              + Nuevo elemento
            </button>
            {hayFiltros ? (
              <button className="empresa-boton-secundario" onClick={limpiar}>
                ✕ Limpiar
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mtz-lista">
        <MenuContextual items={itemsMenu}>
          {cargando ? (
            <div className="rec-vacio">Cargando…</div>
          ) : error ? (
            <div className="empresa-form-error">{error}</div>
          ) : vista.length === 0 ? (
            <div className="rec-vacio">
              {clientes.length === 0
                ? 'No hay elementos cargados en la matriz. Apretá "+ Nuevo elemento" para empezar.'
                : 'No hay elementos que coincidan con los filtros.'}
            </div>
          ) : (
            vista.map((c) => {
              const claveC = `c-${c.id}`
              const abiertoC = abiertos.has(claveC)
              const fotoCli = logoUrl(c.fotoUrl)
              return (
                <div key={c.id} className="mtz-card">
                  <div className="mtz-fila" onClick={() => toggle(claveC)}>
                    <button className="mtz-toggle">{abiertoC ? '▼' : '▶'}</button>
                    <span className="mtz-emoji mtz-emoji-cliente">🏢</span>
                    {fotoCli ? (
                      <img src={fotoCli} alt="" className="mtz-foto" onError={(e) => (e.currentTarget.style.display = 'none')} />
                    ) : null}
                    <div className="mtz-cuerpo">
                      <div className="mtz-titulo mtz-titulo-cliente">
                        {c.nombre}
                        {c.codigo ? <span className="mtz-chip">{c.codigo}</span> : null}
                      </div>
                      <div className="mtz-meta">{c.totalElementos} elemento(s)</div>
                    </div>
                  </div>
                  {abiertoC ? (
                    <div className="mtz-hijos mtz-hijos-cliente">
                      {c.sectores.map((sec) => {
                        const claveS = `${claveC}/s-${sec.id}`
                        const abiertoS = abiertos.has(claveS)
                        return (
                          <div key={sec.id} className="mtz-card">
                            <div className="mtz-fila mtz-fila-compacta" onClick={() => toggle(claveS)}>
                              <button className="mtz-toggle">{abiertoS ? '▼' : '▶'}</button>
                              <span className="mtz-emoji mtz-emoji-compacto">🏭</span>
                              <div className="mtz-cuerpo">
                                <div className="mtz-titulo">{sec.nombre}</div>
                              </div>
                            </div>
                            {abiertoS ? (
                              <div className="mtz-hijos mtz-hijos-nivel">
                                {sec.equipos.map((eq) => {
                                  const claveE = `${claveS}/e-${eq.id}`
                                  const abiertoE = abiertos.has(claveE)
                                  return (
                                    <div key={eq.id} className="mtz-card">
                                      <div className="mtz-fila mtz-fila-compacta" onClick={() => toggle(claveE)}>
                                        <button className="mtz-toggle">{abiertoE ? '▼' : '▶'}</button>
                                        <span className="mtz-emoji mtz-emoji-compacto">🤖</span>
                                        <div className="mtz-cuerpo">
                                          <div className="mtz-titulo">
                                            {eq.nombre}
                                            <span className="mtz-contador">{eq.elementos.length} elemento(s)</span>
                                          </div>
                                        </div>
                                      </div>
                                      {abiertoE ? (
                                        <div className="mtz-hijos mtz-hijos-nivel">
                                          {eq.elementos.map((el) => (
                                            <NodoElemento key={el.id} el={el} ruta={claveE} padreId={null} />
                                          ))}
                                        </div>
                                      ) : null}
                                    </div>
                                  )
                                })}
                              </div>
                            ) : null}
                          </div>
                        )
                      })}
                    </div>
                  ) : null}
                </div>
              )
            })
          )}
        </MenuContextual>
      </div>

      {modalElem && (
        <ModalElementoMatriz
          elemento={modalElem.elemento}
          padre={modalElem.padre}
          onGuardado={() => {
            setModalElem(null)
            recargar()
          }}
          onCancelar={() => setModalElem(null)}
        />
      )}

      {modalExistente && (
        <ModalAgregarExistente
          padre={modalExistente}
          onAgregado={async () => {
            const padreId = modalExistente.id
            setModalExistente(null)
            const hijos = await cargarComposicion(padreId)
            setComposicion((prev) => ({ ...prev, [padreId]: hijos }))
          }}
          onCancelar={() => setModalExistente(null)}
        />
      )}
    </div>
  )
}

export default Matriz
