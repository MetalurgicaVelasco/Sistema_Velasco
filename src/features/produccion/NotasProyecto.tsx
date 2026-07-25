import { useState, useEffect } from 'react'
import ModalConfirmar from '../../shared/components/ModalConfirmar'
import {
  cargarNotasProyecto,
  crearNotaProyecto,
  eliminarNotaProyecto,
  type NotaProyecto,
} from './notasProyectoApi'

function fmtFechaHora(iso: string): string {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`
}

// Solapa "Notas del Proyecto": notas que se van dejando en un proyecto. Guardan
// autor (usuario logueado) y fecha/hora. Se muestran de la más nueva a la vieja.
function NotasProyecto({ proyectoId }: { proyectoId: number }) {
  const [notas, setNotas] = useState<NotaProyecto[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [texto, setTexto] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [borrar, setBorrar] = useState<NotaProyecto | null>(null)

  async function recargar() {
    setCargando(true)
    try {
      setNotas(await cargarNotasProyecto(proyectoId))
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar las notas.')
    } finally {
      setCargando(false)
    }
  }
  useEffect(() => {
    recargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proyectoId])

  async function agregar() {
    if (texto.trim() === '') return
    setGuardando(true)
    const { error: err } = await crearNotaProyecto(proyectoId, texto)
    setGuardando(false)
    if (err) {
      setError(err)
      return
    }
    setTexto('')
    recargar()
  }

  async function hacerBorrar() {
    if (!borrar) return
    const { error: err } = await eliminarNotaProyecto(borrar.id)
    setBorrar(null)
    if (err) {
      setError(err)
      return
    }
    recargar()
  }

  return (
    <div className="subtabla" style={{ padding: '8px 10px' }}>
      <div style={{ marginBottom: 10 }}>
        <textarea
          className="empresa-input"
          rows={3}
          placeholder="Escribí una nota para este proyecto…"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
          <button
            type="button"
            className="empresa-boton"
            disabled={guardando || texto.trim() === ''}
            onClick={agregar}
          >
            {guardando ? 'Guardando…' : 'Agregar nota'}
          </button>
        </div>
      </div>

      {error && <p className="empresa-form-error">{error}</p>}

      {cargando ? (
        <div className="empresas-estado">Cargando notas…</div>
      ) : notas.length === 0 ? (
        <p className="empresas-vacio">Este proyecto no tiene notas.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {notas.map((n) => (
            <div
              key={n.id}
              style={{
                border: '1px solid #d9d7cf',
                borderRadius: 6,
                padding: '6px 10px',
                background: '#fff',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 11,
                  color: '#6b6a66',
                  marginBottom: 3,
                }}
              >
                <b style={{ color: '#2c2c2a' }}>{n.creado_por_nombre ?? '(sin autor)'}</b>
                <span>·</span>
                <span>{fmtFechaHora(n.created_at)}</span>
                <button
                  type="button"
                  className="empresas-borrar"
                  style={{ marginLeft: 'auto' }}
                  onClick={() => setBorrar(n)}
                >
                  Borrar
                </button>
              </div>
              <div style={{ whiteSpace: 'pre-wrap', fontSize: 13, color: '#2c2c2a' }}>{n.contenido}</div>
            </div>
          ))}
        </div>
      )}

      {borrar && (
        <ModalConfirmar
          titulo="Borrar nota"
          mensaje="¿Borrar esta nota? No se puede deshacer."
          textoConfirmar="Borrar"
          peligroso
          onConfirmar={hacerBorrar}
          onCancelar={() => setBorrar(null)}
        />
      )}
    </div>
  )
}

export default NotasProyecto
