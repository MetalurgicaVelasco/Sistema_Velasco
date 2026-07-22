import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import Modal from './Modal'
import type { ConfigTabla } from './TablaConfigurable'

// Panel para configurar las columnas de una TablaConfigurable: mostrar/ocultar
// (checkbox) y reordenar (arrastre con dnd-kit). No persiste: sube los cambios
// por onConfig; la persistencia es aparte (Fase 3).
export default function PanelColumnas({
  columnas,
  config,
  onConfig,
  onCerrar,
}: {
  columnas: { id: string; titulo: string }[]
  config: ConfigTabla
  onConfig: (c: ConfigTabla) => void
  onCerrar: () => void
}) {
  const tituloDe = (id: string) => columnas.find((c) => c.id === id)?.titulo ?? id
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const from = config.findIndex((c) => c.id === active.id)
    const to = config.findIndex((c) => c.id === over.id)
    if (from < 0 || to < 0) return
    onConfig(arrayMove(config, from, to))
  }

  function toggle(id: string) {
    onConfig(config.map((c) => (c.id === id ? { ...c, visible: !c.visible } : c)))
  }

  const visibles = config.filter((c) => c.visible).length

  return (
    <Modal titulo="Columnas" onCerrar={onCerrar} ancho={320}>
      <p className="pcol-ayuda">Arrastrá para reordenar. Destildá para ocultar.</p>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={config.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          <div className="pcol-lista">
            {config.map((c) => (
              <FilaColumna
                key={c.id}
                id={c.id}
                titulo={tituloDe(c.id)}
                visible={c.visible}
                soloVisible={c.visible && visibles === 1}
                onToggle={() => toggle(c.id)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </Modal>
  )
}

function FilaColumna({
  id,
  titulo,
  visible,
  soloVisible,
  onToggle,
}: {
  id: string
  titulo: string
  visible: boolean
  soloVisible: boolean
  onToggle: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }
  return (
    <div ref={setNodeRef} style={style} className="pcol-item">
      <span className="pcol-grip" {...attributes} {...listeners} title="Arrastrar para reordenar">
        ⠿
      </span>
      <label className="pcol-check">
        <input
          type="checkbox"
          checked={visible}
          disabled={soloVisible}
          onChange={onToggle}
          title={soloVisible ? 'Tiene que quedar al menos una columna visible' : undefined}
        />
        {titulo}
      </label>
    </div>
  )
}
