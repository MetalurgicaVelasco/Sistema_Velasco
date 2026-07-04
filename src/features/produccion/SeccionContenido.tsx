import { useEffect, useState } from 'react'
import { supabase } from '../../shared/lib/supabaseClient'
import {
  cargarHijos,
  tipoLabel,
  crearElemento,
  actualizarElemento,
  eliminarElemento,
  tieneHijos,
} from './elementosApi'
import { contarProcesosPorElementos } from './procesosApi'
import { elementoDraftVacio, elementoRowADraft, crearMaterial } from './elementoTipos'
import type { Elemento, ElementoDraft, Material } from './elementoTipos'
import ModalItem from './ModalItem'

const BUCKET = 'proyectos-fotos'

// Sección "Contenido": lista los hijos directos de un contenedor (un elemento o,
// si parentId es null, el proyecto raíz) y permite agregar/editar/borrar con
// persistencia inmediata. Reutilizable por la vista de elemento y el form del
// proyecto. `onEntrar` decide qué pasa al doble-click en un hijo (entrar a él).
function SeccionContenido({
  proyectoId,
  parentId,
  onEntrar,
  deshabilitado = false,
  leyenda,
}: {
  proyectoId: number
  parentId: number | null
  onEntrar: (h: Elemento) => void
  deshabilitado?: boolean
  leyenda?: string
}) {
  const [hijos, setHijos] = useState<Elemento[]>([])
  const [contarProc, setContarProc] = useState<Record<number, number>>({})
  const [materiales, setMateriales] = useState<Material[]>([])
  const [modalElem, setModalElem] = useState<{ draft: ElementoDraft } | null>(null)
  const [menuAgregar, setMenuAgregar] = useState(false)

  // Materiales para el modal (una sola vez).
  useEffect(() => {
    supabase
      .from('materiales')
      .select('id, nombre')
      .order('nombre')
      .then(({ data }) => setMateriales((data as Material[] | null) ?? []))
  }, [])

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

  function fotoPublicUrl(path: string | null): string | null {
    return path
      ? supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
      : null
  }

  function nuevoHijo(tipo: string) {
    setMenuAgregar(false)
    setModalElem({ draft: { ...elementoDraftVacio(), tipo } })
  }
  function editarHijo(h: Elemento) {
    setModalElem({ draft: elementoRowADraft(h) })
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
  async function guardarElemento(draft: ElementoDraft) {
    // Un elemento con hijos no puede volverse Componente (un componente es hoja).
    if (
      draft.dbId != null &&
      draft.tipo === 'componente' &&
      (await tieneHijos(draft.dbId))
    ) {
      window.alert(
        'Este elemento tiene elementos adentro; no puede pasar a Componente. ' +
          'Primero vaciá o mové su contenido.',
      )
      return
    }
    if (draft.dbId == null) {
      await crearElemento(draft, proyectoId, parentId)
    } else {
      await actualizarElemento(draft, proyectoId, parentId)
    }
    setModalElem(null)
    recargar()
  }
  async function onAgregarMaterial(nombre: string): Promise<Material | null> {
    const m = await crearMaterial(nombre)
    if (m) {
      setMateriales((prev) =>
        [...prev, m].sort((a, b) => a.nombre.localeCompare(b.nombre)),
      )
    }
    return m
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
            onClick={() => setMenuAgregar((v) => !v)}
          >
            + Agregar elemento ▾
          </button>
          {menuAgregar && !deshabilitado && (
            <div className="vi-agregar-menu">
              <button type="button" onClick={() => nuevoHijo('conjunto')}>
                Conjunto
              </button>
              <button type="button" onClick={() => nuevoHijo('subconjunto')}>
                Subconjunto
              </button>
              <button type="button" onClick={() => nuevoHijo('componente')}>
                Componente
              </button>
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

      {modalElem && (
        <ModalItem
          draft={modalElem.draft}
          materiales={materiales}
          onAgregarMaterial={onAgregarMaterial}
          onGuardar={guardarElemento}
          onCancelar={() => setModalElem(null)}
        />
      )}
    </div>
  )
}

export default SeccionContenido
