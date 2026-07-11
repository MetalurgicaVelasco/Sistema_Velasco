import { useEffect, useState } from 'react'
import { supabase } from '../../shared/lib/supabaseClient'
import Modal from '../../shared/components/Modal'
import { cargarSectores, crearSector, crearEquipo, type Sector } from '../empresas/sectoresApi'
import { cargarRutas } from './matrizApi'

type Empresa = { id: number; nombre: string }

// Valor centinela de la opción "+ Nuevo…" de los desplegables de Sector/Equipo.
const NUEVO = '__nuevo__'

// Una ubicación elegida, con los nombres resueltos para mostrarla como chip.
export type Ubicacion = {
  equipoId: number
  clienteId: number
  texto: string // "Cliente › Sector › Equipo"
}

// Selector de ubicaciones del catálogo: dónde se instala una pieza.
// Se eligen Cliente → Sector → Equipo y se agregan a una lista (puede haber
// varias). Sector y Equipo se pueden crear al vuelo: la opción "+ Nuevo…" del
// desplegable abre un modal chico con el nombre.
//
// El CLIENTE no se elige aparte: se deriva de las ubicaciones cargadas.
function SelectorUbicaciones({
  valor,
  onCambiar,
}: {
  valor: Ubicacion[]
  onCambiar: (u: Ubicacion[]) => void
}) {
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [sectores, setSectores] = useState<Sector[]>([])
  const [clienteId, setClienteId] = useState<number | ''>('')
  const [sectorId, setSectorId] = useState<number | ''>('')
  const [equipoId, setEquipoId] = useState<number | ''>('')
  const [error, setError] = useState<string | null>(null)

  // Modal de alta rápida de sector/equipo (null = cerrado).
  const [alta, setAlta] = useState<'sector' | 'equipo' | null>(null)
  const [altaNombre, setAltaNombre] = useState('')
  const [altaError, setAltaError] = useState<string | null>(null)
  const [altaGuardando, setAltaGuardando] = useState(false)

  // Red de seguridad: si llegan ubicaciones sin nombre resuelto (clienteId 0),
  // se completan con su ruta legible. Normalmente el modal ya las manda resueltas.
  useEffect(() => {
    const sinResolver = valor.filter((u) => u.clienteId === 0)
    if (!sinResolver.length) return
    let vivo = true
    cargarRutas(sinResolver.map((u) => u.equipoId))
      .then((rutas) => {
        if (!vivo || !rutas.length) return
        onCambiar(
          valor.map((u) => {
            const r = rutas.find((x) => x.equipoId === u.equipoId)
            return r ? { equipoId: r.equipoId, clienteId: r.clienteId, texto: r.texto } : u
          }),
        )
      })
      .catch(() => {}) // si falla, no rompe el modal; quedan con el texto que tengan
    return () => {
      vivo = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valor])

  // Clientes (solo empresas marcadas como cliente).
  useEffect(() => {
    supabase
      .from('empresas')
      .select('id, nombre')
      .eq('es_cliente', true)
      .eq('activo', true)
      .order('nombre')
      .then(({ data }) => setEmpresas((data as Empresa[] | null) ?? []))
  }, [])

  // Sectores del cliente elegido.
  useEffect(() => {
    if (clienteId === '') {
      setSectores([])
      return
    }
    cargarSectores(clienteId).then(setSectores)
  }, [clienteId])

  const equipos = sectorId === '' ? [] : (sectores.find((s) => s.id === sectorId)?.equipos ?? [])

  async function recargarSectores(): Promise<void> {
    if (clienteId === '') return
    setSectores(await cargarSectores(clienteId))
  }

  function abrirAlta(tipo: 'sector' | 'equipo') {
    setAltaNombre('')
    setAltaError(null)
    setAlta(tipo)
  }

  // Crea el sector o equipo desde el modal chico, lo recarga y lo deja elegido.
  async function crearAlta() {
    const nombre = altaNombre.trim()
    if (!nombre) {
      setAltaError('El nombre es obligatorio.')
      return
    }
    setAltaGuardando(true)
    try {
      if (alta === 'sector') {
        if (clienteId === '') return
        const creado = await crearSector(clienteId, nombre)
        await recargarSectores()
        setSectorId(creado.id)
        setEquipoId('')
      } else if (alta === 'equipo') {
        if (sectorId === '') return
        const creado = await crearEquipo(sectorId, nombre)
        await recargarSectores()
        setEquipoId(creado.id)
      }
      setAlta(null)
      setAltaNombre('')
    } catch (e) {
      setAltaError(e instanceof Error ? e.message : 'No se pudo crear.')
    } finally {
      setAltaGuardando(false)
    }
  }

  function agregar() {
    setError(null)
    if (clienteId === '' || sectorId === '' || equipoId === '') {
      setError('Elegí cliente, sector y equipo.')
      return
    }
    if (valor.some((u) => u.equipoId === equipoId)) {
      setError('Esa ubicación ya está agregada.')
      return
    }
    const cli = empresas.find((e) => e.id === clienteId)
    const sec = sectores.find((s) => s.id === sectorId)
    const eq = equipos.find((e) => e.id === equipoId)
    if (!cli || !sec || !eq) return
    onCambiar([
      ...valor,
      { equipoId, clienteId, texto: `${cli.nombre} › ${sec.nombre} › ${eq.nombre}` },
    ])
    setEquipoId('')
  }

  function quitar(equipoId: number) {
    onCambiar(valor.filter((u) => u.equipoId !== equipoId))
  }

  // El cliente es derivado: sale de las ubicaciones cargadas.
  const clientesDerivados = [...new Set(valor.map((u) => u.clienteId))]
    .map((id) => empresas.find((e) => e.id === id)?.nombre ?? '?')
    .join(', ')

  const sectorNombre = sectorId === '' ? '' : (sectores.find((s) => s.id === sectorId)?.nombre ?? '')

  return (
    <div className="ubic-bloque">
      <div className="ubic-titulo">Ubicaciones *</div>
      <p className="ubic-ayuda">
        Dónde se instala esta pieza. Podés cargar más de una. Los elementos que cuelguen de este heredan su
        ubicación.
      </p>

      {/* Cliente: en su propia fila, a lo ancho. */}
      <label className="ubic-campo ubic-campo-cliente">
        Cliente
        <select
          className="empresa-input"
          value={clienteId}
          onChange={(e) => {
            setClienteId(e.target.value === '' ? '' : Number(e.target.value))
            setSectorId('')
            setEquipoId('')
          }}
        >
          <option value="">— elegir —</option>
          {empresas.map((e) => (
            <option key={e.id} value={e.id}>
              {e.nombre}
            </option>
          ))}
        </select>
      </label>

      {/* Sector · Equipo · Agregar: todo en una misma fila. */}
      <div className="ubic-fila-agregar">
        <label className="ubic-campo">
          Sector
          <select
            className="empresa-input"
            value={sectorId}
            disabled={clienteId === ''}
            onChange={(e) => {
              const v = e.target.value
              if (v === NUEVO) {
                abrirAlta('sector')
                return
              }
              setSectorId(v === '' ? '' : Number(v))
              setEquipoId('')
            }}
          >
            <option value="">— elegir —</option>
            {sectores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre}
              </option>
            ))}
            <option value={NUEVO}>+ Nuevo sector…</option>
          </select>
        </label>

        <label className="ubic-campo">
          Equipo
          <select
            className="empresa-input"
            value={equipoId}
            disabled={sectorId === ''}
            onChange={(e) => {
              const v = e.target.value
              if (v === NUEVO) {
                abrirAlta('equipo')
                return
              }
              setEquipoId(v === '' ? '' : Number(v))
            }}
          >
            <option value="">— elegir —</option>
            {equipos.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nombre}
              </option>
            ))}
            <option value={NUEVO}>+ Nuevo equipo…</option>
          </select>
        </label>

        <button type="button" className="empresa-boton ubic-agregar" onClick={agregar}>
          + Agregar ubicación
        </button>
      </div>

      {error && <p className="empresa-form-error">{error}</p>}

      {valor.length > 0 ? (
        <div className="ubic-chips">
          {valor.map((u) => (
            <span key={u.equipoId} className="ubic-chip">
              📍 {u.texto}
              <button type="button" className="ubic-chip-x" onClick={() => quitar(u.equipoId)} aria-label="Quitar">
                ×
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className="ubic-vacio">Todavía no agregaste ninguna ubicación.</p>
      )}

      <label className="empresa-campo ubic-cliente-derivado">
        Cliente(s)
        <input className="empresa-input" value={clientesDerivados} readOnly disabled placeholder="—" />
        <span className="pf-ayuda">Se determina por las ubicaciones. No se edita a mano.</span>
      </label>

      {/* Alta rápida de sector/equipo: modal chico aparte, sin ensuciar la fila. */}
      {alta && (
        <Modal
          titulo={alta === 'sector' ? 'Nuevo sector' : `Nuevo equipo${sectorNombre ? ` en "${sectorNombre}"` : ''}`}
          onCerrar={() => setAlta(null)}
          ancho={380}
        >
          <label className="empresa-campo">
            Nombre *
            <input
              className="empresa-input"
              value={altaNombre}
              autoFocus
              onChange={(e) => setAltaNombre(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  crearAlta()
                }
              }}
            />
          </label>
          {altaError && <p className="empresa-form-error">{altaError}</p>}
          <div className="pf-acciones">
            <button type="button" className="empresa-boton-secundario" onClick={() => setAlta(null)}>
              Cancelar
            </button>
            <button type="button" className="empresa-boton" onClick={crearAlta} disabled={altaGuardando}>
              {altaGuardando ? 'Creando…' : 'Crear'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}

export default SelectorUbicaciones
