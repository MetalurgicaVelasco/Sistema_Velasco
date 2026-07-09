import { useState, useEffect } from 'react'
import Modal from '../../shared/components/Modal'
import MenuContextual from '../../shared/components/MenuContextual'
import {
  cargarSectores,
  crearSector,
  crearEquipo,
  renombrarSector,
  renombrarEquipo,
  borrarSector,
  borrarEquipo,
  type Sector,
  type Equipo,
} from './sectoresApi'

// Ubicaciones del cliente: Sector → Equipo. Es donde se instalan las piezas del
// catálogo (matriz de productos). Cada cliente tiene su "Sector General" y cada
// sector su "Sin equipo específico"; esos no se borran ni se renombran.
//
// Árbol plegable: el sector se colapsa/expande con ▸/▾ (arrancan expandidos).
function SectoresEmpresa({ empresaId }: { empresaId: number }) {
  const [sectores, setSectores] = useState<Sector[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [colapsados, setColapsados] = useState<Set<number>>(new Set())
  const [seleccionadoId, setSeleccionadoId] = useState<string | null>(null)

  const [modal, setModal] = useState<
    | { tipo: 'sector-nuevo' }
    | { tipo: 'sector-editar'; sector: Sector }
    | { tipo: 'equipo-nuevo'; sector: Sector }
    | { tipo: 'equipo-editar'; equipo: Equipo }
    | null
  >(null)
  const [nombre, setNombre] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [errorModal, setErrorModal] = useState<string | null>(null)

  async function recargar() {
    setCargando(true)
    try {
      setSectores(await cargarSectores(empresaId))
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar los sectores.')
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    recargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId])

  function togglePlegado(sectorId: number) {
    setColapsados((prev) => {
      const n = new Set(prev)
      if (n.has(sectorId)) n.delete(sectorId)
      else n.add(sectorId)
      return n
    })
  }

  function abrir(m: NonNullable<typeof modal>, nombreInicial = '') {
    setModal(m)
    setNombre(nombreInicial)
    setErrorModal(null)
  }

  async function guardar() {
    if (!modal) return
    const limpio = nombre.trim()
    if (limpio === '') {
      setErrorModal('El nombre es obligatorio.')
      return
    }
    setGuardando(true)
    try {
      if (modal.tipo === 'sector-nuevo') await crearSector(empresaId, limpio)
      else if (modal.tipo === 'sector-editar') await renombrarSector(modal.sector.id, limpio)
      else if (modal.tipo === 'equipo-nuevo') await crearEquipo(modal.sector.id, limpio)
      else await renombrarEquipo(modal.equipo.id, limpio)
      setModal(null)
      await recargar()
    } catch (e) {
      setErrorModal(e instanceof Error ? e.message : 'No se pudo guardar.')
    } finally {
      setGuardando(false)
    }
  }

  async function eliminarSector(s: Sector) {
    if (!window.confirm(`¿Borrar el sector "${s.nombre}"?`)) return
    const { error } = await borrarSector(s)
    if (error) {
      window.alert(error)
      return
    }
    recargar()
  }

  async function eliminarEquipo(e: Equipo) {
    if (!window.confirm(`¿Borrar el equipo "${e.nombre}"?`)) return
    const { error } = await borrarEquipo(e)
    if (error) {
      window.alert(error)
      return
    }
    recargar()
  }

  const tituloModal =
    modal?.tipo === 'sector-nuevo'
      ? 'Nuevo sector'
      : modal?.tipo === 'sector-editar'
        ? 'Editar sector'
        : modal?.tipo === 'equipo-nuevo'
          ? `Nuevo equipo en "${modal.sector.nombre}"`
          : 'Editar equipo'

  // Menú contextual: las opciones dependen de sobre qué fila se hizo clic derecho.
  // Sobre el vacío de la franja, solo "Nuevo sector".
  function itemsMenu(e: React.MouseEvent) {
    const fila = (e.target as HTMLElement).closest('[data-sector-id], [data-equipo-id]')
    const sectorId = fila?.getAttribute('data-sector-id')
    const equipoId = fila?.getAttribute('data-equipo-id')

    if (equipoId) {
      const eq = sectores.flatMap((s) => s.equipos).find((x) => x.id === Number(equipoId))
      const sec = sectores.find((s) => s.id === eq?.sector_id)
      return [
        ...(sec ? [{ label: `Nuevo equipo en "${sec.nombre}"`, onSelect: () => abrir({ tipo: 'equipo-nuevo', sector: sec }) }] : []),
        ...(eq && !eq.es_general
          ? [
              { label: `Editar "${eq.nombre}"`, onSelect: () => abrir({ tipo: 'equipo-editar', equipo: eq }, eq.nombre) },
              { label: `Borrar "${eq.nombre}"`, onSelect: () => eliminarEquipo(eq) },
            ]
          : []),
        { label: 'Nuevo sector', onSelect: () => abrir({ tipo: 'sector-nuevo' }) },
      ]
    }

    if (sectorId) {
      const sec = sectores.find((s) => s.id === Number(sectorId))
      if (!sec) return [{ label: 'Nuevo sector', onSelect: () => abrir({ tipo: 'sector-nuevo' }) }]
      return [
        { label: `Nuevo equipo en "${sec.nombre}"`, onSelect: () => abrir({ tipo: 'equipo-nuevo', sector: sec }) },
        ...(!sec.es_general
          ? [
              { label: `Editar "${sec.nombre}"`, onSelect: () => abrir({ tipo: 'sector-editar', sector: sec }, sec.nombre) },
              { label: `Borrar "${sec.nombre}"`, onSelect: () => eliminarSector(sec) },
            ]
          : []),
        { label: 'Nuevo sector', onSelect: () => abrir({ tipo: 'sector-nuevo' }) },
      ]
    }

    return [{ label: 'Nuevo sector', onSelect: () => abrir({ tipo: 'sector-nuevo' }) }]
  }

  return (
    <div className="subtabla sec-zona">
      <MenuContextual items={itemsMenu}>
        {cargando ? (
          <div className="empresas-estado">Cargando sectores…</div>
        ) : error ? (
          <div className="empresas-estado">{error}</div>
        ) : sectores.length === 0 ? (
          <p className="empresas-vacio">Esta empresa no tiene sectores cargados.</p>
        ) : (
          <table className="tabla">
            <thead>
              <tr>
                <th>Sector / Equipo</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sectores.map((s) => {
                const plegado = colapsados.has(s.id)
                return [
                  <tr
                    key={`s-${s.id}`}
                    data-sector-id={s.id}
                    className={'tabla-fila sec-fila-sector' + (seleccionadoId === `s-${s.id}` ? ' seleccionada' : '')}
                    onClick={() => setSeleccionadoId(`s-${s.id}`)}
                    onContextMenu={() => setSeleccionadoId(`s-${s.id}`)}
                  >
                    <td>
                      <button
                        type="button"
                        className="sec-toggle"
                        title={plegado ? 'Expandir' : 'Contraer'}
                        onClick={(ev) => {
                          ev.stopPropagation()
                          togglePlegado(s.id)
                        }}
                      >
                        {plegado ? '▸' : '▾'}
                      </button>
                      <b>{s.nombre}</b>
                      {s.es_general ? <span className="sec-badge">por defecto</span> : null}
                      {plegado && s.equipos.length ? (
                        <span className="sec-badge">{s.equipos.length} equipo(s)</span>
                      ) : null}
                    </td>
                    <td className="tabla-acciones">
                      <button type="button" className="empresas-editar" onClick={() => abrir({ tipo: 'equipo-nuevo', sector: s })}>
                        + Equipo
                      </button>
                      {!s.es_general ? (
                        <>
                          <button
                            type="button"
                            className="empresas-editar"
                            onClick={() => abrir({ tipo: 'sector-editar', sector: s }, s.nombre)}
                          >
                            Editar
                          </button>
                          <button type="button" className="empresas-borrar" onClick={() => eliminarSector(s)}>
                            Borrar
                          </button>
                        </>
                      ) : null}
                    </td>
                  </tr>,
                  ...(plegado
                    ? []
                    : s.equipos.map((e) => (
                        <tr
                          key={`e-${e.id}`}
                          data-equipo-id={e.id}
                          className={'tabla-fila' + (seleccionadoId === `e-${e.id}` ? ' seleccionada' : '')}
                          onClick={() => setSeleccionadoId(`e-${e.id}`)}
                          onContextMenu={() => setSeleccionadoId(`e-${e.id}`)}
                        >
                          <td className="sec-celda-equipo">
                            <span className="sec-rama">└</span>
                            {e.nombre}
                            {e.es_general ? <span className="sec-badge">por defecto</span> : null}
                          </td>
                          <td className="tabla-acciones">
                            {!e.es_general ? (
                              <>
                                <button
                                  type="button"
                                  className="empresas-editar"
                                  onClick={() => abrir({ tipo: 'equipo-editar', equipo: e }, e.nombre)}
                                >
                                  Editar
                                </button>
                                <button type="button" className="empresas-borrar" onClick={() => eliminarEquipo(e)}>
                                  Borrar
                                </button>
                              </>
                            ) : null}
                          </td>
                        </tr>
                      ))),
                ]
              })}
            </tbody>
          </table>
        )}
      </MenuContextual>

      {modal && (
        <Modal titulo={tituloModal} onCerrar={() => setModal(null)}>
          <div className="empresa-form-modal">
            <label className="empresa-campo">
              Nombre *
              <input
                className="empresa-input"
                value={nombre}
                autoFocus
                onChange={(ev) => setNombre(ev.target.value)}
                onKeyDown={(ev) => {
                  if (ev.key === 'Enter') guardar()
                }}
              />
            </label>
            {errorModal && <p className="empresa-form-error">{errorModal}</p>}
            <div className="empresa-modal-acciones">
              <button type="button" className="empresa-boton-secundario" onClick={() => setModal(null)}>
                Cancelar
              </button>
              <button type="button" className="empresa-boton" onClick={guardar} disabled={guardando}>
                {guardando ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

export default SectoresEmpresa
