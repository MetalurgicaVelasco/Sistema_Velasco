import { contiene } from '../../shared/lib/texto'
import { useEffect, useState } from 'react'
import ModalMaquina from './ModalMaquina'
import ComboMultiBuscable from '../../shared/components/ComboMultiBuscable'
import { supabase } from '../../shared/lib/supabaseClient'
import { cargarRecursos } from '../../shared/lib/recursosApi'
import type {
  Maquina,
  TipoProceso,
  Personal,
} from '../../shared/types/recursos'

const BUCKET = 'proyectos-fotos'

type OrdenPor = 'nombre' | 'cant'
type OrdenDir = 'asc' | 'desc'

// Módulo Activos > Máquinas: máquinas del taller y los procesos que hace cada
// una. Sirve para filtrar las opciones de máquina al cargar un proceso.
function Maquinas() {
  const [maquinas, setMaquinas] = useState<Maquina[]>([])
  const [tiposProceso, setTiposProceso] = useState<TipoProceso[]>([])
  const [personal, setPersonal] = useState<Personal[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [modal, setModal] = useState<{ maq: Maquina | null } | null>(null)

  // Filtros / orden
  const [busqueda, setBusqueda] = useState('')
  const [ordenPor, setOrdenPor] = useState<OrdenPor>('nombre')
  const [ordenDir, setOrdenDir] = useState<OrdenDir>('asc')
  const [procesosFiltro, setProcesosFiltro] = useState<number[]>([])

  async function cargar() {
    setCargando(true)
    try {
      const data = await cargarRecursos()
      setMaquinas(data.maquinas)
      setTiposProceso(data.tiposProceso)
      setPersonal(data.personal)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar las máquinas.')
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    cargar()
  }, [])

  function nombreTipo(id: number): string {
    return tiposProceso.find((t) => t.id === id)?.nombre ?? '(?)'
  }

  function fotoUrlPublica(path: string): string {
    return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
  }

  function onGuardado() {
    setModal(null)
    cargar()
  }

  // Filtrado + orden (derivado, sin estado extra).
  const q = busqueda.trim()
  const filtradas = maquinas
    .filter((m) => {
      if (q && !contiene(m.nombre, busqueda)) return false
      if (
        procesosFiltro.length &&
        !procesosFiltro.every((id) => m.tipoProcesoIds.includes(id))
      ) {
        return false
      }
      return true
    })
    .sort((a, b) => {
      const cmp =
        ordenPor === 'nombre'
          ? a.nombre.localeCompare(b.nombre)
          : a.tipoProcesoIds.length - b.tipoProcesoIds.length
      return ordenDir === 'asc' ? cmp : -cmp
    })

  const opcionesProcesos = tiposProceso
    .slice()
    .sort((a, b) => a.nombre.localeCompare(b.nombre))
    .map((t) => ({ id: t.id, label: t.nombre }))

  return (
    <div className="rec-vista">
      <div className="rec-cont">
        <div className="maq-head">
          <p className="rec-ayuda maq-head-texto">
            Para cada máquina marcá los procesos que puede realizar. Esto se usa
            para filtrar las opciones de máquina al cargar un proceso en un
            proyecto.
          </p>
          <button
            type="button"
            className="empresa-boton"
            onClick={() => setModal({ maq: null })}
          >
            + Nueva máquina
          </button>
        </div>

        {/* Barra de filtros y orden */}
        <div className="maq-filtros">
          <div className="maq-filtros-fila">
            <span className="maq-filtro-label">Buscar:</span>
            <input
              className="empresa-input maq-buscar"
              placeholder="Nombre de máquina"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
            <div className="maq-orden">
              <span className="maq-filtro-label">Ordenar por:</span>
              <select
                className="empresa-input maq-orden-select"
                value={ordenPor}
                onChange={(e) => setOrdenPor(e.target.value as OrdenPor)}
              >
                <option value="nombre">Nombre</option>
                <option value="cant">Cantidad de procesos</option>
              </select>
              <button
                type="button"
                className="empresa-boton-secundario maq-orden-dir"
                title={ordenDir === 'asc' ? 'Ascendente' : 'Descendente'}
                onClick={() =>
                  setOrdenDir((d) => (d === 'asc' ? 'desc' : 'asc'))
                }
              >
                {ordenDir === 'asc' ? '↑' : '↓'}
              </button>
            </div>
          </div>
          <div className="maq-filtros-fila">
            <span className="maq-filtro-label">Procesos:</span>
            <div className="maq-filtro-combo">
              <ComboMultiBuscable
                opciones={opcionesProcesos}
                seleccionados={procesosFiltro}
                onAgregar={(id) => setProcesosFiltro((p) => [...p, id])}
                onQuitar={(id) =>
                  setProcesosFiltro((p) => p.filter((x) => x !== id))
                }
                placeholder="Escribir para buscar procesos…"
              />
            </div>
          </div>
        </div>

        {cargando ? (
          <div className="rec-vacio">Cargando…</div>
        ) : error ? (
          <div className="empresa-form-error">{error}</div>
        ) : maquinas.length === 0 ? (
          <div className="rec-vacio">
            No hay máquinas cargadas. Apretá "+ Nueva máquina" para empezar.
          </div>
        ) : filtradas.length === 0 ? (
          <div className="rec-vacio">
            No hay máquinas que coincidan con los filtros.
          </div>
        ) : (
          <div className="maq-lista">
            {filtradas.map((m) => (
              <div key={m.id} className="maq-card">
                {m.fotoUrl ? (
                  <img
                    className="maq-card-foto"
                    src={fotoUrlPublica(m.fotoUrl)}
                    alt=""
                  />
                ) : (
                  <div className="maq-card-foto maq-card-foto-vacia">⚙</div>
                )}
                <div className="maq-card-body">
                  <div className="maq-card-nombre">{m.nombre}</div>
                  <div className="maq-card-procs">
                    {m.tipoProcesoIds.length === 0 ? (
                      <span className="maq-sin-procs">
                        Sin procesos asignados (aparece como opción en todos)
                      </span>
                    ) : (
                      m.tipoProcesoIds.map((id) => (
                        <span key={id} className="maq-chip">
                          {nombreTipo(id)}
                        </span>
                      ))
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  className="empresa-boton-secundario rec-boton-chico"
                  onClick={() => setModal({ maq: m })}
                >
                  Editar
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {modal && (
        <ModalMaquina
          maquina={modal.maq}
          tiposProceso={tiposProceso}
          personal={personal}
          onGuardado={onGuardado}
          onCancelar={() => setModal(null)}
        />
      )}
    </div>
  )
}

export default Maquinas
