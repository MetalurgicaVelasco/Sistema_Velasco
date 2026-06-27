import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { contiene } from '../lib/texto'

type Pais = { id: string; nombre: string }
type Provincia = { id: string; nombre: string }
type Localidad = { id: string; nombre: string; codigo_postal: string | null }

// Componente controlado. Avisa la localidad elegida y su CP (puede ser null).
function SelectorLocalidad({
  localidadId,
  onCambiar,
}: {
  localidadId: string | null
  onCambiar: (id: string, etiqueta: string, cp: string | null) => void
}) {
  const [paises, setPaises] = useState<Pais[]>([])
  const [paisId, setPaisId] = useState('')
  const [provincias, setProvincias] = useState<Provincia[]>([])
  const [provinciaId, setProvinciaId] = useState<string | null>(null)
  const [localidades, setLocalidades] = useState<Localidad[]>([])
  const [filtroProv, setFiltroProv] = useState('')
  const [filtroLoc, setFiltroLoc] = useState('')

  // Países (hoy solo Argentina); elige el primero por defecto.
  useEffect(() => {
    supabase
      .from('paises')
      .select('id, nombre')
      .order('nombre')
      .then(({ data }) => {
        setPaises(data ?? [])
        if (data && data.length > 0) setPaisId((prev) => prev || data[0].id)
      })
  }, [])

  // Provincias del país elegido.
  useEffect(() => {
    if (!paisId) {
      setProvincias([])
      return
    }
    supabase
      .from('provincias')
      .select('id, nombre')
      .eq('pais_id', paisId)
      .order('nombre')
      .then(({ data }) => setProvincias(data ?? []))
  }, [paisId])

  // Modo edición: resolver la provincia de la localidad inicial.
  useEffect(() => {
    if (!localidadId) return
    supabase
      .from('localidades')
      .select('provincia_id')
      .eq('id', localidadId)
      .single()
      .then(({ data }) => {
        if (data) setProvinciaId(data.provincia_id)
      })
  }, [localidadId])

  // Localidades de la provincia elegida (con su CP).
  useEffect(() => {
    if (!provinciaId) {
      setLocalidades([])
      return
    }
    supabase
      .from('localidades')
      .select('id, nombre, codigo_postal')
      .eq('provincia_id', provinciaId)
      .order('nombre')
      .then(({ data }) => setLocalidades(data ?? []))
  }, [provinciaId])

  const provinciasFiltradas = provincias.filter((p) =>
    contiene(p.nombre, filtroProv),
  )
  const localidadesFiltradas = localidades.filter((l) =>
    contiene(l.nombre, filtroLoc),
  )
  const provinciaSel = provincias.find((p) => p.id === provinciaId)

  function elegirLocalidad(l: Localidad) {
    const etiqueta = provinciaSel
      ? `${l.nombre}, ${provinciaSel.nombre}`
      : l.nombre
    onCambiar(l.id, etiqueta, l.codigo_postal)
  }

  return (
    <div className="selector-geo-wrap">
      <label className="empresa-campo">
        País
        <select
          className="empresa-input"
          value={paisId}
          onChange={(e) => {
            setPaisId(e.target.value)
            setProvinciaId(null)
          }}
        >
          {paises.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
            </option>
          ))}
        </select>
      </label>

      <div className="selector-geo">
        {/* Columna provincias */}
        <div className="selector-col">
          <span className="selector-titulo">Provincia</span>
          <input
            className="empresa-input"
            placeholder="Buscar…"
            value={filtroProv}
            onChange={(e) => setFiltroProv(e.target.value)}
          />
          <div className="selector-lista">
            {provinciasFiltradas.map((p) => (
              <button
                type="button"
                key={p.id}
                className={
                  'selector-item' + (p.id === provinciaId ? ' activa' : '')
                }
                onClick={() => {
                  setProvinciaId(p.id)
                  setFiltroLoc('')
                }}
              >
                {p.nombre}
              </button>
            ))}
          </div>
        </div>

        {/* Columna localidades */}
        <div className="selector-col">
          <span className="selector-titulo">Localidad</span>
          <input
            className="empresa-input"
            placeholder={provinciaId ? 'Buscar…' : 'Elegí provincia'}
            value={filtroLoc}
            onChange={(e) => setFiltroLoc(e.target.value)}
            disabled={!provinciaId}
          />
          <div className="selector-lista">
            {localidadesFiltradas.map((l) => (
              <button
                type="button"
                key={l.id}
                className={
                  'selector-item' + (l.id === localidadId ? ' activa' : '')
                }
                onClick={() => elegirLocalidad(l)}
              >
                {l.nombre}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default SelectorLocalidad
