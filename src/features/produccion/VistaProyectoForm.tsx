import { useState, useEffect } from 'react'
import { supabase } from '../../shared/lib/supabaseClient'
import BuscadorEmpresa from '../../shared/components/BuscadorEmpresa'
import CajaFoto from './CajaFoto'
import {
  URGENCIAS,
  SUB_ESTADOS_CERRADO,
  ESTADOS_INICIALES,
  TRANSICIONES,
  estadoConfirmado,
  usaDiasHabiles,
  sumarDiasHabiles,
  formVacio,
  proyectoAForm,
  formAGuardar,
} from './proyectoTipos'
import type { Proyecto, Empresa, ContactoMin } from './proyectoTipos'
import type { Elemento } from './elementoTipos'
import SeccionContenido from './SeccionContenido'
import { crearComponenteInicial } from './elementosApi'

const BUCKET = 'proyectos-fotos'

function VistaProyectoForm({
  proyecto,
  empresas,
  onCerrar,
  onAbrirElemento,
}: {
  proyecto: Proyecto | null // null = nuevo
  empresas: Empresa[]
  onCerrar: () => void // vuelve a la lista (y recarga)
  onAbrirElemento: (el: Elemento, proyecto?: Proyecto) => void
}) {
  const esNuevo = proyecto == null

  const [form, setForm] = useState(
    proyecto ? proyectoAForm(proyecto) : formVacio(),
  )
  const [contactos, setContactos] = useState<ContactoMin[]>([])
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [modalCerrado, setModalCerrado] = useState(false)

  // Id del proyecto una vez creado en el alta: habilita el Contenido sin cerrar
  // el form y hace que los guardados siguientes actualicen en vez de insertar.
  const [proyectoIdCreado, setProyectoIdCreado] = useState<number | null>(null)
  const idExistente = proyecto?.id ?? proyectoIdCreado
  // Atajo "un solo item" (solo en alta).
  const [unSoloItem, setUnSoloItem] = useState(false)

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

  // Contactos para el desplegable: los del Cliente y, si está cargado, los del
  // Cliente final (empresa). Se recargan cuando cambia cualquiera de los dos.
  useEffect(() => {
    const cfId = form.cfHabilitado && !form.cfLibre ? form.cfEmpresaId : null
    const ids = [form.empresaId, cfId].filter((x): x is number => x != null)
    if (ids.length === 0) {
      setContactos([])
      return
    }
    let activo = true
    supabase
      .from('empresa_contactos')
      .select('id, nombre, apellido, empresa_id')
      .in('empresa_id', ids)
      .order('apellido')
      .then(({ data }) => {
        if (activo) setContactos(data ?? [])
      })
    return () => {
      activo = false
    }
  }, [form.empresaId, form.cfEmpresaId, form.cfHabilitado, form.cfLibre])

  const estadosPosibles = esNuevo
    ? ESTADOS_INICIALES
    : TRANSICIONES[proyecto!.estado] ?? [proyecto!.estado]

  // Aplica la regla "limpiar lo que queda deshabilitado" al pasar a un estado.
  // - estados sin pedido firme (días hábiles): se limpian Nº de pedido y la
  //   fecha de entrega firme (en gris se muestra el cálculo como preview);
  // - estados confirmados: se limpian plazo y límite para cotizar, y la fecha
  //   de entrega se autocompleta desde el plazo si estaba vacía.
  function aplicarEstado(base: typeof form, nuevo: string) {
    const anterior = base.estado
    const cambios = { ...base, estado: nuevo }
    if (usaDiasHabiles(nuevo)) {
      cambios.pedidoNro = ''
      cambios.fechaEntrega = ''
    } else {
      if (
        usaDiasHabiles(anterior) &&
        cambios.plazoDiasHabiles.trim() &&
        cambios.fechaIngreso &&
        !cambios.fechaEntrega
      ) {
        cambios.fechaEntrega = sumarDiasHabiles(
          cambios.fechaIngreso,
          Number(cambios.plazoDiasHabiles),
        )
      }
      cambios.plazoDiasHabiles = ''
      cambios.fechaLimiteCotizar = ''
    }
    if (anterior === 'Solicitud' && nuevo === 'Pedido') {
      cambios.pasoPorSolicitud = true
    }
    if (nuevo !== 'Cerrado') cambios.subEstadoCerrado = ''
    return cambios
  }

  // Cambio de estado desde el selector. Cerrado abre un modal para elegir el
  // sub-estado; el estado real se aplica recién al confirmar el modal.
  function cambiarEstado(nuevo: string) {
    if (nuevo === 'Cerrado') {
      setModalCerrado(true)
      return
    }
    setForm(aplicarEstado(form, nuevo))
  }

  function confirmarCerrado(sub: string) {
    const cambios = aplicarEstado(form, 'Cerrado')
    cambios.subEstadoCerrado = sub
    setForm(cambios)
    setModalCerrado(false)
  }

  // Construye un Proyecto para el encabezado de la vista de elemento a partir de
  // lo cargado en el form (usado cuando el proyecto todavía no está en la lista,
  // ej. recién creado). En edición usamos el proyecto real, que ya trae los joins.
  function construirProyectoVista(id: number): Proyecto {
    const empresaNombre =
      empresas.find((e) => e.id === form.empresaId)?.nombre ?? ''
    return {
      ...(formAGuardar(form) as object),
      id,
      empresa: { nombre: empresaNombre },
      contacto: null,
      cliente_final: null,
    } as unknown as Proyecto
  }
  function proyVista(): Proyecto | undefined {
    if (proyecto) return proyecto
    return idExistente != null ? construirProyectoVista(idExistente) : undefined
  }

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

    const creando = idExistente == null
    let proyectoId = idExistente
    if (!creando) {
      const { error } = await supabase
        .from('proyectos')
        .update(formAGuardar(form))
        .eq('id', idExistente as number)
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
    let fotoProyectoUrl: string | null = fotoUrlActual
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
          fotoProyectoUrl = ruta
        }
      } else if (fotoQuitada && fotoUrlActual) {
        await supabase.storage.from(BUCKET).remove([fotoUrlActual])
        await supabase
          .from('proyectos')
          .update({ foto_url: null })
          .eq('id', proyectoId)
        fotoProyectoUrl = null
      }
    }

    // Atajo "un solo item": crea un componente que hereda descripción y foto del
    // proyecto y lo abre directamente para cargarle el resto (cantidad, etc.).
    if (creando && unSoloItem && proyectoId != null) {
      const comp = await crearComponenteInicial(
        proyectoId,
        form.descripcion.trim(),
        fotoProyectoUrl,
      )
      setGuardando(false)
      setProyectoIdCreado(proyectoId)
      setUnSoloItem(false)
      if (comp) onAbrirElemento(comp, construirProyectoVista(proyectoId))
      return
    }

    setGuardando(false)
    if (creando) {
      // Alta: no cerramos; el proyecto queda creado y se habilita el Contenido.
      setProyectoIdCreado(proyectoId)
    } else {
      onCerrar()
    }
  }

  // Banderas de habilitación de campos según el estado.
  const confirmado = estadoConfirmado(form.estado)
  const diasHabiles = usaDiasHabiles(form.estado)

  // En estados sin pedido firme, la fecha de entrega se muestra en gris con
  // el cálculo (ingreso + plazo en días hábiles) como preview.
  const fechaEntregaCalc =
    !confirmado && form.plazoDiasHabiles.trim() && form.fechaIngreso
      ? sumarDiasHabiles(form.fechaIngreso, Number(form.plazoDiasHabiles))
      : ''

  // Etiqueta del Estado en el selector: Cerrado muestra el sub-estado.
  function etiquetaEstado(s: string) {
    if (s === 'Cerrado' && form.estado === 'Cerrado' && form.subEstadoCerrado) {
      return `Cerrado (${form.subEstadoCerrado})`
    }
    return s
  }

  return (
    <div className="pf-vista">
      <div className="vista-topbar">
        <button
          type="button"
          className="empresa-boton-secundario"
          onClick={onCerrar}
        >
          ← Volver
        </button>
      </div>
      <div className="pf-breadcrumb">
        Proyectos › {esNuevo ? 'Nuevo' : 'Editar'}
      </div>

      <div className="pf-card">
        <h2 className="pf-titulo">
          {esNuevo ? 'Nuevo proyecto' : `Editar proyecto #${proyecto!.id}`}
        </h2>

        {/* Bloque superior: la foto sola a la izquierda; todos los campos a la
            derecha (debajo de la foto no va nada). Los campos van en una grilla
            de 3 columnas:
              col1: cliente (1fr) | col2: ancho 65% | col3: 35%
            Fila 1: Cliente        | Contacto       | Estado
            Fila 2: Cliente final  | Nº de pedido   | OC del cliente */}
        <div className="pf-top2">
          <div className="pf-foto">
            <span className="pf-label">Foto del proyecto</span>
            <CajaFoto
              previewUrl={previewUrl}
              onElegir={elegirFoto}
              onQuitar={quitarFoto}
            />
          </div>

          <div className="pf-contenido">
            <div className="pf-campos">
              {/* Cliente + checks de cliente final */}
          <div className="pf-celda" style={{ gridColumn: 1, gridRow: 1 }}>
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
            <div className="pf-cf-checks">
              <label className="filtro-check">
                <input
                  type="checkbox"
                  checked={form.cfHabilitado}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      cfHabilitado: e.target.checked,
                      // al apagar, se limpia el cliente final
                      cfEmpresaId: e.target.checked ? form.cfEmpresaId : null,
                      cfTexto: e.target.checked ? form.cfTexto : '',
                      cfLibre: e.target.checked ? form.cfLibre : false,
                    })
                  }
                />
                Cliente final (opcional)
              </label>
              <label className="filtro-check">
                <input
                  type="checkbox"
                  checked={form.cfLibre}
                  disabled={!form.cfHabilitado}
                  onChange={(e) =>
                    setForm({ ...form, cfLibre: e.target.checked })
                  }
                />
                Permitir texto libre
              </label>
            </div>
          </div>

          {/* Cliente final. Si el check está apagado, se muestra un input
              vacío en gris (no se renderiza el buscador), así no se puede
              elegir y no depende del soporte de deshabilitado del buscador. */}
          <label className="empresa-campo" style={{ gridColumn: 1, gridRow: 2 }}>
            Cliente final
            {!form.cfHabilitado ? (
              <input
                className="empresa-input"
                placeholder="Cliente final"
                disabled
              />
            ) : form.cfLibre ? (
              <input
                className="empresa-input"
                placeholder="Cliente final (texto)"
                value={form.cfTexto}
                onChange={(e) => setForm({ ...form, cfTexto: e.target.value })}
              />
            ) : (
              <BuscadorEmpresa
                empresas={empresas}
                valorId={form.cfEmpresaId}
                onElegir={(id) => setForm({ ...form, cfEmpresaId: id })}
                placeholder="Buscar cliente final…"
              />
            )}
          </label>

          {/* Contacto (fila 1, ancho). Lista contactos del cliente y del
              cliente final; si hay cliente final, se aclara la empresa. */}
          <label className="empresa-campo" style={{ gridColumn: 2, gridRow: 1 }}>
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
              {contactos.map((c) => {
                const nombre = [c.nombre, c.apellido].filter(Boolean).join(' ')
                const emp = empresas.find((e) => e.id === c.empresa_id)
                const dosEmpresas =
                  form.cfHabilitado && !form.cfLibre && form.cfEmpresaId != null
                return (
                  <option key={c.id} value={c.id}>
                    {dosEmpresas && emp ? `${nombre} — ${emp.nombre}` : nombre}
                  </option>
                )
              })}
            </select>
            {form.empresaId != null && form.contactoId == null && (
              <span className="pf-warn">
                Falta asignar contacto. En TacticaSoft es obligatorio.
              </span>
            )}
          </label>

          {/* Estado (fila 1, angosto) */}
          <div className="empresa-campo" style={{ gridColumn: 3, gridRow: 1 }}>
            <span className="pf-label-fila">
              Estado
              {form.estado === 'Cerrado' && (
                <button
                  type="button"
                  className="pf-link"
                  onClick={() => setModalCerrado(true)}
                >
                  cambiar
                </button>
              )}
            </span>
            <select
              className="empresa-input"
              value={form.estado}
              onChange={(e) => cambiarEstado(e.target.value)}
            >
              {estadosPosibles.map((s) => (
                <option key={s} value={s}>
                  {etiquetaEstado(s)}
                </option>
              ))}
            </select>
          </div>

          {/* Nº de pedido (fila 2, ancho) */}
          <label className="empresa-campo" style={{ gridColumn: 2, gridRow: 2 }}>
            Nº de pedido
            <input
              className="empresa-input"
              placeholder={confirmado ? 'Ej. 4130 (de TacticaSoft)' : ''}
              value={form.pedidoNro}
              disabled={!confirmado}
              onChange={(e) => setForm({ ...form, pedidoNro: e.target.value })}
            />
          </label>

          {/* OC del cliente (fila 2, angosto) */}
          <label className="empresa-campo" style={{ gridColumn: 3, gridRow: 2 }}>
            OC del cliente
            <input
              className="empresa-input"
              value={form.ocCliente}
              onChange={(e) => setForm({ ...form, ocCliente: e.target.value })}
            />
          </label>
        </div>

        {/* Descripción + Urgencia en un renglón */}
        <div className="empresa-campo-fila">
          <label className="empresa-campo pf-campo-ancho">
            Descripción del proyecto *
            <input
              className="empresa-input"
              placeholder="Ej. Bomba centrífuga AJM2000"
              value={form.descripcion}
              onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
            />
          </label>
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
        </div>

        {/* Fechas y plazos: las 4 en un renglón; se habilitan según el estado.
            En estados sin pedido firme la fecha de entrega muestra el cálculo
            (ingreso + plazo) en gris. */}
        <div className="empresa-campo-fila">
          <label className="empresa-campo">
            Fecha para cotizar
            <input
              type="date"
              className="empresa-input"
              value={form.fechaLimiteCotizar}
              disabled={!diasHabiles}
              onChange={(e) =>
                setForm({ ...form, fechaLimiteCotizar: e.target.value })
              }
            />
          </label>
          <label className="empresa-campo">
            Plazo de entrega (días hábiles)
            <input
              type="number"
              className="empresa-input"
              value={form.plazoDiasHabiles}
              disabled={!diasHabiles}
              onChange={(e) =>
                setForm({ ...form, plazoDiasHabiles: e.target.value })
              }
            />
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
              value={confirmado ? form.fechaEntrega : fechaEntregaCalc}
              disabled={!confirmado}
              onChange={(e) =>
                setForm({ ...form, fechaEntrega: e.target.value })
              }
            />
          </label>
        </div>

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
          </div>
        </div>

        {/* Atajo "un solo item" (solo en el alta, antes de crear) */}
        {idExistente == null && (
          <label className="pf-check-unitem">
            <input
              type="checkbox"
              checked={unSoloItem}
              onChange={(e) => setUnSoloItem(e.target.checked)}
            />
            Es un proyecto de un solo item (crea un componente con la descripción y
            la foto del proyecto, y lo abre para cargar el resto)
          </label>
        )}

        {/* Contenido del proyecto (elementos raíz) */}
        {unSoloItem ? (
          <p className="rec-vacio">
            Al crear el proyecto se genera un componente que hereda la descripción y
            la foto, y se abre para cargar cantidad, material y procesos.
          </p>
        ) : (
          <SeccionContenido
            proyectoId={idExistente ?? 0}
            parentId={null}
            onEntrar={(el) => onAbrirElemento(el, proyVista())}
            deshabilitado={idExistente == null}
            leyenda="Creá el proyecto para poder cargar elementos."
          />
        )}
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
              : idExistente == null
                ? 'Crear proyecto'
                : 'Guardar cambios'}
          </button>
        </div>
      </div>

      {/* Modal: elegir sub-estado al cerrar el proyecto */}
      {modalCerrado && (
        <div className="pf-modal-fondo" onClick={() => setModalCerrado(false)}>
          <div className="pf-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="pf-modal-titulo">Sub-estado del cierre</h3>
            <p className="pf-modal-texto">¿Cómo se cierra el proyecto?</p>
            <div className="pf-modal-ops">
              {SUB_ESTADOS_CERRADO.map((s) => (
                <button
                  key={s}
                  type="button"
                  className="empresa-boton"
                  onClick={() => confirmarCerrado(s)}
                >
                  {s}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="empresa-boton-secundario pf-modal-cancelar"
              onClick={() => setModalCerrado(false)}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

    </div>
  )
}

export default VistaProyectoForm
