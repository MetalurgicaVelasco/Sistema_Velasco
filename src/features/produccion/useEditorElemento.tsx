import { useEffect, useState } from 'react'
import { supabase } from '../../shared/lib/supabaseClient'
import { crearElemento, actualizarElemento, tieneHijos } from './elementosApi'
import { DOMINIO_PROYECTO, type DominioElemento } from './dominioElemento'
import { elementoDraftVacio, elementoRowADraft, crearMaterial, tiposHijoPermitidos } from './elementoTipos'
import type { Elemento, ElementoDraft, Material } from './elementoTipos'
import ModalItem from './ModalItem'

// Editor de elementos reutilizable. Encapsula el modal (ModalItem), la carga de
// materiales y el guardar (crear o actualizar). Lo comparten los tres lugares que
// dan de alta / editan elementos: la lista de hijos (SeccionContenido), el
// elemento actual (VistaElemento) y el "Nuevo elemento" de la franja 3 (Proyectos).
//
// Devuelve:
//  - abrirNuevo(tipo, parentId): abre el modal para crear un elemento bajo parentId.
//  - abrirEditar(elemento, parentId): abre el modal para editar un elemento existente.
//  - modal: el JSX del modal (o null); ubicalo en el render de quien use el hook.
export function useEditorElemento(
  proyectoId: number,
  onGuardado: () => void,
  dom: DominioElemento = DOMINIO_PROYECTO,
) {
  const [materiales, setMateriales] = useState<Material[]>([])
  const [modalElem, setModalElem] = useState<{
    draft: ElementoDraft
    parentId: number | null
    tipoPadre: string | null
  } | null>(null)

  // Materiales para el selector del modal (una sola vez).
  useEffect(() => {
    supabase
      .from('materiales')
      .select('id, nombre')
      .order('nombre')
      .then(({ data }) => setMateriales((data as Material[] | null) ?? []))
  }, [])

  function abrirNuevo(tipo: string, parentId: number | null, tipoPadre: string | null) {
    setModalElem({ draft: { ...elementoDraftVacio(), tipo }, parentId, tipoPadre })
  }
  function abrirEditar(elemento: Elemento, parentId: number | null, tipoPadre: string | null) {
    setModalElem({ draft: elementoRowADraft(elemento), parentId, tipoPadre })
  }

  async function guardar(draft: ElementoDraft) {
    if (!modalElem) return
    // Un elemento con hijos no puede volverse Componente (un componente es hoja).
    if (
      draft.dbId != null &&
      draft.tipo === 'componente' &&
      (await tieneHijos(draft.dbId, dom))
    ) {
      window.alert(
        'Este elemento tiene elementos adentro; no puede pasar a Componente. ' +
          'Primero vaciá o mové su contenido.',
      )
      return
    }
    if (draft.dbId == null) {
      await crearElemento(draft, proyectoId, modalElem.parentId, dom)
    } else {
      await actualizarElemento(draft, proyectoId, modalElem.parentId, dom)
    }
    setModalElem(null)
    onGuardado()
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

  const modal = modalElem ? (
    <ModalItem
      draft={modalElem.draft}
      materiales={materiales}
      tiposPermitidos={tiposHijoPermitidos(modalElem.tipoPadre)}
      onAgregarMaterial={onAgregarMaterial}
      onGuardar={guardar}
      onCancelar={() => setModalElem(null)}
    />
  ) : null

  return { abrirNuevo, abrirEditar, modal }
}
