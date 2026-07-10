import { useEffect, useState } from 'react'
import { supabase } from '../../shared/lib/supabaseClient'
import Modal from '../../shared/components/Modal'
import CajaFoto from './CajaFoto'
import SelectorConAlta from '../../shared/components/SelectorConAlta'
import SelectorUbicaciones, { type Ubicacion } from './SelectorUbicaciones'
import { crearMaterial, type Material } from './elementoTipos'
import { tipoLabel } from './elementosApi'
import { tiposHijoPermitidos } from './elementoTipos'
import {
  crearElementoMatriz,
  actualizarElementoMatriz,
  guardarUbicaciones,
  cargarUbicaciones,
  cargarRutas,
  agregarHijo,
  type ElementoMatriz,
} from './matrizApi'

const BUCKET = 'proyectos-fotos'

export type ContextoNuevo = {
  /** Si se crea dentro de un conjunto: su id y tipo (para restringir tipos). */
  padre: { id: number; tipo: string } | null
  /** Cantidad con la que entra en el padre (solo si hay padre). */
}

// Modal de alta/edición de una pieza del CATÁLOGO. A diferencia del de Proyectos,
// no tiene estado, ni fecha de fin, ni "es retrabajo", ni cantidad: la pieza es
// reutilizable y la cantidad vive en la relación con cada conjunto que la usa.
//
// Si el elemento es RAÍZ (no entra en ningún conjunto), la ubicación es obligatoria.
function ModalElementoMatriz({
  elemento,
  padre,
  onGuardado,
  onCancelar,
}: {
  elemento: ElementoMatriz | null // null = alta
  padre: { id: number; tipo: string } | null // dentro de qué conjunto se crea
  onGuardado: () => void
  onCancelar: () => void
}) {
  const esEditar = elemento != null
  const esRaiz = padre == null

  const tiposOk = tiposHijoPermitidos(padre?.tipo ?? null)
  const [tipo, setTipo] = useState(elemento?.tipo ?? tiposOk[tiposOk.length - 1] ?? 'componente')
  const [descripcion, setDescripcion] = useState(elemento?.descripcion ?? '')
  const [codigoCliente, setCodigoCliente] = useState(elemento?.codigo_cliente ?? '')
  const [materialId, setMaterialId] = useState<number | null>(elemento?.material_id ?? null)
  const [presentacion, setPresentacion] = useState(elemento?.presentacion_mat_prima ?? '')
  const [esDispositivo, setEsDispositivo] = useState(elemento?.es_dispositivo ?? false)
  const [cantidad, setCantidad] = useState('1') // solo si hay padre

  const [fotoUrl, setFotoUrl] = useState<string | null>(elemento?.foto_url ?? null)
  const [fotoArchivo, setFotoArchivo] = useState<File | null>(null)
  const [fotoPreview, setFotoPreview] = useState<string | null>(null)

  const [ubicaciones, setUbicaciones] = useState<Ubicacion[]>([])
  const [materiales, setMateriales] = useState<Material[]>([])
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    supabase
      .from('materiales')
      .select('id, nombre')
      .order('nombre')
      .then(({ data }) => setMateriales((data as Material[] | null) ?? []))
  }, [])

  // Al editar una pieza, precargar sus ubicaciones propias YA RESUELTAS
  // (Cliente › Sector › Equipo), para que los chips no muestren un placeholder.
  useEffect(() => {
    if (!elemento) return
    cargarUbicaciones(elemento.id).then(async (equipoIds) => {
      if (!equipoIds.length) {
        setUbicaciones([])
        return
      }
      const rutas = await cargarRutas(equipoIds)
      setUbicaciones(
        equipoIds.map((equipoId) => {
          const r = rutas.find((x) => x.equipoId === equipoId)
          return r
            ? { equipoId: r.equipoId, clienteId: r.clienteId, texto: r.texto }
            : { equipoId, clienteId: 0, texto: `Equipo #${equipoId}` }
        }),
      )
    })
  }, [elemento])

  const previewUrl =
    fotoPreview ?? (fotoUrl ? supabase.storage.from(BUCKET).getPublicUrl(fotoUrl).data.publicUrl : null)

  function elegirFoto(f: File) {
    if (fotoPreview) URL.revokeObjectURL(fotoPreview)
    setFotoArchivo(f)
    setFotoPreview(URL.createObjectURL(f))
  }
  function quitarFoto() {
    if (fotoPreview) URL.revokeObjectURL(fotoPreview)
    setFotoArchivo(null)
    setFotoPreview(null)
    setFotoUrl(null)
  }

  async function subirFoto(id: number): Promise<string | null> {
    if (!fotoArchivo) return null
    const ext = fotoArchivo.name.split('.').pop() || 'png'
    const ruta = `matriz/${id}/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from(BUCKET).upload(ruta, fotoArchivo, { upsert: true })
    return error ? null : ruta
  }

  async function onAgregarMaterial(nombre: string): Promise<Material | null> {
    const m = await crearMaterial(nombre)
    if (m) setMateriales((prev) => [...prev, m].sort((a, b) => a.nombre.localeCompare(b.nombre)))
    return m
  }

  async function guardar() {
    setError(null)
    if (descripcion.trim() === '') {
      setError('La descripción es obligatoria.')
      return
    }
    // Un elemento raíz tiene que estar ubicado en algún lado, si no no aparece.
    if (esRaiz && ubicaciones.length === 0) {
      setError('Un elemento que no está dentro de un conjunto necesita al menos una ubicación.')
      return
    }
    const cant = Number(cantidad)
    if (!esRaiz && (!Number.isFinite(cant) || cant <= 0)) {
      setError('La cantidad debe ser mayor a cero.')
      return
    }

    setGuardando(true)
    try {
      const input = {
        tipo,
        descripcion,
        materialId,
        presentacionMatPrima: presentacion,
        codigoCliente,
        esDispositivo,
        fotoUrl,
      }
      let id = elemento?.id ?? null
      if (id == null) {
        id = await crearElementoMatriz(input)
      } else {
        await actualizarElementoMatriz(id, input)
      }
      // Foto (necesita el id).
      if (fotoArchivo) {
        const ruta = await subirFoto(id)
        if (ruta) await supabase.from('elementos_matriz').update({ foto_url: ruta }).eq('id', id)
      }
      // Ubicaciones propias (las raíces las exigen; los hijos pueden no tenerlas).
      await guardarUbicaciones(id, ubicaciones.map((u) => u.equipoId))
      // Si se crea dentro de un conjunto, se agrega a su composición con la cantidad.
      if (padre && !esEditar) await agregarHijo(padre.id, id, cant)

      onGuardado()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Modal
      titulo={esEditar ? `Editar ${tipoLabel(tipo)}` : `Nuevo ${tipoLabel(tipo)}`}
      onCerrar={onCancelar}
      ancho={620}
    >
      {/* Ubicaciones: primero de todo. Obligatorias si es raíz. */}
      <SelectorUbicaciones valor={ubicaciones} onCambiar={setUbicaciones} />

      <div className="empresa-campo-fila">
        <label className="empresa-campo">
          Tipo
          <select className="empresa-input" value={tipo} onChange={(e) => setTipo(e.target.value)}>
            {(tiposOk.includes(tipo) ? tiposOk : [tipo, ...tiposOk]).map((t) => (
              <option key={t} value={t}>
                {tipoLabel(t)}
              </option>
            ))}
          </select>
        </label>
        {padre && !esEditar ? (
          <label className="empresa-campo">
            Cantidad en el conjunto *
            <input
              type="number"
              className="empresa-input"
              min="0"
              step="1"
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
            />
          </label>
        ) : null}
      </div>

      <label className="empresa-campo">
        Descripción *
        <textarea
          className="empresa-input"
          rows={2}
          placeholder="Ej. Eje SAE 1045 Ø50mm L=200"
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
        />
      </label>

      <div className="empresa-campo-fila">
        <label className="empresa-campo">
          Código del cliente
          <input
            className="empresa-input"
            placeholder="Ej. 4517-AB"
            value={codigoCliente}
            onChange={(e) => setCodigoCliente(e.target.value)}
          />
        </label>
        <label className="empresa-campo">
          Material
          <SelectorConAlta
            valor={materialId}
            opciones={materiales}
            onCambiar={setMaterialId}
            onAgregar={onAgregarMaterial}
            placeholderNuevo="Nuevo material"
          />
        </label>
        <label className="empresa-campo">
          Presentación de materia prima
          <input
            className="empresa-input"
            placeholder="Ej. Barra Ø60 x 6mts"
            value={presentacion}
            onChange={(e) => setPresentacion(e.target.value)}
          />
        </label>
      </div>

      <label className="filtro-check item-check">
        <input type="checkbox" checked={esDispositivo} onChange={(e) => setEsDispositivo(e.target.checked)} />
        <span>
          <strong>Es dispositivo o pieza auxiliar</strong> — pieza necesaria para fabricar el trabajo (ej. una
          mordaza).
        </span>
      </label>

      <div className="empresa-campo">
        <span className="pf-label">Foto (opcional)</span>
        <CajaFoto previewUrl={previewUrl} onElegir={elegirFoto} onQuitar={quitarFoto} />
      </div>

      {error && <p className="empresa-form-error">{error}</p>}

      <div className="pf-acciones">
        <button type="button" className="empresa-boton-secundario" onClick={onCancelar}>
          Cancelar
        </button>
        <button type="button" className="empresa-boton" onClick={guardar} disabled={guardando}>
          {guardando ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </Modal>
  )
}

export default ModalElementoMatriz
