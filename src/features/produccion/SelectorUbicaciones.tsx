import { useEffect, useState } from 'react'
import { supabase } from '../../shared/lib/supabaseClient'
import {
  cargarSectores,
  crearSector,
  crearEquipo,
  type Sector,
} from '../empresas/sectoresApi'
import { cargarRutas } from './matrizApi'

type Empresa = { id: number; nombre: string }

// Una ubicación elegida, con los nombres resueltos para mostrarla como chip.
export type Ubicacion = {
  equipoId: number
  clienteId: number
  texto: string // "Cliente › Sector › Equipo"
}

// Selector de ubicaciones del catálogo: dónde se instala una pieza.
// Se eligen Cliente → Sector → Equipo y se agregan a una lista (puede haber
// varias). Desde acá se pueden crear sectores y equipos nuevos.
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

  // Si llegan ubicaciones sin nombre resuelto (al editar una pieza), las
  // completamos con su ruta legible "Cliente › Sector › Equipo".
  useEffect(() => {
    const sinResolver = valor.filter((u) => u.clienteId === 0)
    if (!sinResolver.length) return
    cargarRutas(sinResolver.map((u) => u.equipoId)).then((rutas) => {
      if (!rutas.length) return
      onCambiar(
        valor.map((u) => {
          const r = rutas.find((x) => x.equipoId === u.equipoId)
          return r ? { equipoId: r.equipoId, clienteId: r.clienteId, texto: r.texto } : u
        }),
      )
    })
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

  async function recargarSectores() {
    if (clienteId === '') return
    setSectores(await cargarSectores(clienteId))
  }

  async function nuevoSector() {
    if (clienteId === '') return
    const nombre = window.prompt('Nombre del nuevo sector:')
    if (!nombre?.trim()) return
    try {
      await crearSector(clienteId, nombre.trim())
      await recargarSectores()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo crear el sector.')
    }
  }

  async function nuevoEquipo() {
    if (sectorId === '') return
    const nombre = window.prompt('Nombre del nuevo equipo:')
    if (!nombre?.trim()) return
    try {
      await crearEquipo(sectorId, nombre.trim())
      await recargarSectores()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo crear el equipo.')
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

  return (
    <div className="ubic-bloque">
      <div className="ubic-titulo">Ubicaciones *</div>
      <p className="ubic-ayuda">
        Dónde se instala esta pieza. Podés cargar más de una. Los elementos que cuelguen de este heredan su
        ubicación.
      </p>

      <div className="ubic-selects">
        <label className="ubic-campo">
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

        <label className="ubic-campo">
          Sector
          <div className="ubic-fila">
            <select
              className="empresa-input"
              value={sectorId}
              disabled={clienteId === ''}
              onChange={(e) => {
                setSectorId(e.target.value === '' ? '' : Number(e.target.value))
                setEquipoId('')
              }}
            >
              <option value="">— elegir —</option>
              {sectores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="empresa-boton-secundario ubic-mas"
              disabled={clienteId === ''}
              onClick={nuevoSector}
              title="Nuevo sector"
            >
              +
            </button>
          </div>
        </label>

        <label className="ubic-campo">
          Equipo
          <div className="ubic-fila">
            <select
              className="empresa-input"
              value={equipoId}
              disabled={sectorId === ''}
              onChange={(e) => setEquipoId(e.target.value === '' ? '' : Number(e.target.value))}
            >
              <option value="">— elegir —</option>
              {equipos.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nombre}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="empresa-boton-secundario ubic-mas"
              disabled={sectorId === ''}
              onClick={nuevoEquipo}
              title="Nuevo equipo"
            >
              +
            </button>
          </div>
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
    </div>
  )
}

export default SelectorUbicaciones
