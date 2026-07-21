import { useMemo, type Key, type ReactNode, type Ref } from 'react'

// -----------------------------------------------------------------------------
// Tabla reutilizable para las franjas (2/3/4). Fase 1: render por columnas +
// ordenar al clickear el encabezado (texto = alfabético, número = asc/desc,
// fecha = más antiguo / más nuevo). Fases próximas: mostrar/ocultar, ancho y
// orden de columnas, con la config persistida por usuario.
//
// El comportamiento de fila (selección, menú contextual, acciones) se pasa por
// props, así cada franja conserva lo suyo sin acoplar el componente.
// -----------------------------------------------------------------------------

export type TipoColumna = 'texto' | 'numero' | 'fecha'

export type ColumnaDef<T> = {
  id: string
  titulo: string
  tipo: TipoColumna
  valor: (fila: T) => string | number | null | undefined // valor ordenable
  render?: (fila: T) => ReactNode // celda a mostrar (default: el valor)
  ordenable?: boolean // default true
  claseCelda?: string
}

export type OrdenTabla = { colId: string; dir: 'asc' | 'desc' } | null

// Ciclo al clickear un encabezado: asc → desc → sin orden → asc…
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
  if (va) return 1 // vacíos siempre al final
  if (vb) return -1
  if (tipo === 'numero') return Number(a) - Number(b)
  // fecha (ISO 'YYYY-MM-DD') y texto ordenan bien como string; numeric para que
  // "Item 2" < "Item 10".
  return String(a).localeCompare(String(b), 'es', { numeric: true, sensitivity: 'base' })
}

export default function TablaConfigurable<T>({
  columnas,
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
  filas: T[]
  orden: OrdenTabla
  onOrden: (o: OrdenTabla) => void
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
  const filasOrdenadas = useMemo(() => {
    if (!orden) return filas
    const col = columnas.find((c) => c.id === orden.colId)
    if (!col) return filas
    const factor = orden.dir === 'asc' ? 1 : -1
    return [...filas].sort((a, b) => factor * comparar(col.valor(a), col.valor(b), col.tipo))
  }, [filas, orden, columnas])

  return (
    <table className="tabla">
      <thead>
        <tr>
          {columnas.map((c) => {
            const ordenable = c.ordenable !== false
            const activa = orden?.colId === c.id
            const flecha = activa ? (orden!.dir === 'asc' ? ' ↑' : ' ↓') : ''
            return (
              <th
                key={c.id}
                className={ordenable ? 'th-ordenable' : undefined}
                onClick={ordenable ? () => onOrden(proximoOrden(orden, c.id)) : undefined}
              >
                {c.titulo}
                {flecha}
              </th>
            )
          })}
          {acciones && <th>{accionesTitulo}</th>}
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
            {columnas.map((c) => (
              <td key={c.id} className={c.claseCelda}>
                {c.render ? c.render(fila) : formatoDefault(c.valor(fila))}
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
