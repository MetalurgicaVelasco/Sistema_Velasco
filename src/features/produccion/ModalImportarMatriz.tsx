import { useEffect, useMemo, useState } from 'react'
import Modal from '../../shared/components/Modal'
import { tipoLabel } from './elementosApi'
import { importarProductoMatriz } from './importarMatriz'
import {
  cargarCatalogoImportable,
  type ItemCatalogo,
  type FacetasCatalogo,
} from './catalogoImportable'

// Catálogo de la Matriz para importar a un proyecto. Filtrás/buscás cualquier
// nodo (conjunto/subconjunto/componente) e importás: un conjunto baja con toda su
// composición; un componente entra solo.
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
  const [cargando, setCargando] = useState(true)

  const [buscar, setBuscar] = useState('')
  const [codigos, setCodigos] = useState('')
  const [fCliente, setFCliente] = useState('')
  const [fSector, setFSector] = useState('')
  const [fEquipo, setFEquipo] = useState('')
  const [fConjunto, setFConjunto] = useState('')
  const [fSubconjunto, setFSubconjunto] = useState('')
  const [ordenDir, setOrdenDir] = useState<'asc' | 'desc'>('asc')

  // Item elegido para importar (muestra la barra de cantidad).
  const [importando, setImportando] = useState<ItemCatalogo | null>(null)
  const [cantidad, setCantidad] = useState('1')
  const [guardando, setGuardando] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    cargarCatalogoImportable()
      .then(({ items, facetas }) => {
        setItems(items)
        setFacetas(facetas)
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'No se pudo cargar el catálogo.'))
      .finally(() => setCargando(false))
  }, [])

  const lista = useMemo(() => {
    const t = buscar.trim().toLowerCase()
    const c = codigos.trim().toLowerCase()
    return items
      .filter((i) => {
        if (t && !i.descripcion.toLowerCase().includes(t)) return false
        if (c && !(i.codigoCliente ?? '').toLowerCase().includes(c)) return false
        if (fCliente && !i.clientes.includes(fCliente)) return false
        if (fSector && !i.sectores.includes(fSector)) return false
        if (fEquipo && !i.equipos.includes(fEquipo)) return false
        if (fConjunto && i.descripcion !== fConjunto && !i.conjuntos.includes(fConjunto)) return false
        if (fSubconjunto && i.descripcion !== fSubconjunto && !i.subconjuntos.includes(fSubconjunto)) return false
        return true
      })
      .sort((a, b) =>
        ordenDir === 'asc'
          ? a.descripcion.localeCompare(b.descripcion)
          : b.descripcion.localeCompare(a.descripcion),
      )
  }, [items, buscar, codigos, fCliente, fSector, fEquipo, fConjunto, fSubconjunto, ordenDir])

  function abrirImport(i: ItemCatalogo) {
    setImportando(i)
    setCantidad('1')
    setError(null)
    setAviso(null)
  }

  async function confirmarImport() {
    if (!importando) return
    const cant = Number(cantidad)
    if (!Number.isFinite(cant) || cant < 1) {
      setError('La cantidad debe ser 1 o más.')
      return
    }
    setGuardando(true)
    setError(null)
    const r = await importarProductoMatriz(importando.id, proyectoId, null, cant)
    setGuardando(false)
    if (r.error) {
      setError(r.error)
      return
    }
    setAviso(`Importado: ${importando.descripcion}${importando.tipo === 'componente' ? '' : ' (con su composición)'}.`)
    setImportando(null)
    onImportado()
  }

  const hayFiltros = !!(buscar || codigos || fCliente || fSector || fEquipo || fConjunto || fSubconjunto)

  return (
    <Modal titulo="Importar de la Matriz de Productos" onCerrar={onCerrar} ancho={860}>
      {/* Grilla de filtros 70 / 30 */}
      <div className="imp-filtros">
        <div className="imp-celda">
          <span className="filtro-lbl">Ordenar</span>
          <button
            type="button"
            className="empresa-boton-secundario imp-orden"
            onClick={() => setOrdenDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
          >
            Descripción {ordenDir === 'asc' ? '↑' : '↓'}
          </button>
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
          <select className="empresa-input" value={fCliente} onChange={(e) => setFCliente(e.target.value)}>
            <option value="">— todos —</option>
            {facetas?.clientes.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
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

      {hayFiltros && (
        <button
          type="button"
          className="empresa-boton-secundario imp-limpiar"
          onClick={() => {
            setBuscar('')
            setCodigos('')
            setFCliente('')
            setFSector('')
            setFEquipo('')
            setFConjunto('')
            setFSubconjunto('')
          }}
        >
          ✕ Limpiar filtros
        </button>
      )}

      {aviso && <div className="imp-aviso">✓ {aviso}</div>}
      {error && !importando && <p className="empresa-form-error">{error}</p>}

      {/* Lista del catálogo */}
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
                </div>
              </div>
              <button type="button" className="empresa-boton imp-btn" onClick={() => abrirImport(i)}>
                Importar
              </button>
            </div>
          ))
        )}
      </div>

      {/* Barra de cantidad al elegir un item */}
      {importando && (
        <div className="imp-confirmar">
          <span className="imp-confirmar-txt">
            Importar <b>{importando.descripcion}</b>
            {importando.tipo !== 'componente' ? ' (baja con su composición)' : ''}
          </span>
          <label className="imp-confirmar-cant">
            Cantidad
            <input
              type="number"
              min={1}
              className="empresa-input"
              value={cantidad}
              autoFocus
              onChange={(e) => setCantidad(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  confirmarImport()
                }
              }}
            />
          </label>
          {error && <span className="empresa-form-error imp-confirmar-error">{error}</span>}
          <button type="button" className="empresa-boton-secundario" onClick={() => setImportando(null)}>
            Cancelar
          </button>
          <button type="button" className="empresa-boton" onClick={confirmarImport} disabled={guardando}>
            {guardando ? 'Importando…' : 'Confirmar'}
          </button>
        </div>
      )}
    </Modal>
  )
}

export default ModalImportarMatriz
