// Lista de checkboxes en 2 columnas, reutilizable. Se usa para elegir varias
// opciones a la vez (máquinas de un proceso, procesos de una máquina,
// operarios suplentes). Las opciones se reparten por columnas vía CSS
// (column-count), así que vienen ya ordenadas desde el que la usa.

export type OpcionCheck = { id: number; label: string }

function ChecklistColumnas({
  opciones,
  seleccionados,
  onToggle,
  vacio = 'No hay opciones.',
}: {
  opciones: OpcionCheck[]
  seleccionados: number[]
  onToggle: (id: number) => void
  vacio?: string
}) {
  if (opciones.length === 0) {
    return <div className="checklist-vacio">{vacio}</div>
  }
  const set = new Set(seleccionados)
  return (
    <div className="checklist-cols">
      {opciones.map((o) => (
        <label key={o.id} className="checklist-item">
          <input
            type="checkbox"
            checked={set.has(o.id)}
            onChange={() => onToggle(o.id)}
          />
          <span>{o.label}</span>
        </label>
      ))}
    </div>
  )
}

export default ChecklistColumnas
