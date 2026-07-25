import { supabase } from '../../shared/lib/supabaseClient'

// -----------------------------------------------------------------------------
// "Copiar mail": arma el resumen del proyecto en HTML (y texto plano de
// respaldo) y lo copia al portapapeles para pegar en Gmail. Replica el mail del
// sistema viejo: Información General, Procesos aproximados y Fotos.
//
// Nota sobre el árbol nuevo: antes "ítem" y sus conjuntos/subconjuntos eran
// tablas distintas; ahora son todos elementos. Acá cada ELEMENTO RAÍZ es un
// "ítem", y sus procesos aproximados son los de TODO su subárbol (el ítem más
// sus conjuntos/componentes).
// -----------------------------------------------------------------------------

function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function fmt(d: string | null | undefined): string {
  if (!d) return ''
  const [y, m, da] = d.split('-')
  return da && m && y ? `${da}/${m}/${y}` : d
}

type El = {
  id: number
  parent_elemento_id: number | null
  descripcion: string
  cantidad: number
  foto_url: string | null
}
type Proc = { elemento_id: number; nombre: string; orden: number }

// Nombres de procesos de un subárbol (raíz + descendientes), en orden de árbol
// y, dentro de cada elemento, por 'orden'.
function procesosDeSubarbol(raiz: number, hijosDe: Map<number, El[]>, procsDe: Map<number, Proc[]>): string[] {
  const out: string[] = []
  const visitar = (id: number) => {
    for (const p of procsDe.get(id) ?? []) out.push(p.nombre)
    for (const h of hijosDe.get(id) ?? []) visitar(h.id)
  }
  visitar(raiz)
  return out
}

// Lista de procesos con numeración cuando un mismo nombre se repite
// (Fresado 1, Fresado 2). Si aparece una sola vez, va sin número.
function conNumeracion(nombres: string[]): string[] {
  const total: Record<string, number> = {}
  for (const n of nombres) total[n] = (total[n] ?? 0) + 1
  const cnt: Record<string, number> = {}
  return nombres.map((n) => {
    cnt[n] = (cnt[n] ?? 0) + 1
    return total[n] > 1 ? `${n} ${cnt[n]}` : n
  })
}

export async function copiarMailProyecto(proyectoId: number): Promise<{ ok?: boolean; error?: string }> {
  try {
    const { data: proy, error: eP } = await supabase
      .from('proyectos')
      .select(
        'id, descripcion, estado, paso_por_solicitud, fecha_limite_cotizar, pedido_nro, fecha_entrega, observaciones_mail, foto_url, empresa_id, contacto_id',
      )
      .eq('id', proyectoId)
      .single()
    if (eP || !proy) return { error: eP?.message ?? 'Proyecto no encontrado.' }

    const [empRes, contRes, elemsRes, tiposRes] = await Promise.all([
      supabase.from('empresas').select('nombre').eq('id', proy.empresa_id).maybeSingle(),
      proy.contacto_id
        ? supabase.from('empresa_contactos').select('nombre, apellido').eq('id', proy.contacto_id).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase
        .from('elementos')
        .select('id, parent_elemento_id, descripcion, cantidad, foto_url')
        .eq('proyecto_id', proyectoId)
        .order('id'),
      supabase.from('tipos_proceso').select('id, nombre'),
    ])

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cliente = (empRes.data as any)?.nombre ?? ''
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const c = contRes.data as any
    const contacto = c ? [c.nombre, c.apellido].filter(Boolean).join(' ') : ''

    const elementos = (elemsRes.data ?? []) as El[]
    const raices = elementos.filter((e) => e.parent_elemento_id == null)
    const hijosDe = new Map<number, El[]>()
    for (const e of elementos) {
      if (e.parent_elemento_id != null) {
        const arr = hijosDe.get(e.parent_elemento_id) ?? []
        arr.push(e)
        hijosDe.set(e.parent_elemento_id, arr)
      }
    }

    // Nombre de proceso: tipos_proceso.nombre ?? proceso_otro.
    const tipos = new Map<number, string>()
    for (const t of (tiposRes.data ?? []) as { id: number; nombre: string }[]) tipos.set(t.id, t.nombre)
    const procsDe = new Map<number, Proc[]>()
    if (elementos.length) {
      const { data: procs, error: ePr } = await supabase
        .from('procesos')
        .select('elemento_id, tipo_proceso_id, proceso_otro, orden')
        .in('elemento_id', elementos.map((e) => e.id))
        .eq('proceso_eliminado', false)
        .order('orden', { ascending: true, nullsFirst: false })
      if (ePr) return { error: ePr.message }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const p of (procs ?? []) as any[]) {
        const nombre = (p.tipo_proceso_id ? tipos.get(p.tipo_proceso_id) : '') || p.proceso_otro || ''
        if (!nombre) continue
        const arr = procsDe.get(p.elemento_id) ?? []
        arr.push({ elemento_id: p.elemento_id, nombre, orden: Number(p.orden ?? 0) })
        procsDe.set(p.elemento_id, arr)
      }
    }

    // Cotizar / Fecha de cotización (misma regla que el viejo).
    let cotizar: string
    if (proy.estado === 'Solicitud') cotizar = 'Sí'
    else if (!proy.paso_por_solicitud) cotizar = 'No'
    else cotizar = ''
    let fechaCotizar: string
    if (proy.fecha_limite_cotizar) fechaCotizar = fmt(proy.fecha_limite_cotizar)
    else if (!proy.paso_por_solicitud) fechaCotizar = '-'
    else fechaCotizar = ''

    // ── HTML ──
    const sect = (t: string) => `<p style="margin:0 0 4px 0"><b><u>${esc(t)}</u></b></p>`
    const line = (lbl: string, val: string, valStyle?: string) =>
      `<p style="margin:0"><b>${esc(lbl)}:</b>${val ? ' ' + (valStyle ? `<span style="${valStyle}">${esc(val)}</span>` : esc(val)) : ''}</p>`

    let html = '<div style="font-family:Arial,sans-serif;font-size:13px;color:#000;line-height:1.45">'
    html += sect('Información General')
    html += line('Cliente', cliente)
    html += line('Nombre de Contacto', contacto)
    html += line('Descripción', proy.descripcion || '')
    if (raices.length === 1) {
      html += line('Cantidad', String(raices[0].cantidad ?? ''))
    } else if (raices.length > 1) {
      let lista = ''
      for (const it of raices) {
        const desc = (it.descripcion || '').trim() || '(sin descripción)'
        lista += `<div style="margin-left:8px">• ${esc(desc).replace(/\n/g, '<br>')}: <b>${esc(String(it.cantidad ?? '?'))}</b></div>`
      }
      html += `<p style="margin:6px 0 2px 0"><b>Cantidad:</b></p>${lista}`
    } else {
      html += line('Cantidad', '')
    }
    html += line('Cotizar', cotizar)
    html += line('Fecha de Cotización', fechaCotizar)
    if (proy.pedido_nro) {
      html += `<p style="margin:0"><b>Cargar Pedido:</b> ya cargado. <span style="color:rgb(0,0,255);font-weight:700;font-size:1.175em">Pedido ${esc(String(proy.pedido_nro))}</span></p>`
    } else {
      html += line('Cargar Pedido', 'Sí')
    }
    html += line('Fecha de Entrega', fmt(proy.fecha_entrega), 'color:#E53935;font-weight:600')
    html += line('Teléfono o mail de Contacto (si se cree relevante)', '')
    if (proy.observaciones_mail && String(proy.observaciones_mail).trim()) {
      html += '<p style="margin:0"><b>Observaciones:</b></p>'
      const obs = String(proy.observaciones_mail)
      const esHtml = /[<>]/.test(obs)
      html += `<div style="margin:0">${esHtml ? obs : esc(obs).replace(/\n/g, '<br>')}</div>`
    } else {
      html += line('Observaciones', '')
    }
    html += '<p style="margin:10px 0 0 0">&nbsp;</p>'

    html += sect('Procesos aproximados')
    html += '<ul style="margin:6px 0 0 0;padding-left:24px">'
    for (const it of raices) {
      const nombres = conNumeracion(procesosDeSubarbol(it.id, hijosDe, procsDe))
      const cant = it.cantidad ? ` (Cant.: ${it.cantidad})` : ''
      html += `<li style="margin-bottom:2px"><b>${esc((it.descripcion || '').toUpperCase()).replace(/\n/g, '<br>')}</b>${esc(cant)}`
      if (nombres.length) {
        html += '<ul style="margin:2px 0 4px 0;padding-left:24px">'
        for (const n of nombres) html += `<li>${esc(n)}</li>`
        html += '</ul>'
      }
      html += '</li>'
    }
    html += '</ul>'
    html += '<p style="margin:10px 0 0 0">&nbsp;</p>'

    const conFoto = raices.filter((e) => e.foto_url)
    if (proy.foto_url || conFoto.length) {
      html += sect('Fotos (si hay)')
      let idx = 1
      if (proy.foto_url) {
        html += '<p style="margin:6px 0 2px 0">Foto general del proyecto</p>'
        html += `<p style="margin:0 0 12px 0"><img src="${esc(proy.foto_url)}" style="max-width:420px;height:auto;display:block;border:1px solid #ddd"></p>`
      }
      for (const it of conFoto) {
        html += `<p style="margin:6px 0 2px 0">Foto ${idx}: ${esc(it.descripcion || '')}</p>`
        html += `<p style="margin:0 0 12px 0"><img src="${esc(it.foto_url)}" style="max-width:420px;height:auto;display:block;border:1px solid #ddd"></p>`
        idx++
      }
    }
    html += '</div>'

    // ── Texto plano de respaldo ──
    let plain = 'Información General\n'
    plain += `Cliente: ${cliente}\n`
    plain += `Nombre de Contacto: ${contacto}\n`
    plain += `Descripción: ${proy.descripcion || ''}\n`
    plain += `Cotizar: ${cotizar}\n`
    plain += `Fecha de Cotización: ${fechaCotizar}\n`
    plain += proy.pedido_nro ? `Cargar Pedido: ya cargado. Pedido ${proy.pedido_nro}\n` : 'Cargar Pedido: Sí\n'
    plain += `Fecha de Entrega: ${fmt(proy.fecha_entrega)}\n`
    plain += '\nProcesos aproximados:\n'
    for (const it of raices) {
      const nombres = conNumeracion(procesosDeSubarbol(it.id, hijosDe, procsDe))
      plain += `* ${(it.descripcion || '').toUpperCase()}${it.cantidad ? ` (Cant.: ${it.cantidad})` : ''}\n`
      for (const n of nombres) plain += `   - ${n}\n`
    }

    // ── Copiar ──
    if (navigator.clipboard && 'ClipboardItem' in window) {
      const item = new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([plain], { type: 'text/plain' }),
      })
      await navigator.clipboard.write([item])
    } else {
      await navigator.clipboard.writeText(plain)
    }
    return { ok: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}
