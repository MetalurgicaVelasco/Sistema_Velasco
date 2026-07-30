import { supabase } from '../../shared/lib/supabaseClient'

// -----------------------------------------------------------------------------
// Etiqueta de envío: se imprime, no se guarda. Replica la del sistema viejo
// (media hoja A4: logo, caja con los datos del destinatario y, al pie, la caja
// con los documentos).
// -----------------------------------------------------------------------------

// El logo vive en public/, no incrustado en el código: son ~46 KB que no tienen
// por qué viajar en el bundle.
const LOGO_URL = '/logo-velasco.png'

export type DatosEtiqueta = {
  destinatario: string
  direccion: string
  cp: string
  telefono: string
  ordenes: string[]
  remitos: string[]
  notas: string[]
}

// Supabase tipa las relaciones to-one como array; en runtime viene objeto.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function uno(v: any) {
  return Array.isArray(v) ? v[0] : v
}

export async function cargarDatosEtiqueta(proyectoId: number): Promise<DatosEtiqueta> {
  const { data: proy, error } = await supabase
    .from('proyectos')
    .select('id, empresa_id, contacto_id, oc_cliente')
    .eq('id', proyectoId)
    .single()
  if (error || !proy) throw new Error(error?.message ?? 'Proyecto no encontrado.')

  const [empRes, contRes, dirRes, notasRes, remitosRes] = await Promise.all([
    supabase.from('empresas').select('nombre').eq('id', proy.empresa_id).maybeSingle(),
    proy.contacto_id
      ? supabase
          .from('empresa_contactos')
          .select('nombre, apellido, telefono, celular')
          .eq('id', proy.contacto_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from('empresa_direcciones')
      .select('tipo, calle, numero, localidades ( nombre, codigo_postal )')
      .eq('empresa_id', proy.empresa_id),
    supabase.from('notas_envio').select('numero, numero_impreso').eq('proyecto_id', proyectoId),
    supabase.from('remitos').select('numero').eq('proyecto_id', proyectoId),
  ])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const emp = empRes.data as any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cont = contRes.data as any
  const contactoNombre = cont ? [cont.nombre, cont.apellido].filter(Boolean).join(' ') : ''

  // Dirección: la de entrega si está marcada así; si no, la primera cargada.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dirs = (dirRes.data ?? []) as any[]
  const dir = dirs.find((d) => (d.tipo ?? '').toLowerCase().includes('entrega')) ?? dirs[0] ?? null
  const loc = dir ? uno(dir.localidades) : null
  const direccion = dir
    ? [[dir.calle, dir.numero].filter(Boolean).join(' '), loc?.nombre].filter(Boolean).join(', ')
    : ''

  // En las notas se usa el número IMPRESO (el que figura en el papel); el
  // correlativo interno queda de respaldo.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const notas = ((notasRes.data ?? []) as any[])
    .map((n) => n.numero_impreso || n.numero)
    .filter(Boolean) as string[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const remitos = ((remitosRes.data ?? []) as any[]).map((r) => r.numero).filter(Boolean) as string[]

  return {
    destinatario: (emp?.nombre ?? '') + (contactoNombre ? ` (${contactoNombre})` : ''),
    direccion,
    cp: loc?.codigo_postal ?? '',
    telefono: cont?.telefono || cont?.celular || '',
    ordenes: proy.oc_cliente ? [String(proy.oc_cliente)] : [''],
    remitos: remitos.length ? remitos : [''],
    notas: notas.length ? notas : [''],
  }
}

function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function construirHtml(d: DatosEtiqueta, logoUrl: string): string {
  const lista = (arr: string[]) => (arr.length ? arr.map(esc).join(' · ') : '-')
  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<title>Etiqueta de envío</title>
<style>
@page { size: A4; margin: 0; }
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body {
  font-family: Arial, Helvetica, sans-serif; color: #000;
  -webkit-print-color-adjust: exact; print-color-adjust: exact;
}
/* La etiqueta ocupa la mitad superior de una hoja A4 (297mm / 2). */
.etq-hoja {
  width: 210mm; height: 148.5mm;
  padding: 13mm 14mm;
  display: flex; flex-direction: column;
}
.etq-logo { text-align: center; margin-bottom: 8px; flex: 0 0 auto; }
.etq-logo img { height: 78px; width: auto; }
/* Caja de datos: crece para llenar la media hoja. */
.etq-caja {
  border: 2.6px solid #000;
  padding: 14px 22px;
  flex: 1 1 auto;
  display: flex; flex-direction: column; justify-content: space-around;
}
.etq-linea { font-size: 20px; line-height: 1.3; }
.etq-linea .etq-lbl { font-weight: 700; }
/* Caja de documentos: altura natural, al pie de la etiqueta. */
.etq-caja-doc {
  border: 2.6px solid #000; border-top: none;
  padding: 10px 22px;
  flex: 0 0 auto;
}
.etq-doc { font-size: 13px; margin: 4px 0; line-height: 1.35; }
.etq-doc .etq-lbl { font-weight: 700; }
.etq-doc-row { display: flex; gap: 28px; flex-wrap: wrap; }
</style></head><body>

<div class="etq-hoja">
  <div class="etq-logo"><img src="${esc(logoUrl)}" alt="Metalúrgica Velasco"></div>

  <div class="etq-caja">
    <div class="etq-linea"><span class="etq-lbl">DESTINATARIO</span>: ${esc(d.destinatario)}</div>
    <div class="etq-linea"><span class="etq-lbl">DIRECCIÓN</span>: ${esc(d.direccion)}</div>
    <div class="etq-linea"><span class="etq-lbl">CÓDIGO POSTAL</span>: ${esc(d.cp)}</div>
    <div class="etq-linea"><span class="etq-lbl">TELÉFONO</span>: ${esc(d.telefono)}</div>
  </div>

  <div class="etq-caja-doc">
    <div class="etq-doc"><span class="etq-lbl">ORDEN DE COMPRA</span>: ${lista(d.ordenes)}</div>
    <div class="etq-doc-row">
      <div class="etq-doc"><span class="etq-lbl">REMITO</span>: ${lista(d.remitos)}</div>
      <div class="etq-doc"><span class="etq-lbl">NOTA DE ENVÍO</span>: ${lista(d.notas)}</div>
    </div>
  </div>
</div>

<script>
  // Se espera a que cargue el logo para que no salga en blanco al imprimir.
  window.addEventListener('load', function () { setTimeout(function () { window.print() }, 250) })
</script>
</body></html>`
}

export function imprimirEtiqueta(d: DatosEtiqueta): { error?: string } {
  const limpiar = (arr: string[]) => arr.map((s) => (s || '').trim()).filter(Boolean)
  const datos: DatosEtiqueta = {
    destinatario: d.destinatario.trim(),
    direccion: d.direccion.trim(),
    cp: d.cp.trim(),
    telefono: d.telefono.trim(),
    ordenes: limpiar(d.ordenes),
    remitos: limpiar(d.remitos),
    notas: limpiar(d.notas),
  }
  const v = window.open('', '_blank')
  if (!v) return { error: 'El navegador bloqueó la ventana. Permití las ventanas emergentes para imprimir la etiqueta.' }
  // La ventana nueva arranca en about:blank, así que el logo va con URL absoluta.
  v.document.open()
  v.document.write(construirHtml(datos, window.location.origin + LOGO_URL))
  v.document.close()
  return {}
}
