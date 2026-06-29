import { useState, useEffect } from 'react'
import { supabase } from '../../shared/lib/supabaseClient'

// Tipo de un proyecto en la lista (franja 2). Por ahora solo lectura.
// `empresa` viene de un join a la tabla empresas (el cliente del proyecto).
type Proyecto = {
  id: number
  pedido_nro: string | null
  descripcion: string
  urgencia: string
  estado: string
  fecha_entrega: string | null
  empresa: { nombre: string } | null
}

// Pasa una fecha ISO ('2026-06-29') a formato corto argentino (29/06/2026).
function fechaCorta(iso: string | null): string {
  if (!iso) return '—'
  const [a, m, d] = iso.split('-')
  return `${d}/${m}/${a}`
}

function Proyectos() {
  const [proyectos, setProyectos] = useState<Proyecto[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [seleccionadoId, setSeleccionadoId] = useState<number | null>(null)

  async function cargarProyectos() {
    setCargando(true)
    setError(null)
    const { data, error } = await supabase
      .from('proyectos')
      .select(
        'id, pedido_nro, descripcion, urgencia, estado, fecha_entrega, empresa:empresas ( nombre )',
      )
      .order('id', { ascending: false })
    if (error) {
      setError('No se pudieron cargar los proyectos.')
      setCargando(false)
      return
    }
    setProyectos((data as unknown as Proyecto[]) ?? [])
    setCargando(false)
  }

  useEffect(() => {
    cargarProyectos()
  }, [])

  const seleccionado = proyectos.find((p) => p.id === seleccionadoId) ?? null

  return (
    <div className="vista-franjas">
      {/* Franja 1 — Filtros (placeholder, se desarrolla más adelante) */}
      <div className="franja franja-filtros">
        <span className="franja-placeholder">Filtros (próximamente)</span>
      </div>

      {/* Franja 2 — Lista de proyectos */}
      <div className="franja franja-lista">
        {cargando ? (
          <div className="empresas-estado">Cargando proyectos…</div>
        ) : error ? (
          <div className="empresas-estado">{error}</div>
        ) : proyectos.length === 0 ? (
          <p className="empresas-vacio">No hay proyectos cargados todavía.</p>
        ) : (
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
              </tr>
            </thead>
            <tbody>
              {proyectos.map((p) => (
                <tr
                  key={p.id}
                  className={
                    'tabla-fila' +
                    (p.id === seleccionadoId ? ' seleccionada' : '')
                  }
                  onClick={() => setSeleccionadoId(p.id)}
                >
                  <td>{p.id}</td>
                  <td>{p.empresa?.nombre ?? '—'}</td>
                  <td>{p.descripcion}</td>
                  <td>{p.estado}</td>
                  <td>{p.urgencia}</td>
                  <td>{p.pedido_nro ?? '—'}</td>
                  <td>{fechaCorta(p.fecha_entrega)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Franja 3 — Detalle: items del proyecto (placeholder por ahora) */}
      <div className="franja franja-detalle">
        {seleccionado ? (
          <span className="franja-placeholder">
            Items de «{seleccionado.descripcion}» (próximamente)
          </span>
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
    </div>
  )
}

export default Proyectos
