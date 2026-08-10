import { useState, useEffect, useRef, useCallback } from 'react'
import Modal from './Modal'
import {
  cargarFotos,
  subirFoto,
  borrarFoto,
  marcarPrincipal,
  maximo,
  type Duenio,
  type Foto,
} from '../lib/fotosApi'

// Fotos de un proyecto o elemento. En la pantalla ocupa SIEMPRE lo mismo (una
// miniatura y, si hay más, un recuadro "+N"), así cargar fotos no le roba
// espacio ni mueve los campos del formulario. La administración va en un modal.
//
// La primera es la principal: la que se ve en el tablero y en los documentos.
function GaleriaFotos({ duenio, deshabilitado = false }: { duenio: Duenio; deshabilitado?: boolean }) {
  const [fotos, setFotos] = useState<Foto[]>([])
  const [cargando, setCargando] = useState(true)
  const [trabajando, setTrabajando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [modalAbierto, setModalAbierto] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const clave = 'proyectoId' in duenio ? 'p' + duenio.proyectoId : 'e' + duenio.elementoId
  const tope = maximo(duenio)

  const recargar = useCallback(() => {
    setCargando(true)
    cargarFotos(duenio)
      .then((f) => {
        setFotos(f)
        setError(null)
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'No se pudieron cargar las fotos.'))
      .finally(() => setCargando(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave])

  useEffect(() => {
    recargar()
  }, [recargar])

  async function agregar(files: FileList | File[]) {
    setTrabajando(true)
    setError(null)
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue
      const { error: err } = await subirFoto(duenio, file)
      if (err) {
        setError(err)
        break
      }
    }
    setTrabajando(false)
    recargar()
  }

  async function accion(fn: () => Promise<{ error?: string }>) {
    setTrabajando(true)
    const { error: err } = await fn()
    setTrabajando(false)
    if (err) setError(err)
    else recargar()
  }

  function onPaste(e: React.ClipboardEvent<HTMLDivElement>) {
    const items = Array.from(e.clipboardData.items).filter((i) => i.type.startsWith('image/'))
    const files = items.map((i) => i.getAsFile()).filter((f): f is File => !!f)
    if (files.length) agregar(files)
  }

  const lleno = fotos.length >= tope
  const restantes = Math.max(0, fotos.length - 1)

  // El input es uno solo y lo usan la caja de insertar y el botón de agregar.
  const input = (
    <input
      ref={inputRef}
      type="file"
      accept="image/*"
      multiple
      className="gal-input"
      onChange={(e) => {
        if (e.target.files?.length) agregar(e.target.files)
        e.target.value = ''
      }}
    />
  )

  return (
    <div className="gal">
      <span className="pf-label">Fotos</span>

      {/* Vista compacta: alto fijo, no crece con la cantidad de fotos. */}
      <div className="gal-compacta">
        {cargando ? (
          <div className="gal-mini gal-mini-vacia">…</div>
        ) : fotos.length === 0 ? (
          <div
            className="gal-insertar"
            tabIndex={0}
            onPaste={onPaste}
            title="Pegá una imagen con Ctrl+V o tocá Insertar"
          >
            <button
              type="button"
              className="gal-insertar-btn"
              disabled={deshabilitado || trabajando}
              onClick={() => inputRef.current?.click()}
            >
              {trabajando ? 'Subiendo…' : 'Insertar'}
            </button>
          </div>
        ) : (
          <>
            <button
              type="button"
              className="gal-mini"
              title="Ver todas las fotos"
              onClick={() => setModalAbierto(true)}
            >
              <img src={fotos[0].url} alt="Foto principal" />
            </button>
            {/* Debajo de la miniatura: cuántas más hay y el botón de agregar. */}
            <div className="gal-compacta-pie">
              {restantes > 0 && (
                <button
                  type="button"
                  className="gal-mas"
                  title="Ver todas las fotos"
                  onClick={() => setModalAbierto(true)}
                >
                  +{restantes}
                </button>
              )}
              <button
                type="button"
                className="gal-agregar"
                disabled={deshabilitado || trabajando || lleno}
                title={lleno ? `Máximo ${tope} fotos` : 'Agregar foto'}
                onClick={() => inputRef.current?.click()}
              >
                {trabajando ? '…' : '+ Foto'}
              </button>
            </div>
          </>
        )}
        {input}
      </div>

      {error && <p className="empresa-form-error gal-error">{error}</p>}

      {/* Modal: acá se administran todas (agregar, quitar, cambiar principal). */}
      {modalAbierto && (
        <Modal titulo={`Fotos (${fotos.length}/${tope})`} onCerrar={() => setModalAbierto(false)} ancho={620}>
          <span className="pf-ayuda gal-ayuda">
            La primera es la principal (se ve en el tablero y los documentos). ★ para cambiarla.
          </span>

          {error && <p className="empresa-form-error">{error}</p>}

          <div className="gal-grid">
            {fotos.map((f, i) => (
              <figure key={f.id} className={'gal-item' + (i === 0 ? ' gal-item-principal' : '')}>
                <img src={f.url} alt={i === 0 ? 'Foto principal' : `Foto ${i + 1}`} />
                {i === 0 && <span className="gal-badge">principal</span>}
                <div className="gal-acciones">
                  {i !== 0 && (
                    <button
                      type="button"
                      className="gal-btn"
                      title="Marcar como principal"
                      disabled={deshabilitado || trabajando}
                      onClick={() => accion(() => marcarPrincipal(duenio, f.id))}
                    >
                      ★
                    </button>
                  )}
                  <button
                    type="button"
                    className="gal-btn gal-btn-borrar"
                    title="Quitar foto"
                    disabled={deshabilitado || trabajando}
                    onClick={() => accion(() => borrarFoto(duenio, f))}
                  >
                    ✕
                  </button>
                </div>
              </figure>
            ))}

            {!lleno && (
              <div
                className="gal-insertar"
                tabIndex={0}
                onPaste={onPaste}
                title="Pegá una imagen con Ctrl+V o tocá Insertar"
              >
                <button
                  type="button"
                  className="gal-insertar-btn"
                  disabled={deshabilitado || trabajando}
                  onClick={() => inputRef.current?.click()}
                >
                  {trabajando ? 'Subiendo…' : 'Insertar'}
                </button>
              </div>
            )}
          </div>

          <div className="pf-acciones">
            <button type="button" className="empresa-boton-secundario" onClick={() => setModalAbierto(false)}>
              Cerrar
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}

export default GaleriaFotos
