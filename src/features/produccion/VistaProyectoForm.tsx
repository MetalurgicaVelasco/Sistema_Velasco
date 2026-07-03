import { useState, useEffect } from 'react'
import { supabase } from '../../shared/lib/supabaseClient'
import BuscadorEmpresa from '../../shared/components/BuscadorEmpresa'
import MenuContextual from '../../shared/components/MenuContextual'
import CajaFoto from './CajaFoto'
import ModalItem from './ModalItem'
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
import {
  elementoDraftVacio,
  elementoRowADraft,
  duplicarDraft,
  draftAGuardar,
  crearMaterial,
} from './elementoTipos'
import type { ElementoDraft, Material } from './elementoTipos'

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
  const [modalCerrado, setModalCerrado] = useState(false)

  // ---- Items del proyecto (viven en el form, se persisten al guardar) ----
  const [items, setItems] = useState<ElementoDraft[]>([])
  const [materiales, setMateriales] = useState<Material[]>([])
  const [itemEditando, setItemEditando] = useState<ElementoDraft | null>(null)
  // ids de items que ya estaban en la base (para detectar los borrados).
  const [idsOriginales, setIdsOriginales] = useState<number[]>([])

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

  // Catálogo de materiales (para el selector) + items existentes (en edición).
  useEffect(() => {
    let activo = true
    supabase
      .from('materiales')
      .select('id, nombre')
      .order('nombre')
      .then(({ data }) => {
        if (activo) setMateriales(data ?? [])
      })
    if (proyecto) {
      supabase
        .from('elementos')
        .select(
          'id, proyecto_id, parent_elemento_id, tipo, descripcion, cantidad, material_id, presentacion_mat_prima, codigo_cliente, fecha_fin_estipulada, foto_url, estado, es_retrabajo, es_dispositivo',
        )
        .eq('proyecto_id', proyecto.id)
        .order('id')
        .then(({ data }) => {
          if (activo && data) {
            setItems(data.map(elementoRowADraft))
            setIdsOriginales(data.map((r) => r.id))
          }
        })
    }
    return () => {
      activo = false
    }
  }, [proyecto])

  // ---- Acciones de items ----
  function agregarItem() {
    setItemEditando(elementoDraftVacio())
  }
  function duplicarItem(it: ElementoDraft) {
    setItems((prev) => [...prev, duplicarDraft(it)])
  }
  function borrarItem(key: string) {
    setItems((prev) => prev.filter((x) => x.key !== key))
  }
  // Al guardar desde el modal: si el item ya está en la lista lo reemplaza,
  // si no, lo agrega.
  function guardarItem(d: ElementoDraft) {
    setItems((prev) =>
      prev.some((x) => x.key === d.key)
        ? prev.map((x) => (x.key === d.key ? d : x))
        : [...prev, d],
    )
    setItemEditando(null)
  }
  // Alta de material desde el selector: crea en la base y lo suma a la lista.
  async function agregarMaterial(nombre: string) {
    const m = await crearMaterial(nombre)
    if (m) {
      setMateriales((prev) =>
        prev.some((x) => x.id === m.id)
          ? prev
          : [...prev, m].sort((a, b) => a.nombre.localeCompare(b.nombre)),
      )
    }
    return m
  }

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

    // Sincronizar items: borrar los quitados, insertar los nuevos, actualizar
    // los existentes, y subir la foto de cada uno (necesita el id del item).
    if (proyectoId != null) {
      const idsActuales = items
        .filter((d) => d.dbId != null)
        .map((d) => d.dbId as number)
      const aBorrar = idsOriginales.filter((id) => !idsActuales.includes(id))
      if (aBorrar.length) {
        await supabase.from('elementos').delete().in('id', aBorrar)
      }

      for (const d of items) {
        const payload = draftAGuardar(d, proyectoId)
        let itemId = d.dbId
        if (d.dbId == null) {
          const { data } = await supabase
            .from('elementos')
            .insert(payload)
            .select('id')
            .single()
          itemId = data?.id ?? null
        } else {
          await supabase.from('elementos').update(payload).eq('id', d.dbId)
        }

        // Foto nueva del item (si hay): subir a items/{itemId}/... y guardar path.
        if (itemId != null && d.fotoArchivo) {
          const ext =
            d.fotoArchivo.name.split('.').pop() ||
            d.fotoArchivo.type.split('/')[1] ||
            'png'
          const ruta = `items/${itemId}/${Date.now()}.${ext}`
          const { error: eUp } = await supabase.storage
            .from(BUCKET)
            .upload(ruta, d.fotoArchivo, { upsert: true })
          if (!eUp) {
            await supabase
              .from('elementos')
              .update({ foto_url: ruta })
              .eq('id', itemId)
          }
        }
      }
    }

    setGuardando(false)
    onCerrar()
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

  // Remitidos: por ahora siempre 0 (vendrá de remitos). Un item está
  // "completo" cuando lo remitido iguala a lo pedido; ahí el número va verde.
  // Si TODOS los items están completos, el título Remitidos también va verde.
  const remitidosDe = (_it: ElementoDraft) => 0
  const cantidadDe = (it: ElementoDraft) => Number(it.cantidad || '1')
  const todosRemitidos =
    items.length > 0 && items.every((it) => remitidosDe(it) === cantidadDe(it))

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

        {/* Items del proyecto */}
        <div className="item-seccion">
          <div className="item-seccion-head">
            <h3 className="item-seccion-titulo">
              Items del proyecto
              {items.length === 0 && (
                <span className="item-aviso"> · al menos uno</span>
              )}
            </h3>
            <div className="item-seccion-botones">
              <span className="item-contador">
                {items.length} item(s) cargado(s)
              </span>
              <button
                type="button"
                className="empresa-boton"
                onClick={agregarItem}
              >
                + Agregar item
              </button>
              <button
                type="button"
                className="empresa-boton-secundario"
                disabled
                title="Próximamente"
              >
                + Agregar desde Matriz
              </button>
            </div>
          </div>

          <MenuContextual
            items={[{ label: '+ Agregar item', onSelect: agregarItem }]}
          >
            {items.length === 0 ? (
              <p className="item-vacio">
                Aún no hay items. Apretá "+ Agregar item" para empezar.
              </p>
            ) : (
              <div className="item-tabla">
                {/* Encabezados (alineados con las columnas de cada fila) */}
                <div className="item-grid item-tabla-head">
                  <span className="item-c-num">N°</span>
                  <span className="item-c-cant">CANT.</span>
                  <span
                    className={`item-c-rem${
                      todosRemitidos ? ' item-rem-ok' : ''
                    }`}
                  >
                    REMITIDOS
                  </span>
                  <span className="item-c-foto">FOTO</span>
                  <span className="item-c-item">ITEM</span>
                  <span className="item-c-acc" />
                </div>

                {items.map((it, i) => {
                  const thumb =
                    it.fotoPreview ??
                    (it.fotoUrl
                      ? supabase.storage.from(BUCKET).getPublicUrl(it.fotoUrl)
                          .data.publicUrl
                      : null)
                  const itemCompleto = remitidosDe(it) === cantidadDe(it)
                  return (
                    <div key={it.key} className="item-grid item-fila">
                      <span className="item-c-num">{i + 1}</span>
                      <span className="item-c-cant">{it.cantidad || '1'}</span>
                      <span
                        className={`item-c-rem${
                          itemCompleto ? ' item-rem-ok' : ''
                        }`}
                      >
                        {remitidosDe(it)}
                      </span>
                      <span className="item-c-foto">
                        {thumb ? (
                          <img src={thumb} alt="" className="item-thumb" />
                        ) : (
                          <span className="item-thumb item-thumb-vacia">
                            <svg
                              viewBox="0 0 24 24"
                              width="18"
                              height="18"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                            </svg>
                          </span>
                        )}
                      </span>
                      <div className="item-c-item">
                        <span className="item-desc-texto">
                          {it.descripcion || '(sin descripción)'}
                          {it.codigoCliente && (
                            <span className="item-codigo">
                              {' '}
                              ({it.codigoCliente})
                            </span>
                          )}
                        </span>
                        <span className="item-badge">{it.estado}</span>
                      </div>
                      <div className="item-c-acc">
                        <button
                          type="button"
                          className="empresas-editar"
                          onClick={() => setItemEditando(it)}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          className="empresas-editar"
                          onClick={() => duplicarItem(it)}
                        >
                          Duplicar
                        </button>
                        <button
                          type="button"
                          className="empresas-borrar"
                          onClick={() => borrarItem(it.key)}
                        >
                          Borrar
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </MenuContextual>
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
                ? `Crear proyecto con ${items.length} item(s)`
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

      {/* Modal: alta/edición de un item */}
      {itemEditando && (
        <ModalItem
          draft={itemEditando}
          materiales={materiales}
          onAgregarMaterial={agregarMaterial}
          onGuardar={guardarItem}
          onCancelar={() => setItemEditando(null)}
        />
      )}
    </div>
  )
}

export default VistaProyectoForm
