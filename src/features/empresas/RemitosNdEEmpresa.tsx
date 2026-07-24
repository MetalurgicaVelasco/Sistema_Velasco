import { useState, useEffect, useMemo } from 'react'
import MenuContextual from '../../shared/components/MenuContextual'
import TablaConfigurable, { type ColumnaDef } from '../../shared/components/TablaConfigurable'
import PanelColumnas from '../../shared/components/PanelColumnas'
import { useConfigTabla } from '../../shared/hooks/useConfigTabla'
import { cargarDocumentosEnvio, fmtFecha, type DocumentoEnvio } from './remitosNdEApi'

// Solapa "Remitos y NdE" de una empresa: lista los dos tipos de documento de
// envío juntos. Por ahora es solo lectura; generar notas y cargar remitos viene
// en las fases siguientes.
function RemitosNdEEmpresa({ empresaId }: { empresaId: number }) {
  const [docs, setDocs] = useState<DocumentoEnvio[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const {
    columnas: configCols,
    setColumnas: setConfigCols,
    orden,
    setOrden,
  } = useConfigTabla('empresas.remitos-nde.columnas', [
    { id: 'tipo', visible: true, ancho: 130 },
    { id: 'numero', visible: true, ancho: 130 },
    { id: 'fecha', visible: true, ancho: 100 },
    { id: 'responsable', visible: true, ancho: 150 },
    { id: 'proyecto', visible: true, ancho: 260 },
    { id: 'pedido', visible: true, ancho: 110 },
    { id: 'estado', visible: true, ancho: 220 },
    { id: 'origen', visible: true, ancho: 180 },
  ])
  const [panelCols, setPanelCols] = useState(false)

  useEffect(() => {
    let vivo = true
    setCargando(true)
    cargarDocumentosEnvio(empresaId)
      .then((d) => {
        if (!vivo) return
        setDocs(d)
        setError(null)
      })
      .catch((e) => {
        if (vivo) setError(e instanceof Error ? e.message : 'No se pudieron cargar los documentos.')
      })
      .finally(() => {
        if (vivo) setCargando(false)
      })
    return () => {
      vivo = false
    }
  }, [empresaId])

  const cols: ColumnaDef<DocumentoEnvio>[] = useMemo(
    () => [
      {
        id: 'tipo',
        titulo: 'Tipo',
        tipo: 'texto',
        valor: (d) => d.tipo,
        render: (d) => (
          <span className={'doc-tipo ' + (d.tipo === 'Remito' ? 'doc-tipo-rm' : 'doc-tipo-ne')}>
            {d.tipo === 'Remito' ? 'Remito' : 'NdE'}
          </span>
        ),
      },
      { id: 'numero', titulo: 'Número', tipo: 'texto', valor: (d) => d.numero },
      // Se ordena por la fecha ISO (cronológico) aunque se muestre dd/mm/aaaa.
      { id: 'fecha', titulo: 'Fecha', tipo: 'fecha', valor: (d) => d.fecha, render: (d) => fmtFecha(d.fecha) ?? '—' },
      { id: 'responsable', titulo: 'Responsable', tipo: 'texto', valor: (d) => d.responsable },
      { id: 'proyecto', titulo: 'Proyecto', tipo: 'texto', valor: (d) => d.proyecto },
      { id: 'pedido', titulo: 'Pedido', tipo: 'texto', valor: (d) => d.pedido },
      { id: 'estado', titulo: 'Estado', tipo: 'texto', valor: (d) => d.estado },
      { id: 'origen', titulo: 'Origen', tipo: 'texto', valor: (d) => d.origen },
    ],
    [],
  )

  return (
    <div className="subtabla">
      <MenuContextual items={[{ label: 'Columnas…', onSelect: () => setPanelCols(true) }]}>
        {cargando ? (
          <div className="empresas-estado">Cargando documentos…</div>
        ) : error ? (
          <div className="empresas-estado">{error}</div>
        ) : docs.length === 0 ? (
          <p className="empresas-vacio">Esta empresa no tiene remitos ni notas de envío.</p>
        ) : (
          <TablaConfigurable<DocumentoEnvio>
            columnas={cols}
            config={configCols}
            onConfig={setConfigCols}
            filas={docs}
            orden={orden}
            onOrden={setOrden}
            filaKey={(d) => d.clave}
          />
        )}
      </MenuContextual>

      {panelCols && (
        <PanelColumnas
          columnas={cols}
          config={configCols}
          onConfig={setConfigCols}
          onCerrar={() => setPanelCols(false)}
        />
      )}
    </div>
  )
}

export default RemitosNdEEmpresa
