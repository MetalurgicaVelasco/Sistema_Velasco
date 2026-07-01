import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../shared/lib/supabaseClient'
import Modal from '../../shared/components/Modal'
import MenuContextual from '../../shared/components/MenuContextual'
import VistaProyectoForm from './VistaProyectoForm'
import VistaItem from './VistaItem'
import { fechaCorta } from './proyectoTipos'
import type { Proyecto, Empresa } from './proyectoTipos'
import type { Item } from './itemTipos'
import { contarProcesosPorItems } from './procesosApi'
import type { Navegar } from '../../shared/types/navegacion'

const BUCKET = 'proyectos-fotos'

const SELECT_ITEM =
  'id, proyecto_id, tipo, descripcion, cantidad, material_id, presentacion_mat_prima, codigo_cliente, fecha_fin_estipulada, foto_url, estado, es_retrabajo, es_dispositivo'

const SELECT_PROYECTO =
  'id, empresa_id, contacto_id, pedido_nro, descripcion, urgencia, estado, sub_estado_cerrado, fecha_ingreso, fecha_entrega, fecha_limite_cotizar, plazo_dias_habiles, paso_por_solicitud, observaciones_mail, observaciones_anulacion, cliente_final_empresa_id, cliente_final_texto, moneda, oc_cliente, foto_url, empresa:empresas!empresa_id ( nombre )'

function fotoPublica(path: string | null): string | null {
  return path ? supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl : null
}

function Proyectos({ onNavegar }: { onNavegar?: Navegar }) {
  const [proyectos, setProyectos] = useState<Proyecto[]>([])
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [seleccionadoId, setSeleccionadoId] = useState<number | null>(null)

  // Items del proyecto seleccionado (franja 3) + conteo de procesos por item.
  const [items, setItems] = useState<Item[]>([])
  const [itemsCargando, setItemsCargando] = useState(false)
  const [contarProc, setContarProc] = useState<Record<number, number>>({})
  const [itemSeleccionadoId, setItemSeleccionadoId] = useState<number | null>(null)

  // Item cuya vista dedicada (procesos) está abierta. Ocupa todo el módulo.
  const [itemVista, setItemVista] = useState<Item | null>(null)

  // null = lista; 'nuevo' = formulario nuevo; Proyecto = formulario editar
  const [formActivo, setFormActivo] = useState<'nuevo' | Proyecto | null>(null)

  // Borrar
  const [proyectoBorrando, setProyectoBorrando] = useState<Proyecto | null>(null)
  const [borrando, setBorrando] = useState(false)
  const [errorBorrar, setErrorBorrar] = useState<string | null>(null)

  // Refs para foco (navegación con teclado) y auto-scroll de la fila seleccionada.
  const listaProyRef = useRef<HTMLDivElement>(null)
  const listaItemRef = useRef<HTMLDivElement>(null)
  const filaProySelRef = useRef<HTMLTableRowElement>(null)
  const filaItemSelRef = useRef<HTMLTableRowElement>(null)

  async function cargarProyectos() {
    setCargando(true)
    setError(null)
    const { data, error } = await supabase
      .from('proyectos')
      .select(SELECT_PROYECTO)
      .order('id', { ascending: false })
    if (error) {
      setError('No se pudieron cargar los proyectos.')
      setCargando(false)
      return
    }
    setProyectos((data as unknown as Proyecto[]) ?? [])
    setCargando(false)
  }

  async function cargarEmpresas() {
    const { data } = await supabase
      .from('empresas')
      .select('id, nombre')
      .order('nombre')
    setEmpresas(data ?? [])
  }

  useEffect(() => {
    cargarProyectos()
    cargarEmpresas()
  }, [])

  async function cargarItems(proyectoId: number) {
    setItemsCargando(true)
    const { data } = await supabase
      .from('items')
      .select(SELECT_ITEM)
      .eq('proyecto_id', proyectoId)
      .order('id')
    const its = (data as unknown as Item[]) ?? []
    setItems(its)
    setContarProc(await contarProcesosPorItems(its.map((i) => i.id)))
    setItemsCargando(false)
  }

  useEffect(() => {
    setItemSeleccionadoId(null)
    if (seleccionadoId == null) {
      setItems([])
      setContarProc({})
      return
    }
    cargarItems(seleccionadoId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seleccionadoId])

  // Auto-scroll de la fila seleccionada al moverse con el teclado.
  useEffect(() => {
    filaProySelRef.current?.scrollIntoView({ block: 'nearest' })
  }, [seleccionadoId])
  useEffect(() => {
    filaItemSelRef.current?.scrollIntoView({ block: 'nearest' })
  }, [itemSeleccionadoId])

  const seleccionado = proyectos.find((p) => p.id === seleccionadoId) ?? null
  const itemSeleccionado = items.find((it) => it.id === itemSeleccionadoId) ?? null
  const fotoProyectoUrl = seleccionado ? fotoPublica(seleccionado.foto_url) : null
  const fotoItemUrl = itemSeleccionado ? fotoPublica(itemSeleccionado.foto_url) : null

  function volverALista() {
    setFormActivo(null)
    cargarProyectos()
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
  function onKeyItems(e: React.KeyboardEvent) {
    if (items.length === 0) return
    const idx = items.findIndex((it) => it.id === itemSeleccionadoId)
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setItemSeleccionadoId(items[idx < 0 ? 0 : Math.min(idx + 1, items.length - 1)].id)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setItemSeleccionadoId(items[idx < 0 ? 0 : Math.max(idx - 1, 0)].id)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (itemSeleccionado) setItemVista(itemSeleccionado)
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
    cargarProyectos()
  }

  // Vista dedicada del item (procesos): ocupa todo el módulo.
  if (itemVista) {
    return (
      <VistaItem
        item={itemVista}
        proyecto={
          proyectos.find((p) => p.id === itemVista.proyecto_id) ?? seleccionado
        }
        onCerrar={() => {
          setItemVista(null)
          if (seleccionadoId != null) cargarItems(seleccionadoId)
        }}
      />
    )
  }

  // Vista de formulario (alta o edición): ocupa todo el módulo.
  if (formActivo !== null) {
    return (
      <VistaProyectoForm
        proyecto={formActivo === 'nuevo' ? null : formActivo}
        empresas={empresas}
        onCerrar={volverALista}
      />
    )
  }

  // Vista de lista (4 franjas).
  return (
    <div className="vista-franjas">
      {/* Franja 1 — Filtros (placeholder) */}
      <div className="franja franja-filtros">
        <span className="franja-placeholder">Filtros (próximamente)</span>
      </div>

      {/* Franja 2 — Lista de proyectos */}
      <div className="franja franja-lista">
        <MenuContextual
          items={[
            { label: 'Nuevo proyecto', onSelect: () => setFormActivo('nuevo') },
          ]}
        >
          {cargando ? (
            <div className="empresas-estado">Cargando proyectos…</div>
          ) : error ? (
            <div className="empresas-estado">{error}</div>
          ) : proyectos.length === 0 ? (
            <p className="empresas-vacio">No hay proyectos cargados todavía.</p>
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
            {/* Columna de fotos: proyecto arriba, item seleccionado abajo */}
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
                {fotoItemUrl ? (
                  <img src={fotoItemUrl} alt="" className="detalle-foto" />
                ) : (
                  <div className="detalle-foto detalle-foto-vacia">
                    {itemSeleccionado ? 'sin foto' : 'ítem'}
                  </div>
                )}
                <span className="detalle-foto-label">Item</span>
              </div>
            </div>

            {/* Contenido: título + tabla de items */}
            <div className="detalle-main">
              <div className="detalle-header">
                <h3 className="detalle-titulo">
                  #{seleccionado.id} — {seleccionado.descripcion}
                </h3>
              </div>
              {itemsCargando ? (
                <span className="franja-placeholder">Cargando items…</span>
              ) : items.length === 0 ? (
                <span className="franja-placeholder">
                  Este proyecto todavía no tiene items.
                </span>
              ) : (
                <div
                  className="lista-focus"
                  tabIndex={0}
                  ref={listaItemRef}
                  onKeyDown={onKeyItems}
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
                      {items.map((it) => (
                        <tr
                          key={it.id}
                          ref={it.id === itemSeleccionadoId ? filaItemSelRef : undefined}
                          className={
                            'tabla-fila' +
                            (it.id === itemSeleccionadoId ? ' seleccionada' : '')
                          }
                          onClick={() => {
                            setItemSeleccionadoId(it.id)
                            listaItemRef.current?.focus()
                          }}
                          onDoubleClick={() => setItemVista(it)}
                        >
                          <td>{it.id}</td>
                          <td>{it.tipo}</td>
                          <td>{it.descripcion}</td>
                          <td>{it.cantidad ?? 1}</td>
                          <td>{it.estado}</td>
                          <td>{contarProc[it.id] ?? 0} proceso(s)</td>
                          <td className="tabla-acciones">
                            <button
                              type="button"
                              className="empresas-editar"
                              onClick={(e) => {
                                e.stopPropagation()
                                setItemVista(it)
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
  )
}

export default Proyectos
