import { useState, useEffect } from 'react'
import Modal from '../../shared/components/Modal'
import { cargarDatosEtiqueta, imprimirEtiqueta, type DatosEtiqueta } from './etiquetaEnvio'

type Lista = 'ordenes' | 'remitos' | 'notas'

const VACIA: DatosEtiqueta = {
  destinatario: '',
  direccion: '',
  cp: '',
  telefono: '',
  ordenes: [''],
  remitos: [''],
  notas: [''],
}

// Etiqueta de envío del proyecto: todos los campos vienen precargados pero son
// editables, y la etiqueta se imprime (no se guarda).
function ModalEtiqueta({ proyectoId, onCerrar }: { proyectoId: number; onCerrar: () => void }) {
  const [d, setD] = useState<DatosEtiqueta>(VACIA)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let vivo = true
    cargarDatosEtiqueta(proyectoId)
      .then((datos) => {
        if (vivo) setD(datos)
      })
      .catch((e) => {
        if (vivo) setError(e instanceof Error ? e.message : 'No se pudieron cargar los datos.')
      })
      .finally(() => {
        if (vivo) setCargando(false)
      })
    return () => {
      vivo = false
    }
  }, [proyectoId])

  function setCampo(campo: 'destinatario' | 'direccion' | 'cp' | 'telefono', valor: string) {
    setD((prev) => ({ ...prev, [campo]: valor }))
  }
  function setItem(lista: Lista, idx: number, valor: string) {
    setD((prev) => ({ ...prev, [lista]: prev[lista].map((v, i) => (i === idx ? valor : v)) }))
  }
  function agregar(lista: Lista) {
    setD((prev) => ({ ...prev, [lista]: [...prev[lista], ''] }))
  }
  function quitar(lista: Lista, idx: number) {
    setD((prev) => {
      const arr = prev[lista].filter((_, i) => i !== idx)
      return { ...prev, [lista]: arr.length ? arr : [''] }
    })
  }

  function imprimir() {
    const r = imprimirEtiqueta(d)
    if (r.error) {
      setError(r.error)
      return
    }
    onCerrar()
  }

  function renderLista(lista: Lista, titulo: string) {
    return (
      <>
        <div className="ne-lineas-tit">
          <span>{titulo}</span>
          <button type="button" className="detalle-btn-add" onClick={() => agregar(lista)}>
            + Agregar
          </button>
        </div>
        {d[lista].map((valor, idx) => (
          <div key={idx} className="etq-fila">
            <input
              className="empresa-input"
              placeholder="—"
              value={valor}
              onChange={(e) => setItem(lista, idx, e.target.value)}
            />
            <button
              type="button"
              className="empresa-boton-peligro etq-quitar"
              title="Quitar"
              disabled={d[lista].length <= 1}
              onClick={() => quitar(lista, idx)}
            >
              ✕
            </button>
          </div>
        ))}
      </>
    )
  }

  return (
    <Modal titulo="Etiqueta de envío" onCerrar={onCerrar} ancho={560}>
      {cargando ? (
        <div className="rec-vacio">Cargando…</div>
      ) : (
        <>
          <p className="etq-ayuda">
            Todos los campos son editables. La etiqueta se imprime, no se guarda.
          </p>

          <label className="empresa-campo">
            Destinatario
            <input
              className="empresa-input"
              value={d.destinatario}
              onChange={(e) => setCampo('destinatario', e.target.value)}
            />
          </label>
          <label className="empresa-campo">
            Dirección
            <input
              className="empresa-input"
              placeholder="Incluí la localidad acá mismo"
              value={d.direccion}
              onChange={(e) => setCampo('direccion', e.target.value)}
            />
          </label>
          <div className="ne-campos">
            <label className="empresa-campo">
              Código postal
              <input className="empresa-input" value={d.cp} onChange={(e) => setCampo('cp', e.target.value)} />
            </label>
            <label className="empresa-campo">
              Teléfono
              <input
                className="empresa-input"
                value={d.telefono}
                onChange={(e) => setCampo('telefono', e.target.value)}
              />
            </label>
          </div>

          {renderLista('ordenes', 'Orden de compra')}
          {renderLista('remitos', 'Remito')}
          {renderLista('notas', 'Nota de envío')}

          {error && <p className="empresa-form-error">{error}</p>}

          <div className="pf-acciones">
            <button type="button" className="empresa-boton-secundario" onClick={onCerrar}>
              Cancelar
            </button>
            <button type="button" className="empresa-boton" onClick={imprimir}>
              🖨 Imprimir etiqueta
            </button>
          </div>
        </>
      )}
    </Modal>
  )
}

export default ModalEtiqueta
