import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../shared/lib/supabaseClient'
import MenuContextual from '../../shared/components/MenuContextual'
import TablaConfigurable, { type ColumnaDef } from '../../shared/components/TablaConfigurable'
import PanelColumnas from '../../shared/components/PanelColumnas'
import { useConfigTabla } from '../../shared/hooks/useConfigTabla'

type ProyectoEmpresa = {
  id: number
  descripcion: string
  estado: string
  pedido_nro: string | null
  urgencia: string
  fecha_entrega: string | null
}

function fmtFecha(iso: string | null): string {
  if (!iso) return '—'
  const [a, m, d] = iso.split('-')
  return d && m && a ? `${d}/${m}/${a}` : iso
}

// Solapa "Proyectos" de la franja 4 de Empresas: los proyectos de esa empresa.
function ProyectosEmpresa({
  empresaId,
  onAbrirProyecto,
}: {
  empresaId: number
  onAbrirProyecto?: (proyectoId: number) => void
}) {
  const [filas, setFilas] = useState<ProyectoEmpresa[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const {
    columnas: configCols,
    setColumnas: setConfigCols,
    orden,
    setOrden,
  } = useConfigTabla('empresas.proyectos.columnas', [
    { id: 'id', visible: true, ancho: 70 },
    { id: 'descripcion', visible: true, ancho: 320 },
    { id: 'estado', visible: true, ancho: 130 },
    { id: 'pedido', visible: true, ancho: 110 },
    { id: 'urgencia', visible: true, ancho: 110 },
    { id: 'entrega', visible: true, ancho: 120 },
  ])
  const [panelCols, setPanelCols] = useState(false)

  useEffect(() => {
    let vivo = true
    setCargando(true)
    supabase
      .from('proyectos')
      .select('id, descripcion, estado, pedido_nro, urgencia, fecha_entrega')
      .eq('empresa_id', empresaId)
      .order('id', { ascending: false })
      .then(({ data, error }) => {
        if (!vivo) return
        if (error) setError('No se pudieron cargar los proyectos.')
        else {
          setFilas((data as ProyectoEmpresa[]) ?? [])
          setError(null)
        }
        setCargando(false)
      })
    return () => {
      vivo = false
    }
  }, [empresaId])

  const cols: ColumnaDef<ProyectoEmpresa>[] = useMemo(
    () => [
      { id: 'id', titulo: 'Nº', tipo: 'numero', valor: (p) => p.id },
      { id: 'descripcion', titulo: 'Descripción', tipo: 'texto', valor: (p) => p.descripcion },
      { id: 'estado', titulo: 'Estado', tipo: 'texto', valor: (p) => p.estado },
      { id: 'pedido', titulo: 'Pedido', tipo: 'texto', valor: (p) => p.pedido_nro },
      { id: 'urgencia', titulo: 'Urgencia', tipo: 'texto', valor: (p) => p.urgencia },
      { id: 'entrega', titulo: 'Fecha entrega', tipo: 'fecha', valor: (p) => p.fecha_entrega, render: (p) => fmtFecha(p.fecha_entrega) },
    ],
    [],
  )

  return (
    <div className="subtabla">
      <MenuContextual items={[{ label: 'Columnas…', onSelect: () => setPanelCols(true) }]}>
        {cargando ? (
          <div className="empresas-estado">Cargando proyectos…</div>
        ) : error ? (
          <div className="empresas-estado">{error}</div>
        ) : filas.length === 0 ? (
          <p className="empresas-vacio">Esta empresa no tiene proyectos.</p>
        ) : (
          <TablaConfigurable<ProyectoEmpresa>
            columnas={cols}
            config={configCols}
            onConfig={setConfigCols}
            filas={filas}
            orden={orden}
            onOrden={setOrden}
            filaKey={(p) => p.id}
            onFilaDobleClick={(p) => onAbrirProyecto?.(p.id)}
          />
        )}
      </MenuContextual>

      {panelCols && (
        <PanelColumnas columnas={cols} config={configCols} onConfig={setConfigCols} onCerrar={() => setPanelCols(false)} />
      )}
    </div>
  )
}

export default ProyectosEmpresa
