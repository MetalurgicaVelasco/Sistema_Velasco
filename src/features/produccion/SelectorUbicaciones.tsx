import { useEffect, useState } from 'react'
import { supabase } from '../../shared/lib/supabaseClient'
import SelectorConAlta from '../../shared/components/SelectorConAlta'
import { cargarSectores, crearSector, crearEquipo, type Sector } from '../empresas/sectoresApi'
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
// varias). Los sectores y equipos se pueden crear al vuelo desde el propio
// desplegable (opción "+ Nuevo…").
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

  // Alta de sector desde el desplegable: crea, recarga la lista y devuelve el
  // registro para que SelectorConAlta lo deje seleccionado.
  async function altaSector(nombre: string): Promise<{ id: number; nombre: string } | null> {
    if (clienteId === '') return null
    setError(null)
    try {
      const creado = await crearSector(clienteId, nombre)
      await recargarSectores()
      setEquipoId('')
      return creado
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo crear el sector.')
      return null
    }
  }

  // Alta de equipo desde el desplegable (mismo patrón).
  async function altaEquipo(nombre: string): Promise<{ id: number; nombre: string } | null> {
    if (sectorId === '') return null
    setError(null)
    try {
      const creado = await crearEquipo(sectorId, nombre)
      await recargarSectores()
      return creado
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo crear el equipo.')
      return null
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
          <SelectorConAlta
            valor={sectorId === '' ? null : sectorId}
            opciones={sectores}
            onCambiar={(id) => {
              setSectorId(id ?? '')
              setEquipoId('')
            }}
            onAgregar={altaSector}
            placeholderNuevo="Nuevo sector"
            placeholderVacio="— elegir —"
            disabled={clienteId === ''}
          />
        </label>

        <label className="ubic-campo">
          Equipo
          <SelectorConAlta
            valor={equipoId === '' ? null : equipoId}
            opciones={equipos}
            onCambiar={(id) => setEquipoId(id ?? '')}
            onAgregar={altaEquipo}
            placeholderNuevo="Nuevo equipo"
            placeholderVacio="— elegir —"
            disabled={sectorId === ''}
          />
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
