import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../shared/lib/supabaseClient'
import Modal from '../../shared/components/Modal'
import {
  cargarLineasDisponibles,
  crearNotaEnvio,
  actualizarNotaEnvio,
  PREFIJO_IMPRESO_NDE,
  type LineaDisponible,
  type LineaNota,
  type NotaParaEditar,
} from './notasEnvioApi'

type Fila = LineaNota & { clave: string; max: number | null }

// Genera o EDITA una nota de envío. En modo `esExterna` (solo alta) pide el
// número impreso en el papel. Si viene `notaEditar`, precarga esa nota.
function ModalNotaEnvio({
  proyectoId,
  empresaId,
  pedidoNro,
  contactoId,
  esExterna,
  notaEditar,
  onCerrar,
  onGuardada,
}: {
  proyectoId: number | null
  empresaId: number
  pedidoNro: string | null
  contactoId: number | null
  esExterna: boolean
  notaEditar?: NotaParaEditar
  onCerrar: () => void
  onGuardada: (numero: string) => void
}) {
  const editando = notaEditar != null
  const externa = editando ? notaEditar!.esExterna : esExterna

  const [disponibles, setDisponibles] = useState<LineaDisponible[]>([])
  const [filas, setFilas] = useState<Fila[]>([])
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const hoy = new Date().toISOString().slice(0, 10)
  const [fecha, setFecha] = useState(editando ? notaEditar!.fecha || hoy : hoy)
  const [pedido, setPedido] = useState(editando ? notaEditar!.pedidoNro : pedidoNro ?? '')
  const [observaciones, setObservaciones] = useState(editando ? notaEditar!.observaciones : '')
  const [numImpreso, setNumImpreso] = useState(editando ? notaEditar!.numeroImpresoDigitos : '')
  const [cli, setCli] = useState(
    editando
      ? notaEditar!.cliente
      : { nombre: '', razonSocial: '', cuit: '', contacto: '', direccion: '' },
  )

  useEffect(() => {
    let vivo = true
    ;(async () => {
      try {
        // Disponibilidad solo si la nota cuelga de un proyecto. Al editar, se
        // excluye la propia nota para que sus unidades no se cuenten en contra.
        const lineas =
          proyectoId != null
            ? await cargarLineasDisponibles(proyectoId, notaEditar?.id)
            : []
        if (!vivo) return
        setDisponibles(lineas)

        if (editando) {
          const disp = new Map(lineas.map((l) => [l.elementoId, l] as const))
          setFilas(
            notaEditar!.lineas.map((l, i) => ({
              clave: l.elementoId != null ? 'el:' + l.elementoId : 'man:' + i,
              elementoId: l.elementoId,
              descripcion: l.descripcion,
              cantidad: l.cantidad,
              max: l.elementoId != null ? (disp.get(l.elementoId)?.disponible ?? null) : null,
            })),
          )
          setCargando(false)
          return
        }

        // Alta: líneas por defecto (lo disponible) + snapshot del cliente.
        setFilas(
          lineas
            .filter((l) => l.disponible > 0)
            .map((l) => ({
              clave: 'el:' + l.elementoId,
              elementoId: l.elementoId,
              descripcion: l.descripcion,
              cantidad: l.disponible,
              max: l.disponible,
            })),
        )
        const [emp, cont, dirs] = await Promise.all([
          supabase.from('empresas').select('nombre, razon_social, cuit').eq('id', empresaId).maybeSingle(),
          contactoId
            ? supabase.from('empresa_contactos').select('nombre, apellido').eq('id', contactoId).maybeSingle()
            : Promise.resolve({ data: null, error: null }),
          supabase
            .from('empresa_direcciones')
            .select('tipo, calle, numero, localidades ( nombre )')
            .eq('empresa_id', empresaId),
        ])
        if (!vivo) return
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const e = emp.data as any
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const c = cont.data as any
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const listaDir = (dirs.data ?? []) as any[]
        const dir =
          listaDir.find((d) => (d.tipo ?? '').toLowerCase().includes('entrega')) ?? listaDir[0] ?? null
        const loc = dir ? (Array.isArray(dir.localidades) ? dir.localidades[0] : dir.localidades) : null
        setCli({
          nombre: e?.nombre ?? '',
          razonSocial: e?.razon_social ?? '',
          cuit: e?.cuit ?? '',
          contacto: c ? [c.nombre, c.apellido].filter(Boolean).join(' ') : '',
          direccion: dir
            ? [dir.calle, dir.numero].filter(Boolean).join(' ') + (loc?.nombre ? ', ' + loc.nombre : '')
            : '',
        })
      } catch (err) {
        if (vivo) setError(err instanceof Error ? err.message : 'No se pudieron cargar los datos.')
      } finally {
        if (vivo) setCargando(false)
      }
    })()
    return () => {
      vivo = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proyectoId, empresaId, contactoId])

  const aviso = useMemo(() => {
    const bloqueadas = disponibles.filter((l) => l.porRemitoDirecto > 0).length
    const yaEnNotas = disponibles.filter((l) => l.porRemitoDirecto === 0 && l.yaRemitido > 0).length
    const partes: string[] = []
    if (bloqueadas) partes.push(`${bloqueadas} ya tienen remito cargado`)
    if (yaEnNotas) partes.push(`${yaEnNotas} se remitieron total o parcialmente en otras notas`)
    return partes.length ? 'Quedaron afuera líneas del proyecto: ' + partes.join(' y ') + '.' : ''
  }, [disponibles])

  function setFila(clave: string, campo: 'descripcion' | 'cantidad', valor: string) {
    setFilas((prev) =>
      prev.map((f) =>
        f.clave !== clave
          ? f
          : campo === 'descripcion'
            ? { ...f, descripcion: valor }
            : { ...f, cantidad: Math.max(0, Number(valor) || 0) },
      ),
    )
  }

  function agregarLinea() {
    setFilas((prev) => [
      ...prev,
      { clave: 'man:' + Date.now(), elementoId: null, descripcion: '', cantidad: 1, max: null },
    ])
  }

  async function guardar() {
    setError(null)
    if (!fecha) {
      setError('Ingresá la fecha.')
      return
    }
    if (externa && !numImpreso.replace(/\D/g, '')) {
      setError('Ingresá los últimos 4 dígitos del número impreso en la nota.')
      return
    }
    const conExceso = filas.find((f) => f.max != null && f.cantidad > f.max)
    if (conExceso) {
      setError(`"${conExceso.descripcion}" supera lo disponible (${conExceso.max}).`)
      return
    }
    setGuardando(true)
    const datos = {
      proyectoId,
      empresaId,
      fecha,
      pedidoNro: pedido.trim() || null,
      observaciones: observaciones.trim() || null,
      esExterna: externa,
      numeroImpresoDigitos: externa ? numImpreso : null,
      cliente: cli,
      lineas: filas.map((f) => ({
        elementoId: f.elementoId,
        descripcion: f.descripcion,
        cantidad: f.cantidad,
      })),
    }
    const r = editando
      ? await actualizarNotaEnvio(notaEditar!.id, datos)
      : await crearNotaEnvio(datos)
    setGuardando(false)
    if (r.error) {
      setError(r.error)
      return
    }
    onGuardada(editando ? notaEditar!.numero : (r as { numero?: string }).numero ?? '')
  }

  const titulo = editando
    ? `Editar nota de envío ${notaEditar!.numero}`
    : externa
      ? 'Cargar nota de envío externa'
      : 'Nueva nota de envío'

  return (
    <Modal titulo={titulo} onCerrar={onCerrar} ancho={820}>
      {cargando ? (
        <div className="rec-vacio">Cargando…</div>
      ) : (
        <>
          {aviso && <div className="ne-aviso">{aviso}</div>}

          <div className="ne-campos">
            <label className="empresa-campo">
              Fecha *
              <input type="date" className="empresa-input" value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </label>
            <label className="empresa-campo">
              Nº de pedido
              <input className="empresa-input" value={pedido} onChange={(e) => setPedido(e.target.value)} />
            </label>
            {externa && (
              <label className="empresa-campo">
                Nº impreso en la nota *
                <div className="ne-numimp">
                  <span className="ne-numimp-pref">{PREFIJO_IMPRESO_NDE}</span>
                  <input
                    className="empresa-input"
                    maxLength={4}
                    placeholder="0000"
                    value={numImpreso}
                    onChange={(e) => setNumImpreso(e.target.value.replace(/\D/g, ''))}
                  />
                </div>
              </label>
            )}
          </div>

          <div className="ne-campos">
            <label className="empresa-campo">
              Cliente
              <input className="empresa-input" value={cli.nombre} onChange={(e) => setCli({ ...cli, nombre: e.target.value })} />
            </label>
            <label className="empresa-campo">
              Razón social
              <input className="empresa-input" value={cli.razonSocial} onChange={(e) => setCli({ ...cli, razonSocial: e.target.value })} />
            </label>
            <label className="empresa-campo">
              CUIT
              <input className="empresa-input" value={cli.cuit} onChange={(e) => setCli({ ...cli, cuit: e.target.value })} />
            </label>
          </div>
          <div className="ne-campos">
            <label className="empresa-campo">
              Contacto
              <input className="empresa-input" value={cli.contacto} onChange={(e) => setCli({ ...cli, contacto: e.target.value })} />
            </label>
            <label className="empresa-campo ne-campo-ancho">
              Dirección de entrega
              <input className="empresa-input" value={cli.direccion} onChange={(e) => setCli({ ...cli, direccion: e.target.value })} />
            </label>
          </div>

          <div className="ne-lineas-tit">
            <span>Ítems de la nota</span>
            <button type="button" className="detalle-btn-add" onClick={agregarLinea}>
              + Agregar línea
            </button>
          </div>
          <div className="ne-lineas">
            {filas.length === 0 ? (
              <div className="rec-vacio">
                No hay ítems disponibles del proyecto. Podés cargar líneas a mano (por ejemplo, una
                pieza de muestra).
              </div>
            ) : (
              filas.map((f, i) => (
                <div key={f.clave} className={'ne-linea' + (i % 2 ? ' ne-linea-alt' : '')}>
                  <input
                    className="empresa-input ne-linea-desc"
                    value={f.descripcion}
                    placeholder="Descripción"
                    readOnly={f.elementoId != null}
                    onChange={(e) => setFila(f.clave, 'descripcion', e.target.value)}
                  />
                  <input
                    type="number"
                    min={0}
                    className="empresa-input ne-linea-cant"
                    value={f.cantidad}
                    onChange={(e) => setFila(f.clave, 'cantidad', e.target.value)}
                  />
                  <span className="ne-linea-max">{f.max != null ? `de ${f.max}` : ''}</span>
                  <button
                    type="button"
                    className="empresas-borrar"
                    onClick={() => setFilas((prev) => prev.filter((x) => x.clave !== f.clave))}
                  >
                    Quitar
                  </button>
                </div>
              ))
            )}
          </div>

          <label className="empresa-campo">
            Observaciones
            <textarea
              className="empresa-input"
              rows={2}
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
            />
          </label>

          {error && <p className="empresa-form-error">{error}</p>}

          <div className="pf-acciones">
            <button type="button" className="empresa-boton-secundario" onClick={onCerrar}>
              Cancelar
            </button>
            <button type="button" className="empresa-boton" onClick={guardar} disabled={guardando}>
              {guardando ? 'Guardando…' : editando ? 'Guardar cambios' : externa ? 'Registrar nota' : 'Generar nota'}
            </button>
          </div>
        </>
      )}
    </Modal>
  )
}

export default ModalNotaEnvio
