import { supabase } from '../../shared/lib/supabaseClient'

// -----------------------------------------------------------------------------
// "Carpeta" digital de un ítem: lo mismo que hoy reciben impreso desde Generar
// Carpeta. Portada con los datos del trabajo + la lista de procesos, y después
// una orden de trabajo por proceso.
//
// Es SOLO LECTURA: el operario la consulta para tener el contexto completo de la
// pieza, pero no puede operar sobre otro proceso desde acá.
// -----------------------------------------------------------------------------

export type PortadaCarpeta = {
  cliente: string
  proyecto: string
  item: string
  pedidoNro: string | null
  contacto: string | null
  telefono: string | null
  cantidad: number
  material: string | null
  formaMp: string | null
  fechaIngreso: string | null
  fechaFinEstipulada: string | null
  urgencia: string
  fotoItem: string | null
}

export type ProcesoCarpeta = {
  id: number
  numero: number // posición en la carpeta (1, 2, 3…)
  proceso: string
  responsable: string | null // el operario PLANIFICADO
  suplentes: string[] // quienes también pueden hacerlo (van en gris)
  hecho: boolean
  porOperario: boolean // terminado por el operario, todavía sin cerrar
  detalleTrabajo: string | null
  maquina: string | null
  minutosEstimados: number
  planFecha: string | null
  // Lo que cargó quien lo hizo: es la información más útil para el que sigue.
  materialUtilizado: string | null
  observacionesOperario: string | null
}

export type Carpeta = {
  portada: PortadaCarpeta
  procesos: ProcesoCarpeta[]
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function uno(v: any) {
  return Array.isArray(v) ? v[0] : v
}

export async function cargarCarpeta(elementoId: number): Promise<Carpeta> {
  const { data: el, error } = await supabase
    .from('elementos')
    .select(
      `id, descripcion, cantidad, presentacion_mat_prima, fecha_fin_estipulada, foto_url,
       material:materiales!material_id ( nombre ),
       proyecto:proyectos!proyecto_id (
         id, descripcion, pedido_nro, urgencia, fecha_ingreso, cliente_final_texto,
         empresa:empresas!empresa_id ( nombre ),
         clienteFinal:empresas!cliente_final_empresa_id ( nombre ),
         contacto:empresa_contactos!contacto_id ( nombre, apellido, telefono, celular )
       )`,
    )
    .eq('id', elementoId)
    .single()
  if (error || !el) throw new Error(error?.message ?? 'No se encontró el ítem.')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const e = el as any
  const proy = uno(e.proyecto)
  const emp = proy ? uno(proy.empresa) : null
  const cf = proy ? uno(proy.clienteFinal) : null
  const cont = proy ? uno(proy.contacto) : null

  // "Cliente (para Cliente Final)", igual que en la carpeta impresa.
  const finalNombre = cf?.nombre ?? proy?.cliente_final_texto ?? null
  const cliente = (emp?.nombre ?? '—') + (finalNombre ? ` (para ${finalNombre})` : '')

  const { data: procs, error: e2 } = await supabase
    .from('procesos')
    .select(
      `id, orden, proceso_otro, estado, detalle_trabajo, maquina_otra,
       setup_min, operacion_min, margen_min, plan_fecha,
       material_utilizado, observaciones_operario,
       tipo_proceso_id, plan_maquina_id, plan_operario_id,
       tipo:tipos_proceso!tipo_proceso_id ( nombre ),
       maquina:maquinas!plan_maquina_id ( nombre ),
       planOperario:personal!plan_operario_id ( nombre, apellido )`,
    )
    .eq('elemento_id', elementoId)
    .eq('proceso_eliminado', false)
    .order('orden')
  if (e2) throw new Error(e2.message)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const filas = (procs ?? []) as any[]

  // Suplentes: quienes además del planificado pueden hacer el proceso. Salen de
  // la máquina (si el proceso lleva máquina) o del tipo de proceso (si no).
  const maqIds = [...new Set(filas.map((p) => p.plan_maquina_id).filter(Boolean))] as number[]
  const tipoIds = [...new Set(filas.map((p) => p.tipo_proceso_id).filter(Boolean))] as number[]
  const [personasRes, maqPersRes, tipoPersRes] = await Promise.all([
    supabase.from('personal').select('id, nombre, apellido'),
    maqIds.length
      ? supabase.from('maquina_personal').select('maquina_id, personal_id, rol').in('maquina_id', maqIds)
      : Promise.resolve({ data: [] }),
    tipoIds.length
      ? supabase
          .from('tipo_proceso_personal')
          .select('tipo_proceso_id, personal_id, rol')
          .in('tipo_proceso_id', tipoIds)
      : Promise.resolve({ data: [] }),
  ])
  const nombrePersona = new Map<number, string>()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const r of ((personasRes.data ?? []) as any[])) {
    nombrePersona.set(r.id, [r.nombre, r.apellido].filter(Boolean).join(' '))
  }
  const porMaquina = new Map<number, number[]>()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const r of ((maqPersRes.data ?? []) as any[])) {
    const arr = porMaquina.get(r.maquina_id) ?? []
    arr.push(r.personal_id)
    porMaquina.set(r.maquina_id, arr)
  }
  const porTipo = new Map<number, number[]>()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const r of ((tipoPersRes.data ?? []) as any[])) {
    const arr = porTipo.get(r.tipo_proceso_id) ?? []
    arr.push(r.personal_id)
    porTipo.set(r.tipo_proceso_id, arr)
  }

  const procesos: ProcesoCarpeta[] = filas.map((p, i) => {
    const op = uno(p.planOperario)
    // El planificado no se repite entre los suplentes.
    const candidatos = p.plan_maquina_id
      ? (porMaquina.get(p.plan_maquina_id) ?? [])
      : (porTipo.get(p.tipo_proceso_id) ?? [])
    const suplentes = candidatos
      .filter((id) => id !== p.plan_operario_id)
      .map((id) => nombrePersona.get(id))
      .filter((n): n is string => !!n)
    return {
      id: p.id,
      numero: i + 1,
      proceso: uno(p.tipo)?.nombre || p.proceso_otro || '(sin proceso)',
      // El responsable es el operario PLANIFICADO: es quien realmente lo hace.
      responsable: op ? [op.nombre, op.apellido].filter(Boolean).join(' ') : null,
      suplentes: [...new Set(suplentes)],
      hecho: p.estado === 'hecho' || p.estado === 'hecho_operario',
      porOperario: p.estado === 'hecho_operario',
      detalleTrabajo: p.detalle_trabajo ?? null,
      maquina: uno(p.maquina)?.nombre ?? p.maquina_otra ?? null,
      minutosEstimados:
        Number(p.setup_min ?? 0) + Number(p.operacion_min ?? 0) + Number(p.margen_min ?? 0),
      planFecha: p.plan_fecha ?? null,
      materialUtilizado: p.material_utilizado ?? null,
      observacionesOperario: p.observaciones_operario ?? null,
    }
  })

  return {
    portada: {
      cliente,
      proyecto: proy?.descripcion ?? '',
      item: e.descripcion ?? '',
      pedidoNro: proy?.pedido_nro ?? null,
      contacto: cont ? [cont.nombre, cont.apellido].filter(Boolean).join(' ') : null,
      telefono: cont?.telefono || cont?.celular || null,
      cantidad: Number(e.cantidad ?? 1),
      material: uno(e.material)?.nombre ?? null,
      formaMp: e.presentacion_mat_prima ?? null,
      fechaIngreso: proy?.fecha_ingreso ?? null,
      fechaFinEstipulada: e.fecha_fin_estipulada ?? null,
      urgencia: proy?.urgencia ?? 'media',
      fotoItem: e.foto_url ?? null,
    },
    procesos,
  }
}
