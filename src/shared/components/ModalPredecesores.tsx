import Modal from './Modal'

// Aviso al intentar marcar un proceso como hecho cuando quedan procesos
// anteriores sin cerrar. Lista los pendientes (del más lejano al más cercano,
// que es el orden en que hay que cerrarlos) y permite cerrarlos desde acá.
//
// Es presentacional: recibe la lista y los callbacks; quién marca y cómo recarga
// lo decide cada módulo (Proyectos y Tablero escriben distinto).
export default function ModalPredecesores({
  destino,
  pendientes,
  trabajando,
  onMarcarUno,
  onMarcarTodo,
  onCerrar,
}: {
  destino: string
  pendientes: { id: number; nombre: string; elemento: string }[]
  trabajando: boolean
  onMarcarUno: (id: number) => void
  onMarcarTodo: () => void
  onCerrar: () => void
}) {
  return (
    <Modal titulo="Faltan procesos anteriores" onCerrar={onCerrar} ancho={520}>
      <p className="pred-intro">
        Para marcar <b>{destino}</b> como hecho, primero hay que cerrar
        {pendientes.length === 1 ? ' este proceso anterior:' : ` estos ${pendientes.length} procesos anteriores:`}
      </p>
      <div className="pred-lista">
        {pendientes.map((p, i) => (
          <div key={p.id} className={'pred-item' + (i % 2 ? ' pred-item-alt' : '')}>
            <div className="pred-txt">
              <div className="pred-proc">{p.nombre}</div>
              <div className="pred-el">{p.elemento}</div>
            </div>
            <button
              type="button"
              className="pred-btn-hecho"
              disabled={trabajando}
              onClick={() => onMarcarUno(p.id)}
            >
              ✓ Hecho
            </button>
          </div>
        ))}
      </div>
      <div className="pred-acciones">
        <button
          type="button"
          className="empresa-boton-secundario"
          onClick={onCerrar}
          disabled={trabajando}
        >
          Cancelar
        </button>
        <button type="button" className="empresa-boton" onClick={onMarcarTodo} disabled={trabajando}>
          {trabajando ? 'Marcando…' : 'Marcar todo como Hecho'}
        </button>
      </div>
    </Modal>
  )
}
