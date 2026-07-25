import { useState, useEffect, useMemo, useCallback } from 'react'
import MenuContextual from '../../shared/components/MenuContextual'
import TablaConfigurable, { type ColumnaDef } from '../../shared/components/TablaConfigurable'
import PanelColumnas from '../../shared/components/PanelColumnas'
import { useConfigTabla } from '../../shared/hooks/useConfigTabla'
import {
  cargarDocumentosEnvio,
  cargarDocumentosEnvioProyecto,
  fmtFecha,
  type DocumentoEnvio,
} from './remitosNdEApi'
import ModalNotaEnvio from '../produccion/ModalNotaEnvio'
import {
  cargarNotaParaEditar,
  eliminarNotaEnvio,
  type NotaParaEditar,
} from '../produccion/notasEnvioApi'
import ModalEditarRemito from '../produccion/ModalEditarRemito'
import ModalConfirmar from '../../shared/components/ModalConfirmar'
import { eliminarRemito } from '../produccion/remitosApi'

// Solapa "Remitos y NdE" de una empresa: lista los dos tipos de documento de
// envío. Desde acá se pueden editar y borrar (las notas en esta tanda; los
// remitos, en la siguiente).
// Lista de documentos de envío (remitos + notas). Se usa en la ficha de la
// empresa (empresaId) y en la franja 4 de un proyecto (proyectoId).
function RemitosNdEEmpresa({
  empresaId,
  proyectoId,
}: {
  empresaId?: number
  proyectoId?: number
}) {
  const [docs, setDocs] = useState<DocumentoEnvio[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notaEditando, setNotaEditando] = useState<NotaParaEditar | null>(null)
  const [remitoEditando, setRemitoEditando] = useState<
    { id: number; numero4: string; fecha: string } | null
  >(null)
  const [procesando, setProcesando] = useState(false)

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
  const [confirmar, setConfirmar] = useState<{ mensaje: string; onOk: () => void } | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  const recargar = useCallback(() => {
    let vivo = true
    setCargando(true)
    const cargar =
      empresaId != null
        ? cargarDocumentosEnvio(empresaId)
        : proyectoId != null
          ? cargarDocumentosEnvioProyecto(proyectoId)
          : Promise.resolve([])
    cargar
      .then((d) => {
        if (vivo) {
          setDocs(d)
          setError(null)
        }
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
  }, [empresaId, proyectoId])

  useEffect(() => recargar(), [recargar])

  function idDeDoc(d: DocumentoEnvio): number {
    return Number(d.clave.split(':')[1])
  }

  async function editarNota(d: DocumentoEnvio) {
    if (d.estado.startsWith('Cerrada')) {
      setAviso('Esta nota ya fue cerrada por un remito. Para cambiarla, primero borrá el remito.')
      return
    }
    try {
      setProcesando(true)
      const nota = await cargarNotaParaEditar(idDeDoc(d))
      setNotaEditando(nota)
    } catch (e) {
      setAviso(e instanceof Error ? e.message : 'No se pudo abrir la nota.')
    } finally {
      setProcesando(false)
    }
  }

  function borrarNota(d: DocumentoEnvio) {
    setConfirmar({
      mensaje: `¿Borrar la nota de envío ${d.numero}? No se puede deshacer.`,
      onOk: async () => {
        setProcesando(true)
        const { error: err } = await eliminarNotaEnvio(idDeDoc(d))
        setProcesando(false)
        setConfirmar(null)
        if (err) setAviso(err)
        else recargar()
      },
    })
  }

  function editarRemito(d: DocumentoEnvio) {
    setRemitoEditando({
      id: idDeDoc(d),
      numero4: d.numero.slice(-4),
      fecha: d.fecha ?? new Date().toISOString().slice(0, 10),
    })
  }

  function borrarRemito(d: DocumentoEnvio) {
    setConfirmar({
      mensaje: `¿Borrar el remito ${d.numero}? Si cerraba notas de envío, esas notas vuelven a quedar abiertas. No se puede deshacer.`,
      onOk: async () => {
        setProcesando(true)
        const { error: err } = await eliminarRemito(idDeDoc(d))
        setProcesando(false)
        setConfirmar(null)
        if (err) setAviso(err)
        else recargar()
      },
    })
  }

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
            anchoAcciones={130}
            acciones={(d) => {
              const [onEditar, onBorrar] =
                d.tipo === 'Nota de envío'
                  ? [() => editarNota(d), () => borrarNota(d)]
                  : [() => editarRemito(d), () => borrarRemito(d)]
              return (
                <>
                  <button type="button" className="empresas-editar" disabled={procesando} onClick={onEditar}>
                    Editar
                  </button>
                  <button type="button" className="empresas-borrar" disabled={procesando} onClick={onBorrar}>
                    Borrar
                  </button>
                </>
              )
            }}
          />
        )}
      </MenuContextual>

      {notaEditando && (
        <ModalNotaEnvio
          proyectoId={notaEditando.proyectoId}
          empresaId={notaEditando.empresaId}
          pedidoNro={notaEditando.pedidoNro}
          contactoId={null}
          esExterna={notaEditando.esExterna}
          notaEditar={notaEditando}
          onCerrar={() => setNotaEditando(null)}
          onGuardada={() => {
            setNotaEditando(null)
            recargar()
          }}
        />
      )}

      {confirmar && (
        <ModalConfirmar
          titulo="Confirmar borrado"
          mensaje={confirmar.mensaje}
          textoConfirmar="Borrar"
          peligroso
          procesando={procesando}
          onConfirmar={confirmar.onOk}
          onCancelar={() => setConfirmar(null)}
        />
      )}

      {aviso && (
        <ModalConfirmar
          titulo="Aviso"
          mensaje={aviso}
          soloAceptar
          textoConfirmar="Entendido"
          onConfirmar={() => setAviso(null)}
          onCancelar={() => setAviso(null)}
        />
      )}

      {remitoEditando && (
        <ModalEditarRemito
          remitoId={remitoEditando.id}
          numeroInicial={remitoEditando.numero4}
          fechaInicial={remitoEditando.fecha}
          onCerrar={() => setRemitoEditando(null)}
          onGuardado={() => {
            setRemitoEditando(null)
            recargar()
          }}
        />
      )}

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
