import { useEffect, useState } from 'react'
import Modal from '../../shared/components/Modal'
import { contiene } from '../../shared/lib/texto'
import { tipoLabel } from './elementosApi'
import { tiposHijoPermitidos } from './elementoTipos'
import { cargarTodos, agregarHijo, cargarComposicion, type ElementoMatriz } from './matrizApi'

// Agrega al conjunto una pieza QUE YA EXISTE en el catálogo, con la cantidad que
// va en ESE conjunto. Es lo que hace reutilizable al catálogo: el mismo manguito
// puede ir 4 veces en un conjunto y 1 vez en otro.
function ModalAgregarExistente({
  padre,
  onAgregado,
  onCancelar,
}: {
  padre: { id: number; tipo: string }
  onAgregado: () => void
  onCancelar: () => void
}) {
  const [todos, setTodos] = useState<ElementoMatriz[]>([])
  const [yaEstan, setYaEstan] = useState<Set<number>>(new Set())
  const [busqueda, setBusqueda] = useState('')
  const [elegido, setElegido] = useState<ElementoMatriz | null>(null)
  const [cantidad, setCantidad] = useState('1')
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  const tiposOk = tiposHijoPermitidos(padre.tipo)

  useEffect(() => {
    cargarTodos().then(setTodos)
    cargarComposicion(padre.id).then((hijos) => setYaEstan(new Set(hijos.map((h) => h.id))))
  }, [padre.id])

  // Candidatos: del tipo permitido, que no sean el propio padre ni ya estén dentro.
  const candidatos = todos
    .filter((e) => tiposOk.includes(e.tipo))
    .filter((e) => e.id !== padre.id && !yaEstan.has(e.id))
    .filter((e) => busqueda.trim() === '' || contiene(`${e.descripcion} ${e.codigo_cliente ?? ''}`, busqueda))
    .slice(0, 40)

  async function agregar() {
    setError(null)
    if (!elegido) {
      setError('Elegí un elemento de la lista.')
      return
    }
    const cant = Number(cantidad)
    if (!Number.isFinite(cant) || cant <= 0) {
      setError('La cantidad debe ser mayor a cero.')
      return
    }
    setGuardando(true)
    try {
      await agregarHijo(padre.id, elegido.id, cant)
      onAgregado()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo agregar.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Modal titulo="Agregar elemento existente" onCerrar={onCancelar} ancho={560}>
      <p className="pf-ayuda" style={{ marginBottom: 10 }}>
        Elegí una pieza del catálogo e indicá cuántas unidades van en este conjunto. La misma pieza puede usarse en
        varios conjuntos con cantidades distintas.
      </p>

      <label className="empresa-campo">
        Buscar
        <input
          className="empresa-input"
          placeholder="Descripción o código"
          value={busqueda}
          autoFocus
          onChange={(e) => setBusqueda(e.target.value)}
        />
      </label>

      <div className="mae-lista">
        {candidatos.length === 0 ? (
          <div className="rec-vacio">No hay elementos disponibles para agregar.</div>
        ) : (
          candidatos.map((e) => (
            <div
              key={e.id}
              className={'mae-fila' + (elegido?.id === e.id ? ' elegido' : '')}
              onClick={() => setElegido(e)}
            >
              <span className="mtz-desc">{e.descripcion}</span>
              <span className="mtz-tipo">{tipoLabel(e.tipo)}</span>
              {e.codigo_cliente ? <span className="mtz-cod">{e.codigo_cliente}</span> : null}
            </div>
          ))
        )}
      </div>

      {elegido ? (
        <label className="empresa-campo">
          Cantidad de "{elegido.descripcion}" en este conjunto *
          <input
            type="number"
            className="empresa-input"
            min="0"
            step="1"
            value={cantidad}
            onChange={(e) => setCantidad(e.target.value)}
          />
        </label>
      ) : null}

      {error && <p className="empresa-form-error">{error}</p>}

      <div className="pf-acciones">
        <button type="button" className="empresa-boton-secundario" onClick={onCancelar}>
          Cancelar
        </button>
        <button type="button" className="empresa-boton" onClick={agregar} disabled={guardando || !elegido}>
          {guardando ? 'Agregando…' : 'Agregar'}
        </button>
      </div>
    </Modal>
  )
}

export default ModalAgregarExistente
