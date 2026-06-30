import { useState, useEffect } from 'react'
import { supabase } from '../../shared/lib/supabaseClient'
import BuscadorEmpresa from '../../shared/components/BuscadorEmpresa'
import CajaFoto from './CajaFoto'
import {
  URGENCIAS,
  SUB_ESTADOS_CERRADO,
  MONEDAS,
  ESTADOS_INICIALES,
  TRANSICIONES,
  estadoConfirmado,
  formVacio,
  proyectoAForm,
  formAGuardar,
} from './proyectoTipos'
import type { Proyecto, Empresa, ContactoMin } from './proyectoTipos'

const BUCKET = 'proyectos-fotos'

function VistaProyectoForm({
  proyecto,
  empresas,
  onCerrar,
}: {
  proyecto: Proyecto | null // null = nuevo
  empresas: Empresa[]
  onCerrar: () => void // vuelve a la lista (y recarga)
}) {
  const esNuevo = proyecto == null

  const [form, setForm] = useState(
    proyecto ? proyectoAForm(proyecto) : formVacio(),
  )
  const [contactos, setContactos] = useState<ContactoMin[]>([])
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ---- Foto (se retiene y se sube al guardar) ----
  const [fotoFile, setFotoFile] = useState<File | null>(null)
  const [fotoObjUrl, setFotoObjUrl] = useState<string | null>(null)
  const [fotoUrlActual] = useState<string | null>(proyecto?.foto_url ?? null)
  const [fotoQuitada, setFotoQuitada] = useState(false)

  const previewUrl =
    fotoObjUrl ??
    (!fotoQuitada && fotoUrlActual
      ? supabase.storage.from(BUCKET).getPublicUrl(fotoUrlActual).data.publicUrl
      : null)

  function elegirFoto(file: File) {
    if (fotoObjUrl) URL.revokeObjectURL(fotoObjUrl)
    setFotoFile(file)
    setFotoObjUrl(URL.createObjectURL(file))
    setFotoQuitada(false)
  }

  function quitarFoto() {
    if (fotoObjUrl) URL.revokeObjectURL(fotoObjUrl)
    setFotoFile(null)
    setFotoObjUrl(null)
    setFotoQuitada(true)
  }

  // Liberar el object URL al desmontar.
  useEffect(() => {
    return () => {
      if (fotoObjUrl) URL.revokeObjectURL(fotoObjUrl)
    }
  }, [fotoObjUrl])

  // Contactos dependientes del cliente elegido.
  useEffect(() => {
    if (form.empresaId == null) {
      setContactos([])
      return
    }
    let activo = true
    supabase
      .from('empresa_contactos')
      .select('id, nombre, apellido')
      .eq('empresa_id', form.empresaId)
      .order('apellido')
      .then(({ data }) => {
        if (activo) setContactos(data ?? [])
      })
    return () => {
      activo = false
    }
  }, [form.empresaId])

  const estadosPosibles = esNuevo
    ? ESTADOS_INICIALES
    : TRANSICIONES[proyecto!.estado] ?? [proyecto!.estado]

  async function guardar() {
    setError(null)
    if (form.empresaId == null) {
      setError('Elegí un cliente.')
      return
    }
    if (form.descripcion.trim() === '') {
      setError('La descripción es obligatoria.')
      return
    }
    setGuardando(true)

    let proyectoId = proyecto?.id ?? null
    if (proyecto) {
      const { error } = await supabase
        .from('proyectos')
        .update(formAGuardar(form))
        .eq('id', proyecto.id)
      if (error) {
        setGuardando(false)
        setError('No se pudieron guardar los cambios.')
        return
      }
    } else {
      const { data, error } = await supabase
        .from('proyectos')
        .insert(formAGuardar(form))
        .select('id')
        .single()
      if (error || !data) {
        setGuardando(false)
        setError('No se pudo crear el proyecto.')
        return
      }
      proyectoId = data.id
    }

    // Foto: subir la retenida, o borrar la actual si se quitó.
    if (proyectoId != null) {
      if (fotoFile) {
        const ext =
          fotoFile.name.split('.').pop() ||
          fotoFile.type.split('/')[1] ||
          'png'
        const ruta = `${proyectoId}/${Date.now()}.${ext}`
        const { error: eUp } = await supabase.storage
          .from(BUCKET)
          .upload(ruta, fotoFile, { upsert: true })
        if (!eUp) {
          if (fotoUrlActual) {
            await supabase.storage.from(BUCKET).remove([fotoUrlActual])
          }
          await supabase
            .from('proyectos')
            .update({ foto_url: ruta })
            .eq('id', proyectoId)
        }
      } else if (fotoQuitada && fotoUrlActual) {
        await supabase.storage.from(BUCKET).remove([fotoUrlActual])
        await supabase
          .from('proyectos')
          .update({ foto_url: null })
          .eq('id', proyectoId)
      }
    }

    setGuardando(false)
    onCerrar()
  }

  return (
    <div className="pf-vista">
      <div className="pf-breadcrumb">
        Proyectos › {esNuevo ? 'Nuevo' : 'Editar'}
      </div>

      <div className="pf-card">
        <h2 className="pf-titulo">
          {esNuevo ? 'Nuevo proyecto' : `Editar proyecto #${proyecto!.id}`}
        </h2>
        <p className="pf-subtitulo">Cargá los datos del proyecto.</p>

        {/* Fila superior: foto + (cliente/estado) */}
        <div className="pf-fila-top">
          <div className="pf-foto">
            <span className="pf-label">Foto del proyecto</span>
            <CajaFoto
              previewUrl={previewUrl}
              onElegir={elegirFoto}
              onQuitar={quitarFoto}
            />
          </div>

          <div className="pf-cliente-estado">
            {/* Columna izquierda: cliente + cliente final */}
            <div className="pf-col-cliente">
              <label className="empresa-campo">
                Cliente *
                <BuscadorEmpresa
                  empresas={empresas}
                  valorId={form.empresaId}
                  onElegir={(id) =>
                    setForm({ ...form, empresaId: id, contactoId: null })
                  }
                  placeholder="Buscar cliente…"
                />
              </label>

              <div className="empresa-campo">
                <label className="filtro-check">
                  <input
                    type="checkbox"
                    checked={form.cfHabilitado}
                    onChange={(e) =>
                      setForm({ ...form, cfHabilitado: e.target.checked })
                    }
                  />
                  Cliente final (opcional)
                </label>

                {form.cfHabilitado && (
                  <>
                    <label className="filtro-check">
                      <input
                        type="checkbox"
                        checked={form.cfLibre}
                        onChange={(e) =>
                          setForm({ ...form, cfLibre: e.target.checked })
                        }
                      />
                      Permitir texto libre
                    </label>
                    {form.cfLibre ? (
                      <input
                        className="empresa-input"
                        placeholder="Cliente final (texto)"
                        value={form.cfTexto}
                        onChange={(e) =>
                          setForm({ ...form, cfTexto: e.target.value })
                        }
                      />
                    ) : (
                      <BuscadorEmpresa
                        empresas={empresas}
                        valorId={form.cfEmpresaId}
                        onElegir={(id) => setForm({ ...form, cfEmpresaId: id })}
                        placeholder="Buscar cliente final…"
                      />
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Columna derecha: estado + (Nº de pedido, debajo de estado) */}
            <div className="pf-col-estado">
              <label className="empresa-campo">
                Estado
                <select
                  className="empresa-input"
                  value={form.estado}
                  onChange={(e) => setForm({ ...form, estado: e.target.value })}
                >
                  {estadosPosibles.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>

              {estadoConfirmado(form.estado) && (
                <label className="empresa-campo">
                  Nº de pedido
                  <input
                    className="empresa-input"
                    placeholder="Ej. 4130 (de TacticaSoft)"
                    value={form.pedidoNro}
                    onChange={(e) =>
                      setForm({ ...form, pedidoNro: e.target.value })
                    }
                  />
                  {!form.pedidoNro.trim() && (
                    <span className="pf-warn">
                      Sin Nº de pedido. En TacticaSoft es obligatorio para
                      proyectos confirmados.
                    </span>
                  )}
                </label>
              )}

              {/* Sub-estado solo si Cerrado */}
              {form.estado === 'Cerrado' && (
                <label className="empresa-campo">
                  Sub-estado (cerrado)
                  <select
                    className="empresa-input"
                    value={form.subEstadoCerrado}
                    onChange={(e) =>
                      setForm({ ...form, subEstadoCerrado: e.target.value })
                    }
                  >
                    <option value="">— Elegí —</option>
                    {SUB_ESTADOS_CERRADO.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
          </div>
        </div>

        {/* Contacto (con advertencia suave) */}
        <label className="empresa-campo">
          Contacto del proyecto
          <select
            className="empresa-input"
            value={form.contactoId ?? ''}
            disabled={form.empresaId == null}
            onChange={(e) =>
              setForm({
                ...form,
                contactoId: e.target.value ? Number(e.target.value) : null,
              })
            }
          >
            <option value="">
              {form.empresaId == null
                ? '— Seleccioná un cliente primero —'
                : '— Sin contacto —'}
            </option>
            {contactos.map((c) => (
              <option key={c.id} value={c.id}>
                {[c.nombre, c.apellido].filter(Boolean).join(' ')}
              </option>
            ))}
          </select>
          {form.empresaId != null && form.contactoId == null && (
            <span className="pf-warn">
              Falta asignar contacto del proyecto. En TacticaSoft es
              obligatorio.
            </span>
          )}
        </label>

        {/* Descripción */}
        <label className="empresa-campo">
          Descripción del proyecto *
          <input
            className="empresa-input"
            placeholder="Ej. Bomba centrífuga AJM2000"
            value={form.descripcion}
            onChange={(e) =>
              setForm({ ...form, descripcion: e.target.value })
            }
          />
        </label>

        {/* Urgencia + fechas */}
        <div className="empresa-campo-fila">
          <label className="empresa-campo">
            Urgencia
            <select
              className="empresa-input"
              value={form.urgencia}
              onChange={(e) => setForm({ ...form, urgencia: e.target.value })}
            >
              {URGENCIAS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </label>
          <label className="empresa-campo">
            Fecha de ingreso
            <input
              type="date"
              className="empresa-input"
              value={form.fechaIngreso}
              onChange={(e) =>
                setForm({ ...form, fechaIngreso: e.target.value })
              }
            />
          </label>
          <label className="empresa-campo">
            Fecha de entrega
            <input
              type="date"
              className="empresa-input"
              value={form.fechaEntrega}
              onChange={(e) =>
                setForm({ ...form, fechaEntrega: e.target.value })
              }
            />
          </label>
          <label className="empresa-campo">
            Límite para cotizar
            <input
              type="date"
              className="empresa-input"
              value={form.fechaLimiteCotizar}
              onChange={(e) =>
                setForm({ ...form, fechaLimiteCotizar: e.target.value })
              }
            />
          </label>
        </div>

        <label className="filtro-check">
          <input
            type="checkbox"
            checked={form.pasoPorSolicitud}
            onChange={(e) =>
              setForm({ ...form, pasoPorSolicitud: e.target.checked })
            }
          />
          Pasó por solicitud
        </label>

        {/* Observación de anulación / pérdida */}
        {(form.estado === 'Anulado' || form.estado === 'Perdido') && (
          <label className="empresa-campo">
            Observación de anulación / pérdida
            <textarea
              className="empresa-input"
              rows={2}
              value={form.observacionesAnulacion}
              onChange={(e) =>
                setForm({ ...form, observacionesAnulacion: e.target.value })
              }
            />
          </label>
        )}

        {/* Observaciones para mail (por ahora textarea simple) */}
        <label className="empresa-campo">
          Observaciones para mail estandarizado
          <textarea
            className="empresa-input"
            rows={3}
            placeholder="Texto opcional que aparece en la fila Observaciones del mail"
            value={form.observacionesMail}
            onChange={(e) =>
              setForm({ ...form, observacionesMail: e.target.value })
            }
          />
        </label>

        {/* Comercial (la moneda queda en el proyecto; importe e IVA son por item) */}
        <div className="empresa-campo-fila">
          <label className="empresa-campo">
            Moneda
            <select
              className="empresa-input"
              value={form.moneda}
              onChange={(e) => setForm({ ...form, moneda: e.target.value })}
            >
              {MONEDAS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>
          <label className="empresa-campo">
            OC del cliente
            <input
              className="empresa-input"
              value={form.ocCliente}
              onChange={(e) => setForm({ ...form, ocCliente: e.target.value })}
            />
          </label>
        </div>

        {error && <p className="empresa-form-error">{error}</p>}

        <div className="pf-acciones">
          <button
            type="button"
            className="empresa-boton-secundario"
            onClick={onCerrar}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="empresa-boton"
            onClick={guardar}
            disabled={guardando}
          >
            {guardando
              ? 'Guardando…'
              : esNuevo
                ? 'Crear proyecto'
                : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default VistaProyectoForm
