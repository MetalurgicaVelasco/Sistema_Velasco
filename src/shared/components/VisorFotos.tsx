import { useState, useEffect } from 'react'
import { cargarFotosVista, type FotoVista } from '../lib/fotosApi'

// Visor de fotos con flechitas: se recorren de a una. Muestra primero las del
// ítem (la principal adelante) y después las del proyecto, marcadas como tales.
// Es solo lectura: se usa en la carpeta y en la actividad del operario.
function VisorFotos({
  elementoId,
  proyectoId,
  titulo = 'Fotos',
}: {
  elementoId: number
  proyectoId: number | null
  titulo?: string
}) {
  const [fotos, setFotos] = useState<FotoVista[]>([])
  const [i, setI] = useState(0)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let vivo = true
    setCargando(true)
    cargarFotosVista(elementoId, proyectoId)
      .then((f) => {
        if (!vivo) return
        setFotos(f)
        setI(0)
      })
      .catch(() => {
        if (vivo) setFotos([])
      })
      .finally(() => {
        if (vivo) setCargando(false)
      })
    return () => {
      vivo = false
    }
  }, [elementoId, proyectoId])

  if (cargando) return <div className="rec-vacio">Cargando fotos…</div>
  if (fotos.length === 0) return null

  const actual = fotos[Math.min(i, fotos.length - 1)]
  const hayVarias = fotos.length > 1
  const ir = (delta: number) => setI((prev) => (prev + delta + fotos.length) % fotos.length)

  return (
    <div className="vis">
      <div className="ot-completar-band">
        {titulo}
        <span className="vis-contador">
          {i + 1} de {fotos.length}
        </span>
      </div>

      <div className="vis-marco">
        {hayVarias && (
          <button type="button" className="vis-flecha vis-flecha-izq" title="Anterior" onClick={() => ir(-1)}>
            ‹
          </button>
        )}

        <img src={actual.url} alt={actual.origen === 'item' ? 'Foto de la pieza' : 'Foto del proyecto'} />

        {/* De dónde salió la foto: la del proyecto es contexto, no la pieza. */}
        <span className={'vis-origen' + (actual.origen === 'proyecto' ? ' vis-origen-proy' : '')}>
          {actual.origen === 'item' ? 'Pieza' : 'Proyecto'}
        </span>

        {hayVarias && (
          <button type="button" className="vis-flecha vis-flecha-der" title="Siguiente" onClick={() => ir(1)}>
            ›
          </button>
        )}
      </div>

      {hayVarias && (
        <div className="vis-puntos">
          {fotos.map((f, idx) => (
            <button
              key={f.id}
              type="button"
              className={'vis-punto' + (idx === i ? ' vis-punto-activo' : '')}
              title={`Foto ${idx + 1}`}
              onClick={() => setI(idx)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default VisorFotos
