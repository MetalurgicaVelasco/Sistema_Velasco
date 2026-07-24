import { useMemo, type Key, type ReactNode, type Ref } from 'react'
import type React from 'react'

// -----------------------------------------------------------------------------
// Tabla reutilizable para las franjas (2/3/4).
//  - Fase 1: ordenar al clickear el encabezado.
//  - Fase 2: config de columnas (mostrar/ocultar, orden y ancho). La config se
//    pasa por props; el panel para editarla es PanelColumnas.
//
// El comportamiento de fila (selección, menú contextual, acciones) va por props,
// así cada franja conserva lo suyo sin acoplar el componente.
// -----------------------------------------------------------------------------

export type TipoColumna = 'texto' | 'numero' | 'fecha'

export type ColumnaDef<T> = {
  id: string
  titulo: string
  tipo: TipoColumna
  valor: (fila: T) => string | number | null | undefined
  render?: (fila: T) => ReactNode
  ordenable?: boolean
  claseCelda?: string
}

export type OrdenTabla = { colId: string; dir: 'asc' | 'desc' } | null

// Config de columnas: lista ORDENADA de columnas con su visibilidad y ancho.
// Ancho mínimo de una columna al redimensionar (px).
const ANCHO_MIN = 13

export type ConfigColumna = { id: string; visible: boolean; ancho?: number }
export type ConfigTabla = ConfigColumna[]

// Config por defecto: todas visibles, en el orden de las definiciones.
export function configPorDefecto<T>(columnas: ColumnaDef<T>[]): ConfigTabla {
  return columnas.map((c) => ({ id: c.id, visible: true }))
}

export function proximoOrden(actual: OrdenTabla, colId: string): OrdenTabla {
  if (actual?.colId === colId) {
    return actual.dir === 'asc' ? { colId, dir: 'desc' } : null
  }
  return { colId, dir: 'asc' }
}

type V = string | number | null | undefined

function comparar(a: V, b: V, tipo: TipoColumna): number {
  const va = a == null || a === ''
  const vb = b == null || b === ''
  if (va && vb) return 0
  if (va) return 1
  if (vb) return -1
  if (tipo === 'numero') return Number(a) - Number(b)
  return String(a).localeCompare(String(b), 'es', { numeric: true, sensitivity: 'base' })
}

export default function TablaConfigurable<T>({
  columnas,
  config,
  onConfig,
  clase,
  filas,
  orden,
  onOrden,
  filaKey,
  filaClase,
  filaData,
  filaRef,
  onFilaClick,
  onFilaContextMenu,
  onFilaDobleClick,
  accionesTitulo,
  acciones,
}: {
  columnas: ColumnaDef<T>[]
  config?: ConfigTabla // si no viene, se muestran todas en orden de definición
  onConfig?: (c: ConfigTabla) => void // habilita el resize de columnas
  clase?: string // clase extra para la <table> (ej. 'tabla-fija')
  filas: T[]
  // Orden de filas. Si no viene `onOrden`, la tabla NO ordena y los encabezados
  // no son clickeables (ej. franja 3: su orden es el de los documentos).
  orden?: OrdenTabla
  onOrden?: (o: OrdenTabla) => void
  filaKey: (fila: T) => Key
  filaClase?: (fila: T) => string
  filaData?: (fila: T) => Record<string, string | number>
  filaRef?: (fila: T) => Ref<HTMLTableRowElement> | undefined
  onFilaClick?: (fila: T) => void
  onFilaContextMenu?: (fila: T) => void
  onFilaDobleClick?: (fila: T) => void
  accionesTitulo?: ReactNode
  acciones?: (fila: T) => ReactNode
}) {
  // Columnas visibles, en el orden de la config (con su ancho). Sin config, todas.
  const cols = useMemo(() => {
    if (!config) return columnas.map((def) => ({ def, ancho: undefined as number | undefined }))
    const porId = new Map(columnas.map((c) => [c.id, c] as const))
    return config
      .filter((cf) => cf.visible)
      .map((cf) => ({ def: porId.get(cf.id), ancho: cf.ancho }))
      .filter((x): x is { def: ColumnaDef<T>; ancho: number | undefined } => !!x.def)
  }, [columnas, config])

  const filasOrdenadas = useMemo(() => {
    if (!orden || !onOrden) return filas
    const col = columnas.find((c) => c.id === orden.colId)
    if (!col) return filas
    const factor = orden.dir === 'asc' ? 1 : -1
    return [...filas].sort((a, b) => factor * comparar(col.valor(a), col.valor(b), col.tipo))
  }, [filas, orden, onOrden, columnas])

  // Resize: arrastrar el borde derecho del encabezado cambia el ancho de esa
  // columna. Se escucha en window para que el arrastre siga aunque el puntero
  // se salga del th. Sin config/onConfig no hay resize (la tabla queda fija).
  function empezarResize(e: React.PointerEvent, colId: string) {
    if (!config || !onConfig) return
    e.preventDefault()
    e.stopPropagation() // que no dispare el orden
    const th = (e.currentTarget as HTMLElement).closest('th') as HTMLElement | null
    const filaEnc = th?.parentElement

    // Se fija el ancho ACTUAL de todas las columnas visibles antes de arrastrar.
    // Si no, el espacio que libera la columna tomada lo absorbe alguna columna
    // sin ancho fijo (ej. Descripción): si está a la izquierda, el borde que se
    // arrastra no sigue al cursor y la columna anterior se agranda.
    const medidos = new Map<string, number>()
    const celdas = filaEnc ? (Array.from(filaEnc.children) as HTMLElement[]) : []
    cols.forEach((c, i) => {
      const celda = celdas[i]
      if (celda) medidos.set(c.def.id, Math.round(celda.getBoundingClientRect().width))
    })
    const base = config.map((c) => (medidos.has(c.id) ? { ...c, ancho: medidos.get(c.id) } : c))

    const anchoInicial = medidos.get(colId) ?? 100
    const xInicial = e.clientX

    const mover = (ev: PointerEvent) => {
      const nuevo = Math.max(ANCHO_MIN, Math.round(anchoInicial + (ev.clientX - xInicial)))
      onConfig(base.map((c) => (c.id === colId ? { ...c, ancho: nuevo } : c)))
    }
    const soltar = () => {
      window.removeEventListener('pointermove', mover)
      window.removeEventListener('pointerup', soltar)
      document.body.classList.remove('resizeando-col')
    }
    window.addEventListener('pointermove', mover)
    window.addEventListener('pointerup', soltar)
    document.body.classList.add('resizeando-col')
  }

  // Doble clic en el handle: vuelve la columna a ancho automático.
  function resetAncho(e: React.MouseEvent, colId: string) {
    if (!config || !onConfig) return
    e.stopPropagation()
    onConfig(config.map((c) => (c.id === colId ? { ...c, ancho: undefined } : c)))
  }

  return (
    <table className={'tabla' + (clase ? ' ' + clase : '')}>
      <thead>
        <tr>
          {cols.map(({ def, ancho }) => {
            const ordenable = !!onOrden && def.ordenable !== false
            const activa = orden?.colId === def.id
            const flecha = activa ? (orden!.dir === 'asc' ? ' ↑' : ' ↓') : ''
            return (
              <th
                key={def.id}
                className={ordenable ? 'th-ordenable' : undefined}
                style={ancho ? { width: ancho, minWidth: ancho } : undefined}
                onClick={ordenable ? () => onOrden(proximoOrden(orden ?? null, def.id)) : undefined}
              >
                {def.titulo}
                {flecha}
                {config && onConfig && (
                  <span
                    className="th-resize"
                    title="Arrastrar para cambiar el ancho (doble clic: automático)"
                    onPointerDown={(e) => empezarResize(e, def.id)}
                    onDoubleClick={(e) => resetAncho(e, def.id)}
                    onClick={(e) => e.stopPropagation()}
                  />
                )}
              </th>
            )
          })}
          {acciones && <th className="th-acciones">{accionesTitulo}</th>}
        </tr>
      </thead>
      <tbody>
        {filasOrdenadas.map((fila) => (
          <tr
            key={filaKey(fila)}
            ref={filaRef ? filaRef(fila) : undefined}
            className={'tabla-fila' + (filaClase ? ' ' + filaClase(fila) : '')}
            onClick={onFilaClick ? () => onFilaClick(fila) : undefined}
            onContextMenu={onFilaContextMenu ? () => onFilaContextMenu(fila) : undefined}
            onDoubleClick={onFilaDobleClick ? () => onFilaDobleClick(fila) : undefined}
            {...((filaData ? filaData(fila) : {}) as any)}
          >
            {cols.map(({ def }) => (
              <td key={def.id} className={def.claseCelda}>
                {def.render ? def.render(fila) : formatoDefault(def.valor(fila))}
              </td>
            ))}
            {acciones && <td className="tabla-acciones">{acciones(fila)}</td>}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function formatoDefault(v: V): ReactNode {
  return v == null || v === '' ? '—' : String(v)
}
