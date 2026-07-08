import { useState } from 'react'
import Modal from '../../shared/components/Modal'
import { nombrePersonal } from '../../shared/types/recursos'
import type { Personal, Maquina, TipoProceso } from '../../shared/types/recursos'
import { guardarPersonal, inhabilitarPersonal } from '../../shared/lib/recursosApi'

// Paleta de colores de borde para el tablero. Al crear una persona se asigna el
// primero que no esté en uso (después se puede cambiar con el selector).
const PALETA = [
  '#C0392B', '#2980B9', '#27AE60', '#8E44AD', '#D35400', '#16A085',
  '#2C3E50', '#7F8C8D', '#C2185B', '#00838F', '#558B2F', '#6D4C41',
]

// "08:00:00" | "08:00" | null  ->  "08:00" | "" (lo que espera <input type=time>)
function hhmm(v: string | null): string {
  return v ? v.slice(0, 5) : ''
}

type RolMaq = 'ideal' | 'suplente'

// Modal para crear o editar una persona del taller. Edita el legajo (nombre,
// horarios, tablero, color) y las asignaciones de máquina (ideal/suplente) y de
// procesos sin máquina. Persiste directo y avisa al padre para recargar/cerrar.
function ModalPersonal({
  persona,
  maquinas,
  tiposProceso,
  personal,
  onGuardado,
  onCancelar,
}: {
  persona: Personal | null
  maquinas: Maquina[]
  tiposProceso: TipoProceso[]
  personal: Personal[]
  onGuardado: () => void
  onCancelar: () => void
}) {
  const esEditar = persona != null
  const myId = persona?.id ?? null

  // Color libre por defecto para una persona nueva.
  const colorLibre = (() => {
    const usados = new Set(personal.map((p) => p.colorBorde).filter(Boolean))
    return PALETA.find((c) => !usados.has(c)) ?? PALETA[0]
  })()

  const [nombre, setNombre] = useState(persona?.nombre ?? '')
  const [apellido, setApellido] = useState(persona?.apellido ?? '')
  const [entrada, setEntrada] = useState(hhmm(persona?.horarioEntrada ?? null))
  const [salida, setSalida] = useState(hhmm(persona?.horarioSalida ?? null))
  const [noTrabajaSab, setNoTrabajaSab] = useState(
    persona ? !persona.horarioSabadoInicio && !persona.horarioSabadoFin : false,
  )
  const [sabIni, setSabIni] = useState(
    hhmm(persona?.horarioSabadoInicio ?? null) || '08:00',
  )
  const [sabFin, setSabFin] = useState(
    hhmm(persona?.horarioSabadoFin ?? null) || '12:00',
  )
  const [enTablero, setEnTablero] = useState(persona?.enTablero ?? true)
  const [colorBorde, setColorBorde] = useState(persona?.colorBorde ?? colorLibre)

  // Rol de la persona por máquina. Ausente = "No".
  const [rolesMaq, setRolesMaq] = useState<Record<number, RolMaq>>(() => {
    const r: Record<number, RolMaq> = {}
    if (persona) {
      for (const m of maquinas) {
        if (m.operarioIdealId === persona.id) r[m.id] = 'ideal'
        else if (m.suplenteIds.includes(persona.id)) r[m.id] = 'suplente'
      }
    }
    return r
  })

  // Procesos sin máquina que "sabe hacer" (rol suplente). Los procesos donde la
  // persona es el ideal NO entran acá: se muestran tildados y bloqueados.
  const [skills, setSkills] = useState<number[]>(() =>
    persona
      ? tiposProceso
          .filter((t) => !t.llevaMaquina && t.suplenteIds.includes(persona.id))
          .map((t) => t.id)
      : [],
  )

  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  function setRol(maqId: number, rol: RolMaq | null) {
    setRolesMaq((prev) => {
      const next = { ...prev }
      if (rol === null) delete next[maqId]
      else next[maqId] = rol
      return next
    })
  }
  function toggleSkill(id: number) {
    setSkills((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  function nombrePorId(id: number): string {
    const p = personal.find((x) => x.id === id)
    return p ? nombrePersonal(p) : '(?)'
  }

  const maquinasOrden = maquinas
    .slice()
    .sort((a, b) => a.nombre.localeCompare(b.nombre))
  const procSinMaquina = tiposProceso
    .filter((t) => !t.llevaMaquina)
    .sort((a, b) => a.nombre.localeCompare(b.nombre))

  async function guardar() {
    if (nombre.trim() === '') {
      setError('El nombre es obligatorio.')
      return
    }

    const maquinasIdeal = Object.entries(rolesMaq)
      .filter(([, r]) => r === 'ideal')
      .map(([k]) => Number(k))
    const maquinasSuplente = Object.entries(rolesMaq)
      .filter(([, r]) => r === 'suplente')
      .map(([k]) => Number(k))

    // Aviso de desplazamiento: máquinas donde esta persona pasa a ser ideal y
    // ya tenían otro ideal (ese otro va a pasar a suplente).
    const desplazados = maquinasIdeal
      .map((mid) => maquinas.find((m) => m.id === mid))
      .filter((m): m is Maquina => m != null)
      .filter((m) => m.operarioIdealId != null && m.operarioIdealId !== myId)
      .map((m) => ({
        maq: m.nombre,
        op: nombrePorId(m.operarioIdealId as number),
      }))
    if (desplazados.length) {
      const lista = desplazados
        .map((d) => `• ${d.maq}: ${d.op} → suplente`)
        .join('\n')
      const ok = window.confirm(
        'Estas máquinas ya tenían otro operario ideal. Si continuás, ese ' +
          'operario pasa a suplente:\n\n' +
          lista,
      )
      if (!ok) return
    }

    setGuardando(true)
    const { error: err } = await guardarPersonal({
      id: persona?.id ?? null,
      nombre,
      apellido: apellido.trim() || null,
      horarioEntrada: entrada || null,
      horarioSalida: salida || null,
      horarioSabadoInicio: noTrabajaSab ? null : sabIni || null,
      horarioSabadoFin: noTrabajaSab ? null : sabFin || null,
      enTablero,
      colorBorde,
      maquinasIdeal,
      maquinasSuplente,
      procesosSinMaquinaSuplente: skills,
    })
    setGuardando(false)
    if (err) {
      setError(err)
      return
    }
    onGuardado()
  }

  async function inhabilitar() {
    if (!persona) return
    const ok = window.confirm(
      `¿Inhabilitar a "${nombrePersonal(persona)}"? Queda oculta de los ` +
        'listados y deja de estar asignada a máquinas y procesos. No borra nada ' +
        'de su historial.',
    )
    if (!ok) return
    setGuardando(true)
    const { error: err } = await inhabilitarPersonal(persona.id)
    setGuardando(false)
    if (err) {
      setError(err)
      return
    }
    onGuardado()
  }

  return (
    <Modal titulo={esEditar ? 'Editar persona' : 'Nueva persona'} onCerrar={onCancelar} ancho={560}>

        {/* Nombre + apellido */}
        <div className="pers-fila-2">
          <label className="empresa-campo">
            Nombre *
            <input
              className="empresa-input"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              autoFocus
            />
          </label>
          <label className="empresa-campo">
            Apellido
            <input
              className="empresa-input"
              value={apellido}
              onChange={(e) => setApellido(e.target.value)}
            />
          </label>
        </div>

        {/* Horario lun-vie */}
        <div className="pers-fila-2">
          <label className="empresa-campo">
            Entrada (lun-vie)
            <input
              type="time"
              className="empresa-input"
              value={entrada}
              onChange={(e) => setEntrada(e.target.value)}
            />
          </label>
          <label className="empresa-campo">
            Salida (lun-vie)
            <input
              type="time"
              className="empresa-input"
              value={salida}
              onChange={(e) => setSalida(e.target.value)}
            />
          </label>
        </div>

        {/* Horario sábado */}
        <div className="pers-sabado">
          <label className="filtro-check">
            <input
              type="checkbox"
              checked={noTrabajaSab}
              onChange={(e) => setNoTrabajaSab(e.target.checked)}
            />
            No trabaja sábados
          </label>
          <div className="pers-fila-2">
            <label className="empresa-campo">
              Sábado entrada
              <input
                type="time"
                className="empresa-input"
                value={sabIni}
                disabled={noTrabajaSab}
                onChange={(e) => setSabIni(e.target.value)}
              />
            </label>
            <label className="empresa-campo">
              Sábado salida
              <input
                type="time"
                className="empresa-input"
                value={sabFin}
                disabled={noTrabajaSab}
                onChange={(e) => setSabFin(e.target.value)}
              />
            </label>
          </div>
        </div>

        {/* Tablero + color */}
        <div className="empresa-campo">
          <label className="filtro-check">
            <input
              type="checkbox"
              checked={enTablero}
              onChange={(e) => setEnTablero(e.target.checked)}
            />
            Aparece en el tablero de planificación
          </label>
          <span className="pf-ayuda">
            Destildá para personal que no se planifica (administración,
            dirección).
          </span>
          {enTablero && (
            <div className="pers-color">
              <span className="pf-label">Color en el tablero</span>
              <input
                type="color"
                className="pers-color-input"
                value={colorBorde ?? '#0c447c'}
                onChange={(e) => setColorBorde(e.target.value)}
              />
              <span className="pers-color-hex">{colorBorde}</span>
            </div>
          )}
        </div>

        {/* Máquinas: No / Suplente / Ideal por fila */}
        <div className="empresa-campo">
          <span className="pf-label">Máquinas que puede usar</span>
          <div className="pers-maq-tabla">
            <div className="pers-maq-head">
              <div className="pers-maq-col-nombre">Máquina</div>
              <div className="pers-maq-col-opt">No</div>
              <div className="pers-maq-col-opt">Supl.</div>
              <div className="pers-maq-col-opt">Ideal</div>
            </div>
            {maquinasOrden.map((m) => {
              const rol = rolesMaq[m.id]
              return (
                <div key={m.id} className="pers-maq-fila">
                  <div className="pers-maq-col-nombre">{m.nombre}</div>
                  <div className="pers-maq-col-opt">
                    <input
                      type="radio"
                      name={`maq-${m.id}`}
                      checked={!rol}
                      onChange={() => setRol(m.id, null)}
                    />
                  </div>
                  <div className="pers-maq-col-opt">
                    <input
                      type="radio"
                      name={`maq-${m.id}`}
                      checked={rol === 'suplente'}
                      onChange={() => setRol(m.id, 'suplente')}
                    />
                  </div>
                  <div className="pers-maq-col-opt">
                    <input
                      type="radio"
                      name={`maq-${m.id}`}
                      checked={rol === 'ideal'}
                      onChange={() => setRol(m.id, 'ideal')}
                    />
                  </div>
                </div>
              )
            })}
          </div>
          <span className="pf-ayuda">
            Ideal o Suplente por máquina. Si la marcás Ideal en una que ya tenía
            otro ideal, ese pasa a suplente (te lo avisa al guardar).
          </span>
        </div>

        {/* Procesos sin máquina */}
        <div className="empresa-campo">
          <span className="pf-label">Procesos sin máquina que sabe hacer</span>
          {procSinMaquina.length === 0 ? (
            <span className="pf-ayuda">
              No hay procesos sin máquina cargados.
            </span>
          ) : (
            <div className="pers-proc-cols">
              {procSinMaquina.map((t) => {
                const esIdeal = t.operarioIdealId === myId && myId != null
                const checked = esIdeal || skills.includes(t.id)
                return (
                  <label
                    key={t.id}
                    className="filtro-check"
                    title={
                      esIdeal ? 'Es el ideal — se cambia desde Procesos' : ''
                    }
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={esIdeal}
                      onChange={() => toggleSkill(t.id)}
                    />
                    {t.nombre}
                    {esIdeal ? ' (ideal)' : ''}
                  </label>
                )
              })}
            </div>
          )}
          <span className="pf-ayuda">
            Procesos como Compra, Control o Despacho. Los que llevan máquina se
            definen asignando la máquina.
          </span>
        </div>

        {error && <p className="empresa-form-error">{error}</p>}

        <div className="pf-acciones">
          <button
            type="button"
            className="empresa-boton-secundario"
            onClick={onCancelar}
          >
            Cancelar
          </button>
          {esEditar && (
            <button
              type="button"
              className="empresa-boton-peligro"
              onClick={inhabilitar}
              disabled={guardando}
            >
              Inhabilitar
            </button>
          )}
          <button
            type="button"
            className="empresa-boton"
            onClick={guardar}
            disabled={guardando}
          >
            {guardando ? 'Guardando…' : esEditar ? 'Guardar' : 'Crear'}
          </button>
        </div>
    </Modal>
  )
}

export default ModalPersonal
