import { supabase } from '../../shared/lib/supabaseClient'
import SelectorLocalidad from '../../shared/components/SelectorLocalidad'

export type Direccion = {
  id: number
  tipo: string | null
  calle: string | null
  numero: string | null
  piso: string | null
  depto: string | null
  observaciones: string | null
  localidad_id: string | null
  localidades: {
    nombre: string
    codigo_postal: string | null
    provincias: { nombre: string } | null
  } | null
}

export type DireccionForm = {
  tipo: string
  calle: string
  numero: string
  piso: string
  depto: string
  observaciones: string
  localidadId: string | null
  localidadEtiqueta: string
  cp: string // CP de la localidad
  cpFaltante: boolean // true si la localidad no tenía CP cargado
}

export const FORM_VACIO_DIRECCION: DireccionForm = {
  tipo: '',
  calle: '',
  numero: '',
  piso: '',
  depto: '',
  observaciones: '',
  localidadId: null,
  localidadEtiqueta: '',
  cp: '',
  cpFaltante: false,
}

export function direccionAForm(d: Direccion): DireccionForm {
  const cp = d.localidades?.codigo_postal ?? ''
  const etiqueta = d.localidades
    ? `${d.localidades.nombre}, ${d.localidades.provincias?.nombre ?? ''}`
    : ''
  return {
    tipo: d.tipo ?? '',
    calle: d.calle ?? '',
    numero: d.numero ?? '',
    piso: d.piso ?? '',
    depto: d.depto ?? '',
    observaciones: d.observaciones ?? '',
    localidadId: d.localidad_id,
    localidadEtiqueta: etiqueta,
    cp,
    cpFaltante: !!d.localidad_id && cp === '',
  }
}

// Lo que se guarda en la dirección (el CP NO va acá: vive en la localidad).
export function formAGuardarDireccion(f: DireccionForm) {
  return {
    tipo: f.tipo || null,
    calle: f.calle.trim() || null,
    numero: f.numero.trim() || null,
    piso: f.piso.trim() || null,
    depto: f.depto.trim() || null,
    observaciones: f.observaciones.trim() || null,
    localidad_id: f.localidadId,
  }
}

// Texto corto de la ubicación (localidad, provincia).
export function ubicacionTexto(d: Direccion): string {
  if (!d.localidades) return '—'
  const prov = d.localidades.provincias?.nombre ?? ''
  return `${d.localidades.nombre}${prov ? ', ' + prov : ''}`
}

// Etiqueta legible de una dirección (para selectores y columnas).
// Ej: "Fiscal — Av. San Martín 123, General Pico"
export function etiquetaDireccion(d: Direccion): string {
  const calle = [d.calle, d.numero].filter(Boolean).join(' ')
  const loc = d.localidades?.nombre ?? ''
  const tipo = d.tipo ? `${d.tipo} — ` : ''
  const resto = [calle, loc].filter(Boolean).join(', ')
  return tipo + resto || `Dirección #${d.id}`
}

// Si la localidad no tenía CP y se cargó uno, lo guardamos EN la localidad.
export async function guardarCpLocalidadSiHace(f: DireccionForm) {
  if (f.cpFaltante && f.localidadId && f.cp.trim() !== '') {
    await supabase
      .from('localidades')
      .update({ codigo_postal: f.cp.trim() })
      .eq('id', f.localidadId)
  }
}

// Campos del formulario de dirección (se usan en crear y editar).
export function CamposDireccion({
  valor,
  setValor,
}: {
  valor: DireccionForm
  setValor: (v: DireccionForm) => void
}) {
  return (
    <>
      <label className="empresa-campo">
        Tipo
        <select
          className="empresa-input"
          value={valor.tipo}
          onChange={(e) => setValor({ ...valor, tipo: e.target.value })}
        >
          <option value="">—</option>
          <option value="Fiscal">Fiscal</option>
          <option value="Laboral">Laboral</option>
        </select>
      </label>

      <div className="empresa-campo-fila">
        <label className="empresa-campo">
          Calle
          <input
            className="empresa-input"
            value={valor.calle}
            onChange={(e) => setValor({ ...valor, calle: e.target.value })}
          />
        </label>
        <label className="empresa-campo empresa-campo-chico">
          Número
          <input
            className="empresa-input"
            value={valor.numero}
            onChange={(e) => setValor({ ...valor, numero: e.target.value })}
          />
        </label>
      </div>

      <div className="empresa-campo-fila">
        <label className="empresa-campo empresa-campo-chico">
          Piso
          <input
            className="empresa-input"
            value={valor.piso}
            onChange={(e) => setValor({ ...valor, piso: e.target.value })}
          />
        </label>
        <label className="empresa-campo empresa-campo-chico">
          Depto
          <input
            className="empresa-input"
            value={valor.depto}
            onChange={(e) => setValor({ ...valor, depto: e.target.value })}
          />
        </label>
      </div>

      <div className="empresa-campo">
        <SelectorLocalidad
          localidadId={valor.localidadId}
          onCambiar={(id, etiqueta, cp) =>
            setValor({
              ...valor,
              localidadId: id,
              localidadEtiqueta: etiqueta,
              cp: cp ?? '',
              cpFaltante: !cp,
            })
          }
        />
        {valor.localidadId && (
          <span className="localidad-elegida">
            Seleccionada: {valor.localidadEtiqueta}
          </span>
        )}
      </div>

      {/* Código postal: viene de la localidad. Si falta, se carga una vez. */}
      {valor.localidadId && (
        <label className="empresa-campo">
          Código postal
          {valor.cpFaltante ? (
            <>
              <input
                className="empresa-input"
                value={valor.cp}
                placeholder="Cargá el CP de esta localidad"
                onChange={(e) => setValor({ ...valor, cp: e.target.value })}
              />
              <span className="cp-hint">
                Esta localidad no tiene CP cargado. Lo que pongas queda guardado
                en la localidad para siempre.
              </span>
            </>
          ) : (
            <input className="empresa-input cp-auto" value={valor.cp} readOnly />
          )}
        </label>
      )}

      <label className="empresa-campo">
        Observaciones
        <textarea
          className="empresa-input"
          rows={2}
          value={valor.observaciones}
          onChange={(e) =>
            setValor({ ...valor, observaciones: e.target.value })
          }
        />
      </label>
    </>
  )
}
