import { useRef, useState } from 'react'
import { supabase } from '../../shared/lib/supabaseClient'

const BUCKET = 'empresas-logos'

function LogoEmpresa({
  empresaId,
  fotoUrl,
  onCambio,
}: {
  empresaId: number
  fotoUrl: string | null
  onCambio: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [subiendo, setSubiendo] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const urlPublica = fotoUrl
    ? supabase.storage.from(BUCKET).getPublicUrl(fotoUrl).data.publicUrl
    : null

  async function subirArchivo(file: File) {
    setError(null)
    if (!file.type.startsWith('image/')) {
      setError('El archivo no es una imagen.')
      return
    }
    setSubiendo(true)

    const ext = file.name.split('.').pop() || file.type.split('/')[1] || 'png'
    const ruta = `${empresaId}/${Date.now()}.${ext}`

    const { error: errSubida } = await supabase.storage
      .from(BUCKET)
      .upload(ruta, file, { upsert: true })

    if (errSubida) {
      setSubiendo(false)
      console.error('Error de subida:', errSubida)
      setError('No se pudo subir la imagen: ' + errSubida.message)
      return
    }

    if (fotoUrl) {
      await supabase.storage.from(BUCKET).remove([fotoUrl])
    }

    const { error: errUpdate } = await supabase
      .from('empresas')
      .update({ foto_url: ruta })
      .eq('id', empresaId)

    setSubiendo(false)
    if (errUpdate) {
      setError('Se subió la imagen pero no se pudo asociar a la empresa.')
      return
    }
    onCambio()
  }

  async function quitar() {
    setError(null)
    setSubiendo(true)
    if (fotoUrl) {
      await supabase.storage.from(BUCKET).remove([fotoUrl])
    }
    const { error: errUpdate } = await supabase
      .from('empresas')
      .update({ foto_url: null })
      .eq('id', empresaId)
    setSubiendo(false)
    if (errUpdate) {
      setError('No se pudo quitar el logo.')
      return
    }
    onCambio()
  }

  // Pegar con Ctrl+V una captura del portapapeles.
  function onPaste(e: React.ClipboardEvent<HTMLDivElement>) {
    const item = Array.from(e.clipboardData.items).find((i) =>
      i.type.startsWith('image/'),
    )
    if (item) {
      const file = item.getAsFile()
      if (file) subirArchivo(file)
    }
  }

  return (
    <div className="logo-empresa">
      {/* Recuadro único: zona de pegado (clic + Ctrl+V). */}
      <div className="logo-caja" tabIndex={0} onPaste={onPaste}>
        {urlPublica ? (
          <>
            <img src={urlPublica} alt="Logo" className="logo-img" />
            <button
              type="button"
              className="logo-quitar"
              onClick={quitar}
              disabled={subiendo}
              title="Quitar logo"
            >
              ✕
            </button>
          </>
        ) : (
          <button
            type="button"
            className="logo-insertar"
            onClick={() => inputRef.current?.click()}
            disabled={subiendo}
          >
            {subiendo ? 'Subiendo…' : 'Insertar'}
          </button>
        )}

        {/* Pista de pegado, abajo a la derecha. */}
        <span className="logo-paste-hint">paste</span>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) subirArchivo(f)
          e.target.value = ''
        }}
      />

      {error && <p className="empresa-form-error">{error}</p>}
    </div>
  )
}

export default LogoEmpresa
