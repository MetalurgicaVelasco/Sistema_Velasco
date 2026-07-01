import { useEffect, useState } from 'react'
import ModalPersonal from './ModalPersonal'
import { cargarRecursos } from '../../shared/lib/recursosApi'
import { nombrePersonal } from '../../shared/types/recursos'
import type {
  Personal as TPersonal,
  Maquina,
  TipoProceso,
} from '../../shared/types/recursos'

// "08:00:00" | "08:00" | null  ->  "08:00" | ""
function hhmm(v: string | null): string {
  return v ? v.slice(0, 5) : ''
}

// Módulo RRHH > Personal: el legajo de cada persona del taller (horarios,
// tablero) y sus asignaciones de máquina/proceso.
function Personal() {
  const [personal, setPersonal] = useState<TPersonal[]>([])
  const [maquinas, setMaquinas] = useState<Maquina[]>([])
  const [tiposProceso, setTiposProceso] = useState<TipoProceso[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [modal, setModal] = useState<{ persona: TPersonal | null } | null>(null)

  async function cargar() {
    setCargando(true)
    try {
      const data = await cargarRecursos()
      setPersonal(data.personal)
      setMaquinas(data.maquinas)
      setTiposProceso(data.tiposProceso)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar el personal.')
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    cargar()
  }, [])

  function horarioTexto(p: TPersonal): string {
    const e = hhmm(p.horarioEntrada)
    const s = hhmm(p.horarioSalida)
    return e || s ? `${e || '?'}–${s || '?'}` : '(sin horario)'
  }

  function maqTexto(p: TPersonal): string {
    const ideal = maquinas
      .filter((m) => m.operarioIdealId === p.id)
      .map((m) => `${m.nombre} (ideal)`)
    const supl = maquinas
      .filter((m) => m.suplenteIds.includes(p.id))
      .map((m) => m.nombre)
    const todas = [...ideal, ...supl]
    return todas.length ? todas.join(', ') : '(sin máquinas)'
  }

  function procTexto(p: TPersonal): string {
    return tiposProceso
      .filter(
        (t) =>
          !t.llevaMaquina &&
          (t.operarioIdealId === p.id || t.suplenteIds.includes(p.id)),
      )
      .map((t) => (t.operarioIdealId === p.id ? `${t.nombre} (ideal)` : t.nombre))
      .join(', ')
  }

  function onGuardado() {
    setModal(null)
    cargar()
  }

  const lista = personal
    .slice()
    .sort((a, b) => nombrePersonal(a).localeCompare(nombrePersonal(b)))

  return (
    <div className="rec-vista">
      <div className="rec-cont">
        <div className="rec-head-bar">
          <h2 className="rec-titulo">Personal</h2>
          <button
            type="button"
            className="empresa-boton"
            onClick={() => setModal({ persona: null })}
          >
            + Nueva persona
          </button>
        </div>
        <p className="rec-ayuda">
          Personal del taller. Las máquinas y procesos definen qué puede hacer
          cada persona. El check "Aparece en el tablero" controla si se la puede
          planificar.
        </p>

        {cargando ? (
          <div className="rec-vacio">Cargando…</div>
        ) : error ? (
          <div className="empresa-form-error">{error}</div>
        ) : lista.length === 0 ? (
          <div className="rec-vacio">
            No hay personal cargado. Apretá "+ Nueva persona" para empezar.
          </div>
        ) : (
          <div className="rec-lista">
            <div className="rec-col-head">
              <div style={{ width: 180 }}>Nombre</div>
              <div style={{ width: 100 }}>Horario</div>
              <div style={{ width: 80 }}>Tablero</div>
              <div style={{ flex: 1 }}>Máquinas / Procesos</div>
              <div style={{ width: 80 }} />
            </div>
            {lista.map((p) => {
              const procs = procTexto(p)
              return (
                <div key={p.id} className="rec-fila">
                  <div style={{ width: 180 }} className="rec-nombre">
                    {nombrePersonal(p)}
                  </div>
                  <div
                    style={{ width: 100 }}
                    className={
                      p.horarioEntrada || p.horarioSalida
                        ? 'rec-celda'
                        : 'rec-celda rec-celda-tenue'
                    }
                  >
                    {horarioTexto(p)}
                  </div>
                  <div style={{ width: 80 }} className="rec-celda">
                    {p.enTablero ? (
                      <>
                        <span
                          className="pers-swatch"
                          style={{ background: p.colorBorde ?? '#ccc' }}
                        />
                        Sí
                      </>
                    ) : (
                      '— No'
                    )}
                  </div>
                  <div style={{ flex: 1 }} className="pers-mp">
                    🛠 {maqTexto(p)}
                    {procs && (
                      <>
                        <br />⚙ {procs}
                      </>
                    )}
                  </div>
                  <div style={{ width: 80, textAlign: 'right' }}>
                    <button
                      type="button"
                      className="empresa-boton-secundario rec-boton-chico"
                      onClick={() => setModal({ persona: p })}
                    >
                      Editar
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {modal && (
        <ModalPersonal
          persona={modal.persona}
          maquinas={maquinas}
          tiposProceso={tiposProceso}
          personal={personal}
          onGuardado={onGuardado}
          onCancelar={() => setModal(null)}
        />
      )}
    </div>
  )
}

export default Personal
