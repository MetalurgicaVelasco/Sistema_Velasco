import { useRef, useState } from 'react'
import {
  fijarValor,
  moverSegmento,
  aPaso,
  sumaDe,
  type Segmento,
} from '../../features/actividades/reparto'

// Barra para repartir un total de minutos entre varios segmentos.
//
// La gracia: al arrastrar un marcador, lo que un segmento crece el de al lado lo
// pierde, así el total SIEMPRE cierra y no hay que recalcular nada. Los extremos
// están fijos: con N segmentos hay N−1 marcadores.
//
// Se puede arrastrar (a saltos de 5 minutos, porque con el dedo no se apunta al
// minuto) o escribir el número exacto.
function BarraReparto({
  segmentos,
  total,
  onCambio,
  etiqueta,
  color,
}: {
  segmentos: Segmento[]
  total: number
  onCambio: (segs: Segmento[]) => void
  etiqueta: (tipo: string) => string
  color?: (tipo: string) => string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [arrastrando, setArrastrando] = useState<number | null>(null)

  if (!segmentos.length || total <= 0) return null

  // Ancho mínimo visible: un segmento de 5 minutos sobre 8 horas sería
  // imposible de agarrar con el dedo, así que nunca baja de este porcentaje.
  const MIN_PCT = 7
  const crudos = segmentos.map((s) => (s.min / total) * 100)
  const faltantes = crudos.reduce((acc, p) => acc + Math.max(0, MIN_PCT - p), 0)
  const sobrante = crudos.reduce((acc, p) => acc + Math.max(0, p - MIN_PCT), 0)
  const anchos = crudos.map((p) =>
    p < MIN_PCT ? MIN_PCT : sobrante > 0 ? p - (p - MIN_PCT) * (faltantes / sobrante) : p,
  )

  function minutosDesdeX(clientX: number): number {
    const caja = ref.current?.getBoundingClientRect()
    if (!caja || caja.width === 0) return 0
    const pct = Math.max(0, Math.min(1, (clientX - caja.left) / caja.width))
    return pct * total
  }

  // Al mover el marcador `i` se fija el acumulado hasta ese punto: el segmento i
  // toma lo que va desde donde arranca hasta el cursor.
  function moverA(i: number, clientX: number) {
    const previos = segmentos.slice(0, i).reduce((acc, s) => acc + s.min, 0)
    const nuevo = aPaso(minutosDesdeX(clientX) - previos)
    onCambio(fijarValor(segmentos, i, nuevo))
  }

  function empezarArrastre(e: React.PointerEvent, i: number) {
    e.preventDefault()
    setArrastrando(i)
    const mover = (ev: PointerEvent) => moverA(i, ev.clientX)
    const soltar = () => {
      setArrastrando(null)
      window.removeEventListener('pointermove', mover)
      window.removeEventListener('pointerup', soltar)
    }
    window.addEventListener('pointermove', mover)
    window.addEventListener('pointerup', soltar)
  }

  const suma = sumaDe(segmentos)

  return (
    <div className="rep">
      <div className="rep-barra" ref={ref}>
        {segmentos.map((s, i) => (
          <div
            key={s.tipo}
            className={'rep-seg rep-seg-' + s.tipo}
            style={{ width: anchos[i] + '%', background: color?.(s.tipo) }}
          >
            <span className="rep-seg-tit">{etiqueta(s.tipo)}</span>
          </div>
        ))}

        {/* Un marcador por cada borde interno. */}
        {segmentos.slice(0, -1).map((s, i) => {
          const izq = anchos.slice(0, i + 1).reduce((a, b) => a + b, 0)
          return (
            <button
              key={'m' + s.tipo}
              type="button"
              className={'rep-marcador' + (arrastrando === i ? ' rep-marcador-activo' : '')}
              style={{ left: izq + '%' }}
              title="Arrastrar para repartir"
              onPointerDown={(e) => empezarArrastre(e, i)}
            />
          )
        })}
      </div>

      {/* Los minutos van debajo de cada segmento y se mueven con él. */}
      <div className="rep-valores">
        {segmentos.map((s, i) => (
          <div key={s.tipo} className="rep-valor" style={{ width: anchos[i] + '%' }}>
            <input
              type="number"
              min={0}
              max={total}
              className="rep-input"
              value={s.min}
              onChange={(e) => onCambio(fijarValor(segmentos, i, Number(e.target.value) || 0))}
            />
            <span className="rep-pct">{Math.round((s.min / total) * 100)}%</span>
            {segmentos.length > 1 && (
              <span className="rep-orden">
                <button
                  type="button"
                  className="rep-orden-btn"
                  disabled={i === 0}
                  title="Mover antes"
                  onClick={() => onCambio(moverSegmento(segmentos, i, i - 1))}
                >
                  ‹
                </button>
                <button
                  type="button"
                  className="rep-orden-btn"
                  disabled={i === segmentos.length - 1}
                  title="Mover después"
                  onClick={() => onCambio(moverSegmento(segmentos, i, i + 1))}
                >
                  ›
                </button>
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Con la mecánica de vecinos esto no debería pasar nunca; si pasa, es un
          error y conviene verlo. */}
      {suma !== total && (
        <p className="empresa-form-error">
          El reparto suma {suma} min y el total es {total} min.
        </p>
      )}
    </div>
  )
}

export default BarraReparto
