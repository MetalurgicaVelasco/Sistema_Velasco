import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../shared/lib/supabaseClient'
import Modal from '../../shared/components/Modal'
import MenuContextual from '../../shared/components/MenuContextual'
import VistaProyectoForm from './VistaProyectoForm'
import VistaElemento from './VistaElemento'
import { fechaCorta } from './proyectoTipos'
import type { Proyecto, Empresa } from './proyectoTipos'
import type { Elemento } from './elementoTipos'
import { useEditorElemento } from './useEditorElemento'
import { contarProcesosPorElementos } from './procesosApi'
import {
  buscarProyectos,
  hayFiltrosActivos,
  FILTROS_VACIOS,
  ESTADOS_PROYECTO,
  FECHA_PRESETS,
} from './proyectosApi'
import type { FiltrosProyectos } from './proyectosApi'
import type { Navegar } from '../../shared/types/navegacion'

const BUCKET = 'proyectos-fotos'

const SELECT_ELEMENTO =
  'id, proyecto_id, parent_elemento_id, tipo, descripcion, cantidad, material_id, presentacion_mat_prima, codigo_cliente, fecha_fin_estipulada, foto_url, estado, es_retrabajo, es_dispositivo'

function fotoPublica(path: string | null): string | null {
  return path ? supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl : null
}

// Una fila del árbol ya aplanado en orden visible (para render y teclado).
type FilaArbol = { el: Elemento; nivel: number; tieneHijos: boolean; numero: number }

// Arma la jerarquía en memoria con parent_elemento_id y la aplana en el orden
// en que se ve (saltea los hijos de los nodos colapsados). Los hermanos van por id.
function construirFilasArbol(
  elementos: Elemento[],
  colapsados: Set<number>,
): FilaArbol[] {
  const hijos = new Map<number | null, Elemento[]>()
  for (const e of elementos) {
    const k = e.parent_elemento_id ?? null
    const arr = hijos.get(k)
    if (arr) arr.push(e)
    else hijos.set(k, [e])
  }
  for (const arr of hijos.values()) arr.sort((a, b) => a.id - b.id)
  const filas: FilaArbol[] = []
  const visitar = (padreId: number | null, nivel: number) => {
    ;(hijos.get(padreId) ?? []).forEach((el, i) => {
      const tieneHijos = (hijos.get(el.id) ?? []).length > 0
      filas.push({ el, nivel, tieneHijos, numero: i + 1 })
      if (tieneHijos && !colapsados.has(el.id)) visitar(el.id, nivel + 1)
    })
  }
  visitar(null, 0)
  return filas
}

function Proyectos({ onNavegar }: { onNavegar?: Navegar }) {
  const [proyectos, setProyectos] = useState<Proyecto[]>([])
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [seleccionadoId, setSeleccionadoId] = useState<number | null>(null)

  // Filtros (franja 1) + un "tick" para forzar recarga tras editar/borrar.
  const [filtros, setFiltros] = useState<FiltrosProyectos>(FILTROS_VACIOS)
  const [recargarTick, setRecargarTick] = useState(0)

  // Elementos del proyecto seleccionado (franja 3) + conteo de procesos por elemento.
  const [elementos, setElementos] = useState<Elemento[]>([])
  const [elementosCargando, setElementosCargando] = useState(false)
  const [contarProc, setContarProc] = useState<Record<number, number>>({})
  const [elementoSeleccionadoId, setElementoSeleccionadoId] = useState<number | null>(null)
  // Nodos colapsados del árbol. Vacío = todo expandido (el default acordado).
  const [colapsados, setColapsados] = useState<Set<number>>(new Set())

  // Elemento cuya vista dedicada (procesos) está abierta. Ocupa todo el módulo.
  const [elementoVista, setElementoVista] = useState<Elemento | null>(null)
  // Proyecto a mostrar en la vista de elemento cuando lo pasa el form (ej. un
  // proyecto recién creado que todavía no está en la lista).
  const [proyectoVista, setProyectoVista] = useState<Proyecto | null>(null)

  // null = lista; 'nuevo' = formulario nuevo; Proyecto = formulario editar
  const [formActivo, setFormActivo] = useState<'nuevo' | Proyecto | null>(null)

  // Borrar
  const [proyectoBorrando, setProyectoBorrando] = useState<Proyecto | null>(null)
  const [borrando, setBorrando] = useState(false)
  const [errorBorrar, setErrorBorrar] = useState<string | null>(null)

  // Refs para foco (navegación con teclado) y auto-scroll de la fila seleccionada.
  const listaProyRef = useRef<HTMLDivElement>(null)
  const listaElementoRef = useRef<HTMLDivElement>(null)
  const filaProySelRef = useRef<HTMLTableRowElement>(null)
  const filaElementoSelRef = useRef<HTMLTableRowElement>(null)

  function setF<K extends keyof FiltrosProyectos>(
    campo: K,
    valor: FiltrosProyectos[K],
  ) {
    setFiltros((f) => ({ ...f, [campo]: valor }))
  }

  // Búsqueda server-side con debounce (~250 ms) y cancelación: si cambian los
  // filtros antes de que responda, se descarta el resultado viejo.
  useEffect(() => {
    let cancelado = false
    setCargando(true)
    const t = setTimeout(async () => {
      const { data, error } = await buscarProyectos(filtros)
      if (cancelado) return
      setProyectos(data)
      setError(error)
      setCargando(false)
    }, 250)
    return () => {
      cancelado = true
      clearTimeout(t)
    }
  }, [filtros, recargarTick])

  async function cargarEmpresas() {
    const { data } = await supabase
      .from('empresas')
      .select('id, nombre')
      .order('nombre')
    setEmpresas(data ?? [])
  }

  useEffect(() => {
    cargarEmpresas()
  }, [])

  async function cargarElementos(proyectoId: number) {
    setElementosCargando(true)
    const { data } = await supabase
      .from('elementos')
      .select(SELECT_ELEMENTO)
      .eq('proyecto_id', proyectoId)
      .order('id')
    const its = (data as unknown as Elemento[]) ?? []
    setElementos(its)
    setContarProc(await contarProcesosPorElementos(its.map((i) => i.id)))
    setElementosCargando(false)
  }

  useEffect(() => {
    setElementoSeleccionadoId(null)
    setColapsados(new Set())
    if (seleccionadoId == null) {
      setElementos([])
      setContarProc({})
      return
    }
    cargarElementos(seleccionadoId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seleccionadoId])

  // Auto-scroll de la fila seleccionada al moverse con el teclado.
  useEffect(() => {
    filaProySelRef.current?.scrollIntoView({ block: 'nearest' })
  }, [seleccionadoId])
  useEffect(() => {
    filaElementoSelRef.current?.scrollIntoView({ block: 'nearest' })
  }, [elementoSeleccionadoId])

  const seleccionado = proyectos.find((p) => p.id === seleccionadoId) ?? null
  const elementoSeleccionado = elementos.find((it) => it.id === elementoSeleccionadoId) ?? null
  const filasArbol = construirFilasArbol(elementos, colapsados)

  // Editor de elementos para el "Nuevo elemento" de la franja 3 (mismo hook que
  // los hijos y el elemento actual). Al guardar, recarga los elementos del proyecto.
  const { abrirNuevo, modal: modalNuevoElem } = useEditorElemento(
    seleccionadoId ?? 0,
    () => {
      if (seleccionadoId != null) cargarElementos(seleccionadoId)
    },
  )

  function toggleColapso(id: number) {
    setColapsados((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  const fotoProyectoUrl = seleccionado ? fotoPublica(seleccionado.foto_url) : null
  const fotoElementoUrl = elementoSeleccionado ? fotoPublica(elementoSeleccionado.foto_url) : null

  function volverALista() {
    setFormActivo(null)
    setRecargarTick((t) => t + 1)
  }

  // ── Navegación con teclado (↑/↓ mueve, Enter = acción principal) ──────
  function onKeyProyectos(e: React.KeyboardEvent) {
    if (proyectos.length === 0) return
    const idx = proyectos.findIndex((p) => p.id === seleccionadoId)
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSeleccionadoId(proyectos[idx < 0 ? 0 : Math.min(idx + 1, proyectos.length - 1)].id)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSeleccionadoId(proyectos[idx < 0 ? 0 : Math.max(idx - 1, 0)].id)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (seleccionado) setFormActivo(seleccionado)
    }
  }
  function onKeyElementos(e: React.KeyboardEvent) {
    if (filasArbol.length === 0) return
    const idx = filasArbol.findIndex((f) => f.el.id === elementoSeleccionadoId)
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setElementoSeleccionadoId(
        filasArbol[idx < 0 ? 0 : Math.min(idx + 1, filasArbol.length - 1)].el.id,
      )
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setElementoSeleccionadoId(filasArbol[idx < 0 ? 0 : Math.max(idx - 1, 0)].el.id)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (elementoSeleccionado) setElementoVista(elementoSeleccionado)
    }
  }

  async function confirmarBorrado() {
    if (!proyectoBorrando) return
    setErrorBorrar(null)
    setBorrando(true)
    const { error } = await supabase
      .from('proyectos')
      .delete()
      .eq('id', proyectoBorrando.id)
    setBorrando(false)
    if (error) {
      setErrorBorrar('No se pudo borrar el proyecto.')
      return
    }
    if (seleccionadoId === proyectoBorrando.id) setSeleccionadoId(null)
    setProyectoBorrando(null)
    setRecargarTick((t) => t + 1)
  }

  return (
    <>
      {/* Formulario (alta o edición). Queda montado (oculto) si se abre un
          elemento, para no perder su estado al volver. */}
      {formActivo !== null && (
        <div style={elementoVista ? { display: 'none' } : undefined}>
          <VistaProyectoForm
            proyecto={formActivo === 'nuevo' ? null : formActivo}
            empresas={empresas}
            onCerrar={volverALista}
            onAbrirElemento={(el, proy) => {
              setElementoVista(el)
              setProyectoVista(proy ?? null)
            }}
          />
        </div>
      )}

      {/* Vista dedicada del elemento (contenido + procesos): ocupa el módulo. */}
      {elementoVista && (
        <VistaElemento
          key={elementoVista.id}
          elemento={elementoVista}
          proyecto={
            proyectoVista ??
            proyectos.find((p) => p.id === elementoVista.proyecto_id) ??
            seleccionado
          }
          onCerrar={() => {
            setElementoVista(null)
            setProyectoVista(null)
            if (seleccionadoId != null) cargarElementos(seleccionadoId)
          }}
        />
      )}

      {/* Vista de lista (4 franjas). */}
      {formActivo === null && elementoVista === null && (
        <div className="vista-franjas">
      {/* Franja 1 — Filtros */}
      <div className="franja franja-filtros">
        <div className="filtros-barra filtros-barra-proy">
          {/* Columna 1: Estado, Cliente (+ cliente final), Apellido */}
          <div className="filtros-col">
            <span className="filtro-lbl">Estado</span>
            <select
              className="filtro-input filtro-select"
              value={filtros.estado}
              onChange={(e) => setF('estado', e.target.value)}
            >
              <option value="">Todos</option>
              {ESTADOS_PROYECTO.map((es) => (
                <option key={es} value={es}>
                  {es}
                </option>
              ))}
            </select>

            <span className="filtro-lbl">Cliente</span>
            <div className="filtro-campo-col">
              <input
                className="filtro-input"
                value={filtros.cliente}
                onChange={(e) => setF('cliente', e.target.value)}
              />
              <label className="filtro-check-inline">
                <input
                  type="checkbox"
                  checked={filtros.incluirClienteFinal}
                  onChange={(e) => setF('incluirClienteFinal', e.target.checked)}
                />
                Incl. Cliente Final
              </label>
            </div>

            <span className="filtro-lbl">Apellido</span>
            <input
              className="filtro-input"
              value={filtros.apellido}
              onChange={(e) => setF('apellido', e.target.value)}
            />
          </div>

          {/* Columna 2: Nº Proyecto, Nº Pedido, Producto de Matriz (deshab.) */}
          <div className="filtros-col">
            <span className="filtro-lbl">Nº Proyecto</span>
            <input
              className="filtro-input"
              value={filtros.nroProyecto}
              onChange={(e) => setF('nroProyecto', e.target.value)}
            />

            <span className="filtro-lbl">Nº Pedido</span>
            <input
              className="filtro-input"
              value={filtros.nroPedido}
              onChange={(e) => setF('nroPedido', e.target.value)}
            />

            <span className="filtro-lbl">Prod. Matriz</span>
            <input
              className="filtro-input"
              disabled
              title="Disponible cuando exista la matriz de productos"
            />
          </div>

          {/* Columna 3: descripciones */}
          <div className="filtros-col">
            <span className="filtro-lbl">Desc. Proyecto</span>
            <input
              className="filtro-input"
              value={filtros.descProyecto}
              onChange={(e) => setF('descProyecto', e.target.value)}
            />

            <span className="filtro-lbl">Desc. Item</span>
            <input
              className="filtro-input"
              value={filtros.descItem}
              onChange={(e) => setF('descItem', e.target.value)}
            />

            <span className="filtro-lbl">Desc. Global</span>
            <input
              className="filtro-input"
              value={filtros.descGlobal}
              onChange={(e) => setF('descGlobal', e.target.value)}
            />
          </div>

          {/* Columna 4: fecha de creación */}
          <div className="filtros-col">
            <span className="filtro-lbl">Fecha creación</span>
            <select
              className="filtro-input filtro-select"
              value={filtros.fechaPreset}
              onChange={(e) => setF('fechaPreset', e.target.value)}
            >
              {FECHA_PRESETS.map((p) => (
                <option key={p.valor} value={p.valor}>
                  {p.label}
                </option>
              ))}
            </select>

            <span className="filtro-lbl">Rango inicio</span>
            <input
              type="date"
              className="filtro-input filtro-date"
              value={filtros.rangoInicio}
              disabled={filtros.fechaPreset !== 'rango'}
              onChange={(e) => setF('rangoInicio', e.target.value)}
            />

            <span className="filtro-lbl">Rango fin</span>
            <input
              type="date"
              className="filtro-input filtro-date"
              value={filtros.rangoFin}
              disabled={filtros.fechaPreset !== 'rango'}
              onChange={(e) => setF('rangoFin', e.target.value)}
            />
          </div>

          {/* Columna 5: Creado por / Responsable (deshabilitados) */}
          <div className="filtros-col">
            <span className="filtro-lbl">Creado por</span>
            <input
              className="filtro-input"
              disabled
              title="Disponible cuando se registre el usuario creador"
            />

            <span className="filtro-lbl">Responsable</span>
            <input
              className="filtro-input"
              disabled
              title="Disponible cuando se registre el responsable interno"
            />
          </div>

          {/* Columna 6: Limpiar (angosta, a todo el alto) */}
          <div className="filtros-col-limpiar">
            <button
              type="button"
              className="filtro-limpiar-alto"
              disabled={!hayFiltrosActivos(filtros)}
              onClick={() => setFiltros(FILTROS_VACIOS)}
            >
              Limpiar
            </button>
          </div>
        </div>
      </div>

      {/* Franja 2 — Lista de proyectos */}
      <div className="franja franja-lista">
        <MenuContextual
          items={(e) => {
            const fila = (e.target as HTMLElement).closest('[data-proyecto-id]')
            const id = fila ? Number(fila.getAttribute('data-proyecto-id')) : null
            const p = id != null ? proyectos.find((x) => x.id === id) : null
            return [
              ...(p ? [{ label: `Editar "${p.descripcion}"`, onSelect: () => setFormActivo(p) }] : []),
              { label: 'Nuevo proyecto', onSelect: () => setFormActivo('nuevo') },
            ]
          }}
        >
          {error ? (
            <div className="empresas-estado">{error}</div>
          ) : proyectos.length === 0 ? (
            <div className="empresas-estado">
              {cargando ? 'Buscando…' : 'No hay proyectos que coincidan.'}
            </div>
          ) : (
            <div
              className="lista-focus"
              tabIndex={0}
              ref={listaProyRef}
              onKeyDown={onKeyProyectos}
            >
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Nº</th>
                    <th>Cliente</th>
                    <th>Descripción</th>
                    <th>Estado</th>
                    <th>Urgencia</th>
                    <th>Pedido</th>
                    <th>Plazo</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {proyectos.map((p) => (
                    <tr
                      key={p.id}
                      data-proyecto-id={p.id}
                      ref={p.id === seleccionadoId ? filaProySelRef : undefined}
                      className={
                        'tabla-fila' +
                        (p.id === seleccionadoId ? ' seleccionada' : '')
                      }
                      onClick={() => {
                        setSeleccionadoId(p.id)
                        listaProyRef.current?.focus()
                      }}
                    >
                      <td>{p.id}</td>
                      <td>
                        {p.empresa?.nombre ? (
                          <span
                            className="empresa-link"
                            title="Doble click para ir a la empresa"
                            onDoubleClick={(e) => {
                              e.stopPropagation()
                              onNavegar?.(
                                {
                                  seccionId: 'empresas',
                                  moduloId: 'empresas',
                                  moduloTitulo: 'Empresas',
                                },
                                { tipo: 'empresa', empresaId: p.empresa_id },
                              )
                            }}
                          >
                            {p.empresa.nombre}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>{p.descripcion}</td>
                      <td>{p.estado}</td>
                      <td>{p.urgencia}</td>
                      <td>{p.pedido_nro ?? '—'}</td>
                      <td>{fechaCorta(p.fecha_entrega)}</td>
                      <td className="tabla-acciones">
                        <button
                          type="button"
                          className="empresas-editar"
                          onClick={(e) => {
                            e.stopPropagation()
                            setFormActivo(p)
                          }}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          className="empresas-borrar"
                          onClick={(e) => {
                            e.stopPropagation()
                            setProyectoBorrando(p)
                            setErrorBorrar(null)
                          }}
                        >
                          Borrar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </MenuContextual>
      </div>

      {/* Franja 3 — Detalle del proyecto seleccionado */}
      <div className="franja franja-detalle">
        {seleccionado ? (
          <div className="detalle detalle-proy">
            {/* Columna de fotos: proyecto arriba, elemento seleccionado abajo */}
            <div className="detalle-fotos">
              <div className="detalle-foto-wrap">
                {fotoProyectoUrl ? (
                  <img src={fotoProyectoUrl} alt="" className="detalle-foto" />
                ) : (
                  <div className="detalle-foto detalle-foto-vacia">sin foto</div>
                )}
                <span className="detalle-foto-label">Proyecto</span>
              </div>
              <div className="detalle-foto-wrap">
                {fotoElementoUrl ? (
                  <img src={fotoElementoUrl} alt="" className="detalle-foto" />
                ) : (
                  <div className="detalle-foto detalle-foto-vacia">
                    {elementoSeleccionado ? 'sin foto' : 'ítem'}
                  </div>
                )}
                <span className="detalle-foto-label">Item</span>
              </div>
            </div>

            {/* Contenido: título + tabla de elementos */}
            <MenuContextual
              items={(e) => {
                const fila = (e.target as HTMLElement).closest('[data-elemento-id]')
                const id = fila ? Number(fila.getAttribute('data-elemento-id')) : null
                const el = id != null ? elementos.find((x) => x.id === id) : null
                // Un componente es hoja (no admite hijos): "Nuevo elemento en X" se
                // refiere a su contenedor (el padre), no al componente.
                const destino =
                  el && el.tipo === 'componente'
                    ? elementos.find((x) => x.id === el.parent_elemento_id) ?? null
                    : el
                return [
                  { label: 'Nuevo elemento', onSelect: () => abrirNuevo('componente', null) },
                  ...(destino
                    ? [
                        {
                          label: `Nuevo elemento en "${destino.descripcion}"`,
                          onSelect: () => abrirNuevo('componente', destino.id),
                        },
                      ]
                    : []),
                ]
              }}
            >
              <div className="detalle-main">
              <div className="detalle-header">
                <h3 className="detalle-titulo">
                  #{seleccionado.id} — {seleccionado.descripcion}
                </h3>
              </div>
              {elementosCargando ? (
                <span className="franja-placeholder">Cargando items…</span>
              ) : elementos.length === 0 ? (
                <span className="franja-placeholder">
                  Este proyecto todavía no tiene items.
                </span>
              ) : (
                <div
                  className="lista-focus"
                  tabIndex={0}
                  ref={listaElementoRef}
                  onKeyDown={onKeyElementos}
                >
                  <table className="tabla">
                    <thead>
                      <tr>
                        <th>Nº</th>
                        <th>Tipo</th>
                        <th>Descripción</th>
                        <th>Cant.</th>
                        <th>Estado</th>
                        <th>Procesos</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {filasArbol.map((fila) => (
                        <tr
                          key={fila.el.id}
                          data-elemento-id={fila.el.id}
                          ref={
                            fila.el.id === elementoSeleccionadoId
                              ? filaElementoSelRef
                              : undefined
                          }
                          className={
                            'tabla-fila' +
                            (fila.el.id === elementoSeleccionadoId ? ' seleccionada' : '')
                          }
                          onClick={() => {
                            setElementoSeleccionadoId(fila.el.id)
                            listaElementoRef.current?.focus()
                          }}
                          onDoubleClick={() => setElementoVista(fila.el)}
                        >
                          <td>{fila.numero}</td>
                          <td>{fila.el.tipo}</td>
                          <td>
                            <span
                              className="arbol-desc"
                              style={{ paddingLeft: fila.nivel * 18 }}
                            >
                              {fila.tieneHijos ? (
                                <button
                                  type="button"
                                  className="arbol-chevron"
                                  title={
                                    colapsados.has(fila.el.id) ? 'Expandir' : 'Colapsar'
                                  }
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    toggleColapso(fila.el.id)
                                  }}
                                  onDoubleClick={(e) => e.stopPropagation()}
                                >
                                  {colapsados.has(fila.el.id) ? '▸' : '▾'}
                                </button>
                              ) : (
                                <span className="arbol-chevron-espacio" />
                              )}
                              {fila.el.descripcion}
                            </span>
                          </td>
                          <td>{fila.el.cantidad ?? 1}</td>
                          <td>{fila.el.estado}</td>
                          <td>{contarProc[fila.el.id] ?? 0} proceso(s)</td>
                          <td className="tabla-acciones">
                            <button
                              type="button"
                              className="empresas-editar"
                              onClick={(e) => {
                                e.stopPropagation()
                                setElementoVista(fila.el)
                              }}
                            >
                              Editar
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            </MenuContextual>
          </div>
        ) : (
          <span className="franja-placeholder">
            Seleccioná un proyecto para ver sus items.
          </span>
        )}
      </div>

      {/* Franja 4 — Enlazados (placeholder) */}
      <div className="franja franja-enlazados">
        <span className="franja-placeholder">Enlazados (próximamente)</span>
      </div>

      {/* Modal: borrar proyecto */}
      {proyectoBorrando && (
        <Modal titulo="Borrar proyecto" onCerrar={() => setProyectoBorrando(null)}>
          <div className="empresa-form-modal">
            <p>
              ¿Seguro que querés borrar el proyecto{' '}
              <strong>#{proyectoBorrando.id}</strong> (
              {proyectoBorrando.descripcion})? Se borran también sus items. Esta
              acción no se puede deshacer.
            </p>
            {errorBorrar && <p className="empresa-form-error">{errorBorrar}</p>}
            <div className="empresa-modal-acciones">
              <button
                type="button"
                className="empresa-boton-secundario"
                onClick={() => setProyectoBorrando(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="empresa-boton-peligro"
                onClick={confirmarBorrado}
                disabled={borrando}
              >
                {borrando ? 'Borrando…' : 'Borrar'}
              </button>
            </div>
          </div>
        </Modal>
      )}
        </div>
      )}

      {modalNuevoElem}
    </>
  )
}

export default Proyectos
