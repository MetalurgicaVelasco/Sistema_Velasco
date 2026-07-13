import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../../shared/lib/supabaseClient'
import Modal from '../../shared/components/Modal'
import { tipoLabel } from './elementosApi'
import { ESTADOS_ELEMENTO } from './elementoTipos'
import { importarProductoMatriz } from './importarMatriz'
import {
  cargarCatalogoImportable,
  type ItemCatalogo,
  type FacetasCatalogo,
  type ExpandirFn,
} from './catalogoImportable'

type SortBy = 'descripcion' | 'cliente' | 'created' | 'cantProc'

// Multiselección de clientes en un campo de ALTO FIJO: chips en una sola fila
// (cada nombre truncado con ellipsis), tope configurable y desplegable buscable.
// No crece con la selección: los nombres largos se acortan para entrar.
function MultiCliente({
  opciones,
  seleccionados,
  onChange,
  max = 5,
}: {
  opciones: string[]
  seleccionados: string[]
  onChange: (v: string[]) => void
  max?: number
}) {
  const [abierto, setAbierto] = useState(false)
  const [q, setQ] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!abierto) return
    function onDoc(e: globalThis.MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [abierto])

  const sel = new Set(seleccionados)
  const tope = seleccionados.length >= max

  function toggle(c: string) {
    if (sel.has(c)) onChange(seleccionados.filter((x) => x !== c))
    else if (!tope) onChange([...seleccionados, c])
  }

  const filtradas = opciones.filter((o) => o.toLowerCase().includes(q.trim().toLowerCase()))

  return (
    <div className="imp-multi-wrap" ref={ref}>
      <div className="imp-multi" onClick={() => setAbierto((a) => !a)}>
        {seleccionados.length === 0 ? (
          <span className="imp-multi-ph">— todos —</span>
        ) : (
          seleccionados.map((c) => (
            <span key={c} className="imp-multi-chip" title={c}>
              <span className="imp-multi-chip-txt">{c}</span>
              <button
                type="button"
                className="imp-multi-x"
                onClick={(e) => {
                  e.stopPropagation()
                  toggle(c)
                }}
              >
                ×
              </button>
            </span>
          ))
        )}
        <span className="imp-multi-caret">▾</span>
      </div>
      {abierto && (
        <div className="imp-multi-dd">
          <input
            className="imp-multi-search"
            placeholder="Buscar cliente…"
            value={q}
            autoFocus
            onChange={(e) => setQ(e.target.value)}
          />
          {tope && <div className="imp-multi-nota">Máximo {max} clientes.</div>}
          {filtradas.length === 0 ? (
            <div className="imp-multi-vacio">Sin opciones</div>
          ) : (
            filtradas.map((c) => {
              const marcado = sel.has(c)
              const off = !marcado && tope
              return (
                <div
                  key={c}
                  className={'imp-multi-op' + (off ? ' imp-multi-op-off' : '')}
                  onClick={() => {
                    if (!off) toggle(c)
                  }}
                >
                  <input type="checkbox" checked={marcado} readOnly disabled={off} />
                  <span className="imp-multi-op-txt">{c}</span>
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}

// Catálogo de la Matriz para importar a un proyecto. Filtrás/buscás cualquier
// nodo e importás: un conjunto baja con su composición; un componente entra solo.
function ModalImportarMatriz({
  proyectoId,
  onImportado,
  onCerrar,
}: {
  proyectoId: number
  onImportado: () => void
  onCerrar: () => void
}) {
  const [items, setItems] = useState<ItemCatalogo[]>([])
  const [facetas, setFacetas] = useState<FacetasCatalogo | null>(null)
  const [expandir, setExpandir] = useState<ExpandirFn | null>(null)
  const [cargando, setCargando] = useState(true)
  const [fechaEntrega, setFechaEntrega] = useState('')
  const [clienteProyecto, setClienteProyecto] = useState('')

  const [buscar, setBuscar] = useState('')
  const [codigos, setCodigos] = useState('')
  const [fClientes, setFClientes] = useState<string[]>([])
  const [fSector, setFSector] = useState('')
  const [fEquipo, setFEquipo] = useState('')
  const [fConjunto, setFConjunto] = useState('')
  const [fSubconjunto, setFSubconjunto] = useState('')
  const [sortBy, setSortBy] = useState<SortBy>('descripcion')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  // Modal de import (componente/conjunto) y sus campos.
  const [importando, setImportando] = useState<ItemCatalogo | null>(null)
  const [cantidad, setCantidad] = useState('1')
  const [fechaFin, setFechaFin] = useState('')
  const [estado, setEstado] = useState('Espera MP')
  const [presentacion, setPresentacion] = useState('')
  const [esRetrabajo, setEsRetrabajo] = useState(false)
  const [esDispositivo, setEsDispositivo] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [errImport, setErrImport] = useState<string | null>(null)

  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  useEffect(() => {
    cargarCatalogoImportable()
      .then(({ items, facetas, expandir }) => {
        setItems(items)
        setFacetas(facetas)
        setExpandir(() => expandir)
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'No se pudo cargar el catálogo.'))
      .finally(() => setCargando(false))
  }, [])

  // Proyecto: cliente (para el default del filtro) + fecha de entrega.
  useEffect(() => {
    supabase
      .from('proyectos')
      .select('fecha_entrega, empresa:empresas!empresa_id ( nombre )')
      .eq('id', proyectoId)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return
        // Supabase tipa la relación to-one como array; en runtime viene objeto.
        // Usamos any y contemplamos ambos para no pelear con el tipado.
        const d = data as any
        setFechaEntrega(d.fecha_entrega ?? '')
        const emp = Array.isArray(d.empresa) ? d.empresa[0] : d.empresa
        setClienteProyecto(emp?.nombre ?? '')
      })
  }, [proyectoId])

  // Default del filtro Cliente = cliente del proyecto, PERO solo si ese cliente
  // existe en el catálogo. Si no, se deja en "— todos —" para no esconder todo
  // con un filtro que el desplegable ni siquiera ofrece.
  useEffect(() => {
    if (facetas && clienteProyecto && facetas.clientes.includes(clienteProyecto)) {
      setFClientes([clienteProyecto])
    }
  }, [facetas, clienteProyecto])

  const lista = useMemo(() => {
    const t = buscar.trim().toLowerCase()
    const c = codigos.trim().toLowerCase()
    const cmp = (a: ItemCatalogo, b: ItemCatalogo) => {
      let r = 0
      if (sortBy === 'descripcion') r = a.descripcion.localeCompare(b.descripcion)
      else if (sortBy === 'cliente') r = (a.clientes[0] ?? '').localeCompare(b.clientes[0] ?? '')
      else if (sortBy === 'created') r = (a.createdAt ?? '').localeCompare(b.createdAt ?? '')
      else r = a.cantProcesos - b.cantProcesos
      return sortDir === 'asc' ? r : -r
    }
    return items
      .filter((i) => {
        if (t && !i.descripcion.toLowerCase().includes(t)) return false
        if (c && !(i.codigoCliente ?? '').toLowerCase().includes(c)) return false
        if (fClientes.length && !fClientes.some((c) => i.clientes.includes(c))) return false
        if (fSector && !i.sectores.includes(fSector)) return false
        if (fEquipo && !i.equipos.includes(fEquipo)) return false
        if (fConjunto && i.descripcion !== fConjunto && !i.conjuntos.includes(fConjunto)) return false
        if (fSubconjunto && i.descripcion !== fSubconjunto && !i.subconjuntos.includes(fSubconjunto)) return false
        return true
      })
      .sort(cmp)
  }, [items, buscar, codigos, fClientes, fSector, fEquipo, fConjunto, fSubconjunto, sortBy, sortDir])

  function abrirImport(i: ItemCatalogo) {
    setImportando(i)
    setCantidad('1')
    setFechaFin(fechaEntrega)
    setEstado('Espera MP')
    setPresentacion(i.presentacion ?? '')
    setEsRetrabajo(false)
    setEsDispositivo(false)
    setErrImport(null)
    setAviso(null)
  }

  async function confirmarImport() {
    if (!importando) return
    const cant = Number(cantidad)
    if (!Number.isFinite(cant) || cant < 1) {
      setErrImport('La cantidad debe ser 1 o más.')
      return
    }
    if (!fechaFin) {
      setErrImport('Ingresá la fecha de fin estipulada.')
      return
    }
    const esComp = importando.tipo === 'componente'
    setGuardando(true)
    setErrImport(null)
    const r = await importarProductoMatriz(importando.id, proyectoId, null, {
      cantidad: cant,
      fechaFin,
      estado,
      ...(esComp ? { presentacion: presentacion.trim() || null, esRetrabajo, esDispositivo } : {}),
    })
    setGuardando(false)
    if (r.error) {
      setErrImport(r.error)
      return
    }
    setAviso(`Importado: ${importando.descripcion}${esComp ? '' : ' (con su composición)'}.`)
    setImportando(null)
    onImportado()
  }

  const hayFiltros = !!(buscar || codigos || fSector || fEquipo || fConjunto || fSubconjunto)

  // Resumen de composición para el modal de conjunto/subconjunto.
  const resumen = useMemo(() => {
    if (!importando || importando.tipo === 'componente' || !expandir) return null
    const mult = Math.max(1, Number(cantidad) || 1)
    const productos = expandir(importando.id, mult)
    const unidades = productos.reduce((a, p) => a + p.cantidad, 0)
    return { productos, unidades }
  }, [importando, cantidad, expandir])

  return (
    <Modal titulo="Importar de la Matriz de Productos" onCerrar={onCerrar} ancho={880}>
      {/* Zona de filtros: recuadro gris, grilla 70/30, dimensiones fijas */}
      <div className="imp-filtros">
        <div className="imp-celda">
          <span className="filtro-lbl">Ordenar por</span>
          <div className="imp-orden">
            <select
              className="empresa-input imp-orden-sel"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortBy)}
            >
              <option value="descripcion">Descripción</option>
              <option value="cliente">Cliente</option>
              <option value="created">Fecha de creación</option>
              <option value="cantProc">Cantidad de procesos</option>
            </select>
            <button
              type="button"
              className="empresa-boton-secundario imp-orden-dir"
              onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
              title={sortDir === 'asc' ? 'Ascendente' : 'Descendente'}
            >
              {sortDir === 'asc' ? '↑' : '↓'}
            </button>
          </div>
        </div>
        <div className="imp-celda">
          <span className="filtro-lbl">Sectores</span>
          <select className="empresa-input" value={fSector} onChange={(e) => setFSector(e.target.value)}>
            <option value="">— todos —</option>
            {facetas?.sectores.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div className="imp-celda">
          <span className="filtro-lbl">Cliente</span>
          <MultiCliente
            opciones={facetas?.clientes ?? []}
            seleccionados={fClientes}
            onChange={setFClientes}
            max={5}
          />
        </div>
        <div className="imp-celda">
          <span className="filtro-lbl">Equipos</span>
          <select className="empresa-input" value={fEquipo} onChange={(e) => setFEquipo(e.target.value)}>
            <option value="">— todos —</option>
            {facetas?.equipos.map((eq) => (
              <option key={eq} value={eq}>
                {eq}
              </option>
            ))}
          </select>
        </div>

        <div className="imp-celda">
          <span className="filtro-lbl">Descripción</span>
          <input
            className="empresa-input"
            placeholder="Buscar…"
            value={buscar}
            onChange={(e) => setBuscar(e.target.value)}
          />
        </div>
        <div className="imp-celda">
          <span className="filtro-lbl">Conjuntos</span>
          <select className="empresa-input" value={fConjunto} onChange={(e) => setFConjunto(e.target.value)}>
            <option value="">— todos —</option>
            {facetas?.conjuntos.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="imp-celda">
          <span className="filtro-lbl">Códigos</span>
          <input
            className="empresa-input"
            placeholder="Código de cliente"
            value={codigos}
            onChange={(e) => setCodigos(e.target.value)}
          />
        </div>
        <div className="imp-celda">
          <span className="filtro-lbl">Subconjuntos</span>
          <select
            className="empresa-input"
            value={fSubconjunto}
            onChange={(e) => setFSubconjunto(e.target.value)}
          >
            <option value="">— todos —</option>
            {facetas?.subconjuntos.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Línea de estado (alto fijo, para que nada salte) */}
      <div className="imp-msg">
        {aviso ? <span className="imp-msg-ok">✓ {aviso}</span> : null}
        {error && !importando ? <span className="empresa-form-error">{error}</span> : null}
        {hayFiltros ? (
          <button
            type="button"
            className="imp-limpiar"
            onClick={() => {
              setBuscar('')
              setCodigos('')
              setFSector('')
              setFEquipo('')
              setFConjunto('')
              setFSubconjunto('')
            }}
          >
            ✕ Limpiar filtros
          </button>
        ) : null}
      </div>

      {/* Zona de resultados: alto fijo + scroll interno */}
      <div className="imp-lista">
        {cargando ? (
          <div className="rec-vacio">Cargando catálogo…</div>
        ) : lista.length === 0 ? (
          <div className="rec-vacio">No hay elementos que coincidan con los filtros.</div>
        ) : (
          lista.map((i, idx) => (
            <div key={i.id} className={'imp-fila' + (idx % 2 ? ' imp-fila-alt' : '')}>
              <span className={'imp-tipo imp-tipo-' + i.tipo}>{tipoLabel(i.tipo)}</span>
              <div className="imp-fila-txt">
                <div className="imp-fila-desc">{i.descripcion}</div>
                <div className="imp-fila-sub">
                  {i.codigoCliente ? `Cód. ${i.codigoCliente} · ` : ''}
                  {i.clientes.length ? i.clientes.join(', ') : 'sin ubicación'}
                  {i.cantProcesos ? ` · ${i.cantProcesos} proc.` : ''}
                </div>
              </div>
              <button type="button" className="empresa-boton imp-btn" onClick={() => abrirImport(i)}>
                Importar
              </button>
            </div>
          ))
        )}
      </div>

      {/* Modal de importación (variante componente / conjunto) */}
      {importando && (
        <Modal
          titulo={`Importar ${importando.tipo === 'componente' ? 'componente' : tipoLabel(importando.tipo).toLowerCase()} "${importando.descripcion}"`}
          onCerrar={() => setImportando(null)}
          ancho={importando.tipo === 'componente' ? 520 : 600}
        >
          {importando.tipo !== 'componente' && resumen && (
            <>
              <div className="imp-resumen">
                <b>Resumen:</b> se importan <b>{resumen.productos.length}</b> tipo(s) de componente,{' '}
                <b>{resumen.unidades}</b> unidad(es) en total.
              </div>
              <div className="imp-resumen-detalle">
                {resumen.productos.map((p, k) => (
                  <div key={k} className="imp-resumen-fila">
                    <span>{p.descripcion}</span>
                    <span className="imp-resumen-cant">x{p.cantidad}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          <div className="empresa-campo-fila">
            <label className="empresa-campo">
              {importando.tipo === 'componente' ? 'Cantidad *' : 'Cantidad de conjuntos *'}
              <input
                type="number"
                min={1}
                className="empresa-input"
                value={cantidad}
                autoFocus
                onChange={(e) => setCantidad(e.target.value)}
              />
            </label>
            <label className="empresa-campo">
              Fecha de fin estipulada *
              <input
                type="date"
                className="empresa-input"
                value={fechaFin}
                onChange={(e) => setFechaFin(e.target.value)}
              />
            </label>
          </div>

          {importando.tipo === 'componente' && (
            <label className="empresa-campo">
              Presentación de materia prima
              <input
                className="empresa-input"
                value={presentacion}
                placeholder="Ej. Ø290 x 1 1/2 pulg"
                onChange={(e) => setPresentacion(e.target.value)}
              />
              <span className="pf-ayuda">Default = la del producto de matriz. Si acá va otra, cambiala.</span>
            </label>
          )}

          <label className="empresa-campo">
            {importando.tipo === 'componente' ? 'Estado del item' : 'Estado de los items'}
            <select className="empresa-input" value={estado} onChange={(e) => setEstado(e.target.value)}>
              {ESTADOS_ELEMENTO.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </label>

          {importando.tipo === 'componente' && (
            <div className="imp-checks">
              <label className="imp-check">
                <input type="checkbox" checked={esRetrabajo} onChange={(e) => setEsRetrabajo(e.target.checked)} />
                <span>
                  <b>Es retrabajo</b> — trabajo correctivo. No aparece en notas de envío ni remitos.
                </span>
              </label>
              <label className="imp-check">
                <input
                  type="checkbox"
                  checked={esDispositivo}
                  onChange={(e) => setEsDispositivo(e.target.checked)}
                />
                <span>
                  <b>Es dispositivo o pieza auxiliar</b> — necesaria para fabricar. No aparece en notas ni remitos.
                </span>
              </label>
            </div>
          )}

          {errImport && <p className="empresa-form-error">{errImport}</p>}

          <div className="pf-acciones">
            <button type="button" className="empresa-boton-secundario" onClick={() => setImportando(null)}>
              Cancelar
            </button>
            <button type="button" className="empresa-boton" onClick={confirmarImport} disabled={guardando}>
              {guardando ? 'Importando…' : 'Importar'}
            </button>
          </div>
        </Modal>
      )}
    </Modal>
  )
}

export default ModalImportarMatriz
