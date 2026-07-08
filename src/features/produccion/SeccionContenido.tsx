import { useEffect, useState } from 'react'
import { supabase } from '../../shared/lib/supabaseClient'
import {
  cargarHijos,
  tipoLabel,
  eliminarElemento,
  tieneHijos,
} from './elementosApi'
import { contarProcesosPorElementos } from './procesosApi'
import type { Elemento } from './elementoTipos'
import { tiposHijoPermitidos } from './elementoTipos'
import { useEditorElemento } from './useEditorElemento'

const BUCKET = 'proyectos-fotos'

// Sección "Contenido": lista los hijos directos de un contenedor (un elemento o,
// si parentId es null, el proyecto raíz) y permite agregar/editar/borrar con
// persistencia inmediata. El alta/edición de elementos la maneja el hook
// useEditorElemento (compartido con VistaElemento y Proyectos).
function SeccionContenido({
  proyectoId,
  parentId,
  parentTipo,
  onEntrar,
  deshabilitado = false,
  leyenda,
}: {
  proyectoId: number
  parentId: number | null
  parentTipo: string | null
  onEntrar: (h: Elemento) => void
  deshabilitado?: boolean
  leyenda?: string
}) {
  const [hijos, setHijos] = useState<Elemento[]>([])
  const [contarProc, setContarProc] = useState<Record<number, number>>({})
  const [menuAgregar, setMenuAgregar] = useState(false)

  async function recargar() {
    if (deshabilitado) {
      setHijos([])
      setContarProc({})
      return
    }
    const hs = await cargarHijos(proyectoId, parentId)
    setHijos(hs)
    setContarProc(await contarProcesosPorElementos(hs.map((h) => h.id)))
  }

  useEffect(() => {
    recargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proyectoId, parentId, deshabilitado])

  // El menú "+ Agregar elemento" es un desplegable: cierra al clickear afuera,
  // hacer scroll o apretar Escape (a diferencia de los modales, que no cierran).
  useEffect(() => {
    if (!menuAgregar) return
    function cerrar() {
      setMenuAgregar(false)
    }
    function onTecla(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuAgregar(false)
    }
    window.addEventListener('click', cerrar)
    window.addEventListener('scroll', cerrar, true)
    window.addEventListener('keydown', onTecla)
    return () => {
      window.removeEventListener('click', cerrar)
      window.removeEventListener('scroll', cerrar, true)
      window.removeEventListener('keydown', onTecla)
    }
  }, [menuAgregar])

  const { abrirNuevo, abrirEditar, modal } = useEditorElemento(proyectoId, recargar)

  function fotoPublicUrl(path: string | null): string | null {
    return path
      ? supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
      : null
  }

  function nuevoHijo(tipo: string) {
    setMenuAgregar(false)
    abrirNuevo(tipo, parentId, parentTipo)
  }
  function editarHijo(h: Elemento) {
    abrirEditar(h, parentId, parentTipo)
  }
  async function borrarHijo(h: Elemento) {
    if (!window.confirm(`¿Borrar "${h.descripcion}"?`)) return
    if (await tieneHijos(h.id)) {
      window.alert(
        'Este elemento tiene elementos adentro. Vaciá o mové su contenido antes de borrarlo.',
      )
      return
    }
    await eliminarElemento(h.id)
    recargar()
  }

  return (
    <div className="vi-hijos">
      <div className="vi-proc-head">
        <h3 className="rec-titulo">Contenido</h3>
        <div className="vi-agregar">
          <button
            type="button"
            className="empresa-boton"
            disabled={deshabilitado}
            onClick={(e) => {
              e.stopPropagation()
              setMenuAgregar((v) => !v)
            }}
          >
            + Agregar elemento ▾
          </button>
          {menuAgregar && !deshabilitado && (
            <div className="vi-agregar-menu">
              {tiposHijoPermitidos(parentTipo).map((t) => (
                <button key={t} type="button" onClick={() => nuevoHijo(t)}>
                  {tipoLabel(t)}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {deshabilitado ? (
        <div className="rec-vacio">{leyenda ?? 'No disponible.'}</div>
      ) : hijos.length === 0 ? (
        <div className="rec-vacio">Todavía no hay elementos cargados.</div>
      ) : (
        <table className="tabla">
          <thead>
            <tr>
              <th></th>
              <th>Nº</th>
              <th>Tipo</th>
              <th>Descripción</th>
              <th>Cant.</th>
              <th>Estado</th>
              <th>Procesos</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {hijos.map((h, i) => {
              const mini = fotoPublicUrl(h.foto_url)
              return (
                <tr
                  key={h.id}
                  className="tabla-fila"
                  title="Doble click para entrar"
                  onDoubleClick={() => onEntrar(h)}
                >
                  <td>
                    {mini ? (
                      <img src={mini} alt="" className="vi-mini" />
                    ) : (
                      <span className="vi-mini vi-mini-vacia" />
                    )}
                  </td>
                  <td>{i + 1}</td>
                  <td>{tipoLabel(h.tipo)}</td>
                  <td>{h.descripcion}</td>
                  <td>{h.cantidad ?? 1}</td>
                  <td>{h.estado}</td>
                  <td>{contarProc[h.id] ?? 0} proceso(s)</td>
                  <td className="tabla-acciones">
                    <button
                      type="button"
                      className="empresas-editar"
                      onClick={(e) => {
                        e.stopPropagation()
                        editarHijo(h)
                      }}
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      className="empresas-borrar"
                      onClick={(e) => {
                        e.stopPropagation()
                        borrarHijo(h)
                      }}
                    >
                      Borrar
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}

      {modal}
    </div>
  )
}

export default SeccionContenido
