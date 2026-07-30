import { useState, useEffect, useMemo } from 'react'
import Modal from '../../shared/components/Modal'
import ModalConfirmar from '../../shared/components/ModalConfirmar'
import MenuContextual from '../../shared/components/MenuContextual'
import TablaConfigurable, { type ColumnaDef } from '../../shared/components/TablaConfigurable'
import PanelColumnas from '../../shared/components/PanelColumnas'
import { useConfigTabla } from '../../shared/hooks/useConfigTabla'
import {
  cargarNotasProyecto,
  crearNotaProyecto,
  actualizarNotaProyecto,
  eliminarNotaProyecto,
  usuarioActualId,
  type NotaProyecto,
} from './notasProyectoApi'

function fmtFechaHora(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`
}

// Vista previa en la celda: el contenido puede ser largo y tener saltos de
// línea; en la tabla va en una sola línea (el texto completo se ve con "Ver").
function unaLinea(texto: string): string {
  return texto.replace(/\s+/g, ' ').trim()
}

// Solapa "Notas del Proyecto": notas que se van dejando en un proyecto, en
// forma de tabla. Guardan autor y fecha/hora de creación y de modificación.
// Solo el autor puede editar o borrar su nota.
function NotasProyecto({
  proyectoId,
  seccion = false,
}: {
  proyectoId: number
  // true = bloque con recuadro, título y botón "+ Nueva nota" (vista del
  // proyecto). false = solo la tabla, con el menú contextual (franja 4).
  seccion?: boolean
}) {
  const [notas, setNotas] = useState<NotaProyecto[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [miId, setMiId] = useState<string | null>(null)

  const [verNota, setVerNota] = useState<NotaProyecto | null>(null)
  // editor: { nota: null } = nueva; { nota } = editar esa.
  const [editor, setEditor] = useState<{ nota: NotaProyecto | null } | null>(null)
  const [texto, setTexto] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [errorEditor, setErrorEditor] = useState<string | null>(null)
  const [borrar, setBorrar] = useState<NotaProyecto | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  const {
    columnas: configCols,
    setColumnas: setConfigCols,
    orden,
    setOrden,
  } = useConfigTabla('proyectos.notas.columnas', [
    { id: 'creacion', visible: true, ancho: 130 },
    { id: 'modificacion', visible: true, ancho: 130 },
    { id: 'responsable', visible: true, ancho: 150 },
    { id: 'contenido', visible: true, ancho: 420 },
  ])
  const [panelCols, setPanelCols] = useState(false)

  async function recargar() {
    setCargando(true)
    try {
      setNotas(await cargarNotasProyecto(proyectoId))
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar las notas.')
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    recargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proyectoId])

  useEffect(() => {
    usuarioActualId().then(setMiId).catch(() => setMiId(null))
  }, [])

  // Solo el autor edita o borra su nota.
  function esAutor(n: NotaProyecto): boolean {
    return miId != null && n.creado_por === miId
  }

  function abrirNueva() {
    setEditor({ nota: null })
    setTexto('')
    setErrorEditor(null)
  }
  function abrirEditar(n: NotaProyecto) {
    setEditor({ nota: n })
    setTexto(n.contenido)
    setErrorEditor(null)
  }

  async function guardar() {
    if (!editor || texto.trim() === '') return
    setGuardando(true)
    const r = editor.nota
      ? await actualizarNotaProyecto(editor.nota.id, texto)
      : await crearNotaProyecto(proyectoId, texto)
    setGuardando(false)
    if (r.error) {
      setErrorEditor(r.error)
      return
    }
    setEditor(null)
    recargar()
  }

  async function hacerBorrar() {
    if (!borrar) return
    const { error: err } = await eliminarNotaProyecto(borrar.id)
    setBorrar(null)
    if (err) {
      setAviso(err)
      return
    }
    recargar()
  }

  const cols: ColumnaDef<NotaProyecto>[] = useMemo(
    () => [
      {
        id: 'creacion',
        titulo: 'Creación',
        tipo: 'fecha',
        valor: (n) => n.created_at,
        render: (n) => fmtFechaHora(n.created_at),
      },
      {
        id: 'modificacion',
        titulo: 'Modificación',
        tipo: 'fecha',
        valor: (n) => n.actualizado_en,
        render: (n) => fmtFechaHora(n.actualizado_en),
      },
      { id: 'responsable', titulo: 'Responsable', tipo: 'texto', valor: (n) => n.creado_por_nombre },
      {
        id: 'contenido',
        titulo: 'Contenido',
        tipo: 'texto',
        valor: (n) => n.contenido,
        render: (n) => unaLinea(n.contenido),
      },
    ],
    [],
  )

  const cuerpo = (
    <>
      <MenuContextual
        items={[
          { label: 'Nueva nota', onSelect: abrirNueva },
          { label: 'Columnas…', onSelect: () => setPanelCols(true) },
        ]}
      >
        {cargando ? (
          <div className="empresas-estado">Cargando notas…</div>
        ) : error ? (
          <div className="empresas-estado">{error}</div>
        ) : notas.length === 0 ? (
          <p className="empresas-vacio">Este proyecto no tiene notas.</p>
        ) : (
          <TablaConfigurable<NotaProyecto>
            columnas={cols}
            config={configCols}
            onConfig={setConfigCols}
            filas={notas}
            orden={orden}
            onOrden={setOrden}
            filaKey={(n) => n.id}
            onFilaDobleClick={(n) => setVerNota(n)}
            anchoAcciones={190}
            acciones={(n) => {
              const mia = esAutor(n)
              const motivo = mia ? undefined : 'Solo el autor puede modificar esta nota'
              return (
                <>
                  <button type="button" className="empresas-editar" onClick={() => setVerNota(n)}>
                    Ver
                  </button>
                  <button
                    type="button"
                    className="empresas-editar"
                    disabled={!mia}
                    title={motivo}
                    onClick={() => abrirEditar(n)}
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    className="empresas-borrar"
                    disabled={!mia}
                    title={motivo}
                    onClick={() => setBorrar(n)}
                  >
                    Borrar
                  </button>
                </>
              )
            }}
          />
        )}
      </MenuContextual>

      {/* Ver: texto completo de la nota */}
      {verNota && (
        <Modal titulo="Nota del proyecto" onCerrar={() => setVerNota(null)} ancho={620}>
          <div className="nota-meta">
            <b>{verNota.creado_por_nombre ?? '(sin autor)'}</b>
            <span>·</span>
            <span>Creada el {fmtFechaHora(verNota.created_at)}</span>
            {verNota.actualizado_en ? (
              <>
                <span>·</span>
                <span>
                  Modificada el {fmtFechaHora(verNota.actualizado_en)}
                  {verNota.actualizado_por_nombre ? ` por ${verNota.actualizado_por_nombre}` : ''}
                </span>
              </>
            ) : null}
          </div>
          <div className="nota-texto">{verNota.contenido}</div>
          <div className="pf-acciones">
            <button type="button" className="empresa-boton-secundario" onClick={() => setVerNota(null)}>
              Cerrar
            </button>
            {esAutor(verNota) && (
              <button
                type="button"
                className="empresa-boton"
                onClick={() => {
                  const n = verNota
                  setVerNota(null)
                  abrirEditar(n)
                }}
              >
                Editar
              </button>
            )}
          </div>
        </Modal>
      )}

      {/* Nueva / editar nota */}
      {editor && (
        <Modal
          titulo={editor.nota ? 'Editar nota' : 'Nueva nota'}
          onCerrar={() => (guardando ? undefined : setEditor(null))}
          ancho={620}
        >
          <label className="empresa-campo">
            Contenido
            <textarea
              className="empresa-input"
              rows={8}
              autoFocus
              placeholder="Escribí la nota para este proyecto…"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
            />
          </label>
          {errorEditor && <p className="empresa-form-error">{errorEditor}</p>}
          <div className="pf-acciones">
            <button
              type="button"
              className="empresa-boton-secundario"
              disabled={guardando}
              onClick={() => setEditor(null)}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="empresa-boton"
              disabled={guardando || texto.trim() === ''}
              onClick={guardar}
            >
              {guardando ? 'Guardando…' : editor.nota ? 'Guardar cambios' : 'Agregar nota'}
            </button>
          </div>
        </Modal>
      )}

      {borrar && (
        <ModalConfirmar
          titulo="Borrar nota"
          mensaje="¿Borrar esta nota? No se puede deshacer."
          textoConfirmar="Borrar"
          peligroso
          onConfirmar={hacerBorrar}
          onCancelar={() => setBorrar(null)}
        />
      )}

      {aviso && (
        <ModalConfirmar
          titulo="Aviso"
          mensaje={aviso}
          soloAceptar
          textoConfirmar="Entendido"
          onConfirmar={() => setAviso(null)}
          onCancelar={() => setAviso(null)}
        />
      )}

      {panelCols && (
        <PanelColumnas
          columnas={cols}
          config={configCols}
          onConfig={setConfigCols}
          onCerrar={() => setPanelCols(false)}
        />
      )}
    </>
  )

  if (!seccion) return <div className="subtabla">{cuerpo}</div>

  // Bloque de la vista del proyecto: mismo recuadro y misma cabecera que el
  // sistema viejo (título a la izquierda y el botón blanco al lado).
  return (
    <div className="notas-seccion">
      <div className="notas-seccion-cab">
        <div className="notas-seccion-tit">Notas del proyecto</div>
        <button type="button" className="empresa-boton-secundario" onClick={abrirNueva}>
          + Nueva nota
        </button>
      </div>
      <div className="subtabla">{cuerpo}</div>
    </div>
  )
}

export default NotasProyecto
