import { useState, useEffect } from 'react'
import { supabase } from '../../shared/lib/supabaseClient'
import Modal from '../../shared/components/Modal'
import MenuContextual from '../../shared/components/MenuContextual'
import VistaProyectoForm from './VistaProyectoForm'
import { fechaCorta } from './proyectoTipos'
import type { Proyecto, Empresa } from './proyectoTipos'

const SELECT_PROYECTO =
  'id, empresa_id, contacto_id, pedido_nro, descripcion, urgencia, estado, sub_estado_cerrado, fecha_ingreso, fecha_entrega, fecha_limite_cotizar, paso_por_solicitud, observaciones_mail, observaciones_anulacion, cliente_final_empresa_id, cliente_final_texto, moneda, oc_cliente, foto_url, empresa:empresas!empresa_id ( nombre )'

function Proyectos() {
  const [proyectos, setProyectos] = useState<Proyecto[]>([])
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [seleccionadoId, setSeleccionadoId] = useState<number | null>(null)

  // null = lista; 'nuevo' = formulario nuevo; Proyecto = formulario editar
  const [formActivo, setFormActivo] = useState<'nuevo' | Proyecto | null>(null)

  // Borrar
  const [proyectoBorrando, setProyectoBorrando] = useState<Proyecto | null>(null)
  const [borrando, setBorrando] = useState(false)
  const [errorBorrar, setErrorBorrar] = useState<string | null>(null)

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

  const seleccionado = proyectos.find((p) => p.id === seleccionadoId) ?? null

  function volverALista() {
    setFormActivo(null)
    cargarProyectos()
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
        </MenuContextual>
      </div>

      {/* Franja 3 — Detalle del proyecto seleccionado */}
      <div className="franja franja-detalle">
        {seleccionado ? (
          <div className="detalle">
            <div className="detalle-header">
              <h3 className="detalle-titulo">
                #{seleccionado.id} — {seleccionado.descripcion}
              </h3>
              <div className="detalle-acciones">
                <button
                  type="button"
                  className="empresas-editar"
                  onClick={() => setFormActivo(seleccionado)}
                >
                  Editar
                </button>
                <button
                  type="button"
                  className="empresas-borrar"
                  onClick={() => {
                    setProyectoBorrando(seleccionado)
                    setErrorBorrar(null)
                  }}
                >
                  Borrar
                </button>
              </div>
            </div>
            <span className="franja-placeholder">
              Items del proyecto (próximamente)
            </span>
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
