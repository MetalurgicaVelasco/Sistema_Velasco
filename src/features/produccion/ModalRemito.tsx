import { useState, useEffect } from 'react'
import Modal from '../../shared/components/Modal'
import {
  cargarNotasAbiertas,
  cargarLineasDirectas,
  crearRemito,
  PREFIJO_IMPRESO_REMITO,
  type NotaAbierta,
  type LineaDirecta,
} from './remitosApi'

// Carga de un remito de TacticaSoft. Dos modos, como en el sistema viejo:
//  - Cerrar notas de envío ya emitidas (esas unidades no se vuelven a contar).
//  - Remito directo: se remite sin nota previa (sí suma cantidad remitida).
function ModalRemito({
  proyectoId,
  empresaId,
  onCerrar,
  onGuardado,
}: {
  proyectoId: number
  empresaId: number
  onCerrar: () => void
  onGuardado: (numero: string) => void
}) {
  const [modo, setModo] = useState<'nota' | 'directo'>('nota')
  const [notas, setNotas] = useState<NotaAbierta[]>([])
  const [directas, setDirectas] = useState<LineaDirecta[]>([])
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [numero, setNumero] = useState('')
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10))

  // Selección: ítems de nota marcados, y cantidades del modo directo.
  const [marcados, setMarcados] = useState<Set<number>>(new Set())
  const [cantDirecta, setCantDirecta] = useState<Record<number, number>>({})

  useEffect(() => {
    let vivo = true
    Promise.all([cargarNotasAbiertas(proyectoId), cargarLineasDirectas(proyectoId)])
      .then(([n, d]) => {
        if (!vivo) return
        setNotas(n)
        setDirectas(d)
        // Por defecto se marcan todos los ítems de las notas abiertas y se
        // precargan las cantidades pendientes del modo directo.
        setMarcados(new Set(n.flatMap((x) => x.items.map((it) => it.itemId))))
        setCantDirecta(Object.fromEntries(d.map((l) => [l.elementoId, l.pendiente])))
        if (n.length === 0) setModo('directo')
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

  function toggle(itemId: number) {
    setMarcados((prev) => {
      const n = new Set(prev)
      if (n.has(itemId)) n.delete(itemId)
      else n.add(itemId)
      return n
    })
  }

  async function guardar() {
    setError(null)
    if (!fecha) {
      setError('Ingresá la fecha.')
      return
    }
    const lineas =
      modo === 'nota'
        ? notas.flatMap((n) =>
            n.items
              .filter((it) => marcados.has(it.itemId))
              .map((it) => ({
                elementoId: it.elementoId,
                notaEnvioId: n.notaId,
                descripcion: it.descripcion,
                cantidad: it.cantidad,
              })),
          )
        : directas
            .filter((l) => (cantDirecta[l.elementoId] ?? 0) > 0)
            .map((l) => ({
              elementoId: l.elementoId,
              notaEnvioId: null,
              descripcion: l.descripcion,
              cantidad: cantDirecta[l.elementoId] ?? 0,
            }))
    if (!lineas.length) {
      setError(
        modo === 'nota'
          ? 'Marcá al menos un ítem de una nota de envío.'
          : 'Cargá al menos un ítem con cantidad.',
      )
      return
    }
    const excedido = directas.find(
      (l) => modo === 'directo' && (cantDirecta[l.elementoId] ?? 0) > l.pendiente,
    )
    if (excedido) {
      setError(`"${excedido.descripcion}" supera lo pendiente (${excedido.pendiente}).`)
      return
    }

    setGuardando(true)
    const r = await crearRemito({ proyectoId, empresaId, numeroDigitos: numero, fecha, tipo: modo, lineas })
    setGuardando(false)
    if (r.error) {
      setError(r.error)
      return
    }
    onGuardado(r.numero ?? '')
  }

  return (
    <Modal titulo="Cargar remito" onCerrar={onCerrar} ancho={760}>
      {cargando ? (
        <div className="rec-vacio">Cargando…</div>
      ) : (
        <>
          <div className="ne-campos">
            <label className="empresa-campo">
              Nº de remito *
              <div className="ne-numimp">
                <span className="ne-numimp-pref">{PREFIJO_IMPRESO_REMITO}</span>
                <input
                  className="empresa-input"
                  maxLength={4}
                  placeholder="0000"
                  value={numero}
                  onChange={(e) => setNumero(e.target.value.replace(/\D/g, ''))}
                />
              </div>
            </label>
            <label className="empresa-campo">
              Fecha *
              <input type="date" className="empresa-input" value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </label>
          </div>

          <div className="rm-modos">
            <button
              type="button"
              className={'rm-modo' + (modo === 'nota' ? ' rm-modo-activo' : '')}
              disabled={notas.length === 0}
              title={notas.length === 0 ? 'No hay notas de envío pendientes de remitir' : undefined}
              onClick={() => setModo('nota')}
            >
              Cerrar notas de envío
            </button>
            <button
              type="button"
              className={'rm-modo' + (modo === 'directo' ? ' rm-modo-activo' : '')}
              onClick={() => setModo('directo')}
            >
              Remito sin nota de envío
            </button>
          </div>

          {modo === 'nota' ? (
            <div className="rm-lista">
              {notas.length === 0 ? (
                <div className="rec-vacio">No hay notas de envío pendientes de remitir.</div>
              ) : (
                notas.map((n) => (
                  <div key={n.notaId} className="rm-nota">
                    <div className="rm-nota-tit">Nota {n.numero}</div>
                    {n.items.map((it) => (
                      <label key={it.itemId} className="rm-item">
                        <input
                          type="checkbox"
                          checked={marcados.has(it.itemId)}
                          onChange={() => toggle(it.itemId)}
                        />
                        <span className="rm-item-desc">{it.descripcion}</span>
                        <span className="rm-item-cant">{it.cantidad}</span>
                      </label>
                    ))}
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="rm-lista">
              {directas.filter((l) => l.pendiente > 0).length === 0 ? (
                <div className="rec-vacio">No queda nada pendiente de remitir en este proyecto.</div>
              ) : (
                directas
                  .filter((l) => l.pendiente > 0)
                  .map((l, i) => (
                    <div key={l.elementoId} className={'rm-directa' + (i % 2 ? ' rm-directa-alt' : '')}>
                      <span className="rm-item-desc">{l.descripcion}</span>
                      <input
                        type="number"
                        min={0}
                        max={l.pendiente}
                        className="empresa-input ne-linea-cant"
                        value={cantDirecta[l.elementoId] ?? 0}
                        onChange={(e) =>
                          setCantDirecta((prev) => ({
                            ...prev,
                            [l.elementoId]: Math.max(0, Number(e.target.value) || 0),
                          }))
                        }
                      />
                      <span className="ne-linea-max">de {l.pendiente}</span>
                    </div>
                  ))
              )}
            </div>
          )}

          {modo === 'nota' && (
            <p className="rm-nota-pie">
              Las unidades de estas notas ya cuentan como remitidas, así que este remito no las suma
              de nuevo.
            </p>
          )}

          {error && <p className="empresa-form-error">{error}</p>}

          <div className="pf-acciones">
            <button type="button" className="empresa-boton-secundario" onClick={onCerrar}>
              Cancelar
            </button>
            <button type="button" className="empresa-boton" onClick={guardar} disabled={guardando}>
              {guardando ? 'Guardando…' : 'Cargar remito'}
            </button>
          </div>
        </>
      )}
    </Modal>
  )
}

export default ModalRemito
