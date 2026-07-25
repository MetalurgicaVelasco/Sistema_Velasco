import { supabase } from '../../shared/lib/supabaseClient'

// -----------------------------------------------------------------------------
// Duplica un proyecto entero: copia el árbol de elementos, sus procesos y las
// correlatividades. El duplicado es idéntico en CONTENIDO, con nuevo Nº de
// proyecto y sin número de pedido; se resetea el AVANCE (estado del proyecto y
// de los elementos, y la planificación / marcas de "hecho" de los procesos),
// omitiendo esas columnas para que tomen el default de la base.
//
// No es transaccional (son varios inserts): si algo falla a mitad, puede quedar
// un proyecto a medio copiar. A la escala de uso es aceptable; si hiciera falta,
// se puede pasar a una función RPC atómica.
// -----------------------------------------------------------------------------

type Fila = Record<string, unknown>

export async function duplicarProyecto(proyectoId: number): Promise<{ nuevoId?: number; error?: string }> {
  try {
    // 1) Proyecto. Se omiten las columnas de avance para que tomen su default:
    //    estado → 'Proyectando', paso_por_solicitud → false, etc. Pedido en null.
    const { data: proy, error: e1 } = await supabase
      .from('proyectos')
      .select('*')
      .eq('id', proyectoId)
      .single()
    if (e1 || !proy) return { error: e1?.message ?? 'Proyecto no encontrado.' }
    const nuevoProy: Fila = { ...(proy as Fila) }
    delete nuevoProy.id
    delete nuevoProy.created_at
    delete nuevoProy.estado
    delete nuevoProy.sub_estado_cerrado
    delete nuevoProy.paso_por_solicitud
    delete nuevoProy.observaciones_anulacion
    nuevoProy.pedido_nro = null
    const { data: creado, error: e2 } = await supabase
      .from('proyectos')
      .insert(nuevoProy)
      .select('id')
      .single()
    if (e2 || !creado) return { error: e2?.message ?? 'No se pudo crear el proyecto.' }
    const nuevoId = creado.id as number

    // 2) Elementos (árbol). Se copian en orden de jerarquía (padres antes que
    //    hijos) para remapear parent_elemento_id sobre la marcha.
    const { data: elems, error: e3 } = await supabase
      .from('elementos')
      .select('*')
      .eq('proyecto_id', proyectoId)
    if (e3) return { error: e3.message }
    const lista = (elems ?? []) as Fila[]
    const hijosDe = new Map<number | null, Fila[]>()
    for (const el of lista) {
      const p = (el.parent_elemento_id as number | null) ?? null
      const arr = hijosDe.get(p) ?? []
      arr.push(el)
      hijosDe.set(p, arr)
    }
    const mapEl = new Map<number, number>()
    async function copiarNivel(padreViejo: number | null, padreNuevo: number | null): Promise<void> {
      for (const el of hijosDe.get(padreViejo) ?? []) {
        const viejoId = el.id as number
        const nuevo: Fila = { ...el }
        delete nuevo.id
        delete nuevo.created_at
        delete nuevo.estado // → default 'Espera MP'
        delete nuevo.observaciones_anulacion
        nuevo.proyecto_id = nuevoId
        nuevo.parent_elemento_id = padreNuevo
        const { data: elNuevo, error } = await supabase
          .from('elementos')
          .insert(nuevo)
          .select('id')
          .single()
        if (error || !elNuevo) throw new Error(error?.message ?? 'Error copiando un elemento.')
        const nuevoElId = elNuevo.id as number
        mapEl.set(viejoId, nuevoElId)
        await copiarNivel(viejoId, nuevoElId)
      }
    }
    await copiarNivel(null, null)

    // 3) Procesos (sin los eliminados). Se resetea la planificación y lo real, y
    //    el estado se omite (→ default 'sin_planificar').
    const viejoElIds = lista.map((e) => e.id as number)
    const mapProc = new Map<number, number>()
    if (viejoElIds.length) {
      const { data: procs, error: e4 } = await supabase
        .from('procesos')
        .select('*')
        .in('elemento_id', viejoElIds)
        .eq('proceso_eliminado', false)
      if (e4) return { error: e4.message }
      for (const pr of (procs ?? []) as Fila[]) {
        const viejoId = pr.id as number
        const nuevo: Fila = { ...pr }
        delete nuevo.id
        delete nuevo.created_at
        delete nuevo.estado // → default 'sin_planificar'
        nuevo.elemento_id = mapEl.get(pr.elemento_id as number)
        nuevo.plan_fecha = null
        nuevo.plan_hora = null
        nuevo.plan_operario_id = null
        nuevo.plan_maquina_id = null
        nuevo.plan_aceptado = null
        nuevo.real_fecha_inicio = null
        nuevo.real_hora_inicio = null
        nuevo.real_fecha_fin = null
        nuevo.real_hora_fin = null
        nuevo.grupo_division_id = null
        const { data: prNuevo, error } = await supabase
          .from('procesos')
          .insert(nuevo)
          .select('id')
          .single()
        if (error || !prNuevo) throw new Error(error?.message ?? 'Error copiando un proceso.')
        mapProc.set(viejoId, prNuevo.id as number)
      }
    }

    // 4) Correlatividades: solo las que unen dos procesos ya copiados.
    const viejoProcIds = [...mapProc.keys()]
    if (viejoProcIds.length) {
      const { data: corrs, error: e5 } = await supabase
        .from('correlatividades')
        .select('predecesor_id, sucesor_id')
        .in('sucesor_id', viejoProcIds)
      if (e5) return { error: e5.message }
      const nuevas = (corrs ?? [])
        .filter(
          (c) => mapProc.has(c.predecesor_id as number) && mapProc.has(c.sucesor_id as number),
        )
        .map((c) => ({
          predecesor_id: mapProc.get(c.predecesor_id as number),
          sucesor_id: mapProc.get(c.sucesor_id as number),
        }))
      if (nuevas.length) {
        const { error } = await supabase.from('correlatividades').insert(nuevas)
        if (error) return { error: error.message }
      }
    }

    return { nuevoId }
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}
