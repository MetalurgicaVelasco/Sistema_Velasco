import { useState, useEffect, useCallback } from 'react'
import { cargarIdentidad, type Identidad } from '../../shared/lib/recursosApi'
import { guardarVista, leerVista } from '../../shared/lib/vistaModulos'
import VistaActividad from './VistaActividad'
import {
  cargarActividadesDelDia,
  cargarAtrasadas,
  cargarOperarios,
  type Actividad,
  type OperarioOpcion,
} from './actividadesApi'

function hoyISO(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function sumarDias(iso: string, dias: number): string {
  const [a, m, d] = iso.split('-').map(Number)
  const f = new Date(a, m - 1, d + dias)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${f.getFullYear()}-${p(f.getMonth() + 1)}-${p(f.getDate())}`
}

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

function tituloFecha(iso: string): string {
  const [a, m, d] = iso.split('-').map(Number)
  const f = new Date(a, m - 1, d)
  const hoy = hoyISO()
  const etiqueta = iso === hoy ? 'Hoy' : iso === sumarDias(hoy, -1) ? 'Ayer' : iso === sumarDias(hoy, 1) ? 'Mañana' : ''
  const base = `${DIAS[f.getDay()]} ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`
  return etiqueta ? `${etiqueta} — ${base}` : base
}

function duracion(min: number): string {
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  return h ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`
}

const MODULO = 'actividades-personal'

// Estado que se conserva al salir del módulo y volver: en qué día estaba, a
// quién miraba y qué actividad tenía abierta.
type VistaActividades = {
  fecha: string
  verPersonalId: number | null
  actividadAbierta: number | null
  carpetaAbierta: boolean
}

// Pantalla del operario: sus actividades planificadas, con navegación por día.
// Los supervisores pueden mirar la agenda de cualquiera.
function MisActividades() {
  const guardada = leerVista<VistaActividades>(MODULO)
  const [ident, setIdent] = useState<Identidad | null>(null)
  const [operarios, setOperarios] = useState<OperarioOpcion[]>([])
  const [verPersonalId, setVerPersonalId] = useState<number | null>(guardada?.verPersonalId ?? null)
  const [fecha, setFecha] = useState(guardada?.fecha ?? hoyISO())
  const [actividades, setActividades] = useState<Actividad[]>([])
  const [atrasadas, setAtrasadas] = useState<Actividad[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actividadAbierta, setActividadAbierta] = useState<number | null>(guardada?.actividadAbierta ?? null)
  const [carpetaAbierta, setCarpetaAbierta] = useState(guardada?.carpetaAbierta ?? false)

  useEffect(() => {
    cargarIdentidad()
      .then((i) => {
        setIdent(i)
        // Si veníamos mirando a alguien, se respeta esa elección.
        setVerPersonalId((actual) => actual ?? i.personal?.id ?? null)
        if (i.esSupervisor) cargarOperarios().then(setOperarios).catch(() => {})
      })
      .catch(() => setIdent({ personal: null, esSupervisor: false }))
  }, [])

  const recargar = useCallback(() => {
    if (verPersonalId == null) return
    setCargando(true)
    Promise.all([
      cargarActividadesDelDia(verPersonalId, fecha),
      cargarAtrasadas(verPersonalId, hoyISO()),
    ])
      .then(([act, atr]) => {
        setActividades(act)
        setAtrasadas(atr)
        setError(null)
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'No se pudieron cargar las actividades.'))
      .finally(() => setCargando(false))
  }, [verPersonalId, fecha])

  useEffect(() => {
    recargar()
  }, [recargar])

  useEffect(() => {
    guardarVista<VistaActividades>(MODULO, {
      fecha,
      verPersonalId,
      actividadAbierta,
      carpetaAbierta,
    })
  }, [fecha, verPersonalId, actividadAbierta, carpetaAbierta])

  // Sin persona vinculada no hay agenda que mostrar.
  if (ident && !ident.personal) {
    return (
      <div className="act-vacio">
        Tu usuario todavía no está vinculado a una persona del taller. Pedile a un supervisor que te
        asigne desde RRHH → Personal.
      </div>
    )
  }

  const esOtro = ident?.personal != null && verPersonalId !== ident.personal.id

  if (actividadAbierta != null) {
    return (
      <VistaActividad
        // La key hace que al saltar a otra actividad la pantalla arranque de cero.
        key={actividadAbierta}
        procesoId={actividadAbierta}
        carpetaAbierta={carpetaAbierta}
        onCarpeta={setCarpetaAbierta}
        onIrAActividad={(id) => {
          setActividadAbierta(id)
          setCarpetaAbierta(false)
        }}
        onVolver={() => {
          setActividadAbierta(null)
          setCarpetaAbierta(false)
          recargar()
        }}
      />
    )
  }

  return (
    <div className="act-pantalla">
      <div className="act-cabecera">
        <div className="act-nav">
          <button type="button" className="act-nav-btn" onClick={() => setFecha(sumarDias(fecha, -1))}>
            ◀
          </button>
          <span className="act-fecha">{tituloFecha(fecha)}</span>
          <button type="button" className="act-nav-btn" onClick={() => setFecha(sumarDias(fecha, 1))}>
            ▶
          </button>
          {fecha !== hoyISO() && (
            <button type="button" className="empresa-boton-secundario" onClick={() => setFecha(hoyISO())}>
              Hoy
            </button>
          )}
        </div>

        {ident?.esSupervisor && operarios.length > 0 && (
          <label className="act-selector">
            Viendo a
            <select
              className="empresa-input"
              value={verPersonalId ?? ''}
              onChange={(e) => setVerPersonalId(e.target.value ? Number(e.target.value) : null)}
            >
              {operarios.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.nombre}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {esOtro && (
        <div className="act-aviso-otro">
          Estás viendo la agenda de otra persona. Los cambios que hagas quedan a su nombre.
        </div>
      )}

      {atrasadas.length > 0 && (
        <div className="act-atrasadas">
          ⚠ Tenés <b>{atrasadas.length}</b> actividad(es) de días anteriores sin terminar.
          <button
            type="button"
            className="act-link"
            onClick={() => setFecha(atrasadas[0].planFecha)}
          >
            Ir a la más vieja ({atrasadas[0].planFecha.split('-').reverse().slice(0, 2).join('/')})
          </button>
        </div>
      )}

      {error && <p className="empresa-form-error">{error}</p>}

      {cargando ? (
        <div className="act-vacio">Cargando actividades…</div>
      ) : actividades.length === 0 ? (
        <div className="act-vacio">No hay actividades planificadas para este día.</div>
      ) : (
        <div className="act-lista">
          {actividades.map((a) => (
            <button
              key={a.procesoId}
              type="button"
              className={
                'act-card' +
                (a.estado === 'hecho' ? ' act-card-hecha' : '') +
                (a.estado === 'hecho_operario' ? ' act-card-op' : '') +
                (a.enCurso ? ' act-card-curso' : '')
              }
              onClick={() => {
                setActividadAbierta(a.procesoId)
                setCarpetaAbierta(false)
              }}
            >
              <div className="act-card-hora">{a.planHora ?? '--:--'}</div>
              <div className="act-card-cuerpo">
                <div className="act-card-tit">
                  {a.proceso}
                  {a.esRetrabajo && <span className="act-badge act-badge-re">retrabajo</span>}
                  {a.enCurso && <span className="act-badge act-badge-curso">en curso</span>}
                  {a.estado === 'hecho_operario' && <span className="act-badge act-badge-op">✓ terminada</span>}
                  {a.estado === 'hecho' && <span className="act-badge act-badge-ok">✓ cerrada</span>}
                </div>
                <div className="act-card-desc">{a.descripcion}</div>
                <div className="act-card-meta">
                  <span>{a.cliente}</span>
                  {a.pedidoNro && <span>· Pedido {a.pedidoNro}</span>}
                  <span>· Cant. {a.cantidad}</span>
                  {a.maquina && <span>· {a.maquina}</span>}
                  <span>· est. {duracion(a.minutosEstimados)}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default MisActividades
