import { useRef } from 'react'

// Caja de foto presentacional. NO sube nada: avisa al padre qué archivo
// se eligió (onElegir) y cuándo se quita (onQuitar). El padre decide qué
// hacer (en proyectos: retener y subir al guardar).
function CajaFoto({
  previewUrl,
  onElegir,
  onQuitar,
}: {
  previewUrl: string | null
  onElegir: (file: File) => void
  onQuitar: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  // Pegar con Ctrl+V una imagen del portapapeles.
  function onPaste(e: React.ClipboardEvent<HTMLDivElement>) {
    const item = Array.from(e.clipboardData.items).find((i) =>
      i.type.startsWith('image/'),
    )
    if (item) {
      const file = item.getAsFile()
      if (file) onElegir(file)
    }
  }

  return (
    <div className="logo-empresa">
      <div className="logo-caja" tabIndex={0} onPaste={onPaste}>
        {previewUrl ? (
          <>
            <img src={previewUrl} alt="Foto" className="logo-img" />
            <button
              type="button"
              className="logo-quitar"
              onClick={onQuitar}
              title="Quitar foto"
            >
              ✕
            </button>
          </>
        ) : (
          <button
            type="button"
            className="logo-insertar"
            onClick={() => inputRef.current?.click()}
          >
            Insertar
          </button>
        )}
        <span className="logo-paste-hint">paste</span>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) onElegir(f)
          e.target.value = ''
        }}
      />
    </div>
  )
}

export default CajaFoto
