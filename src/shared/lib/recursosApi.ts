// Capa de datos de los recursos base (procesos, máquinas, personal).
// Única puerta a Supabase para este dominio: los componentes NO hacen queries
// sueltas, llaman a estas funciones. Así la UI queda limpia y las reglas de
// reconciliación de los cruces viven en un solo lugar.

import { supabase } from './supabaseClient'
import type {
  RecursosData,
  TipoProceso,
  Maquina,
  Personal,
} from '../types/recursos'

// Las fotos de máquina reutilizan el bucket de proyectos, bajo el prefijo
// "maquinas/" (mismo patrón que las fotos de item). foto_url guarda el path.
const BUCKET = 'proyectos-fotos'

// ---------------------------------------------------------------------------
// CARGA
// ---------------------------------------------------------------------------

// Carga las 3 tablas base + las 3 de cruce y arma el modelo en memoria con las
// relaciones ya resueltas. Personal: solo activos.
export async function cargarRecursos(): Promise<RecursosData> {
  const [tp, mq, pe, mtp, mp, tpp] = await Promise.all([
    supabase.from('tipos_proceso').select('*').order('orden').order('nombre'),
    supabase.from('maquinas').select('*').order('nombre'),
    supabase.from('personal').select('*').eq('activo', true).order('nombre'),
    supabase.from('maquina_tipos_proceso').select('*'),
    supabase.from('maquina_personal').select('*'),
    supabase.from('tipo_proceso_personal').select('*'),
  ])

  const primerError =
    tp.error || mq.error || pe.error || mtp.error || mp.error || tpp.error
  if (primerError) throw new Error(primerError.message)

  const cruceMaqTipo = mtp.data ?? []
  const cruceMaqPers = mp.data ?? []
  const cruceTipoPers = tpp.data ?? []

  const tiposProceso: TipoProceso[] = (tp.data ?? []).map((r) => ({
    id: r.id,
    nombre: r.nombre,
    llevaMaquina: r.lleva_maquina,
    orden: r.orden,
    operarioIdealId:
      cruceTipoPers.find(
        (c) => c.tipo_proceso_id === r.id && c.rol === 'ideal',
      )?.personal_id ?? null,
    suplenteIds: cruceTipoPers
      .filter((c) => c.tipo_proceso_id === r.id && c.rol === 'suplente')
      .map((c) => c.personal_id),
    maquinaIds: cruceMaqTipo
      .filter((c) => c.tipo_proceso_id === r.id)
      .map((c) => c.maquina_id),
  }))

  const maquinas: Maquina[] = (mq.data ?? []).map((r) => ({
    id: r.id,
    nombre: r.nombre,
    fotoUrl: r.foto_url,
    tipoProcesoIds: cruceMaqTipo
      .filter((c) => c.maquina_id === r.id)
      .map((c) => c.tipo_proceso_id),
    operarioIdealId:
      cruceMaqPers.find((c) => c.maquina_id === r.id && c.rol === 'ideal')
        ?.personal_id ?? null,
    suplenteIds: cruceMaqPers
      .filter((c) => c.maquina_id === r.id && c.rol === 'suplente')
      .map((c) => c.personal_id),
  }))

  const personal: Personal[] = (pe.data ?? []).map((r) => ({
    id: r.id,
    nombre: r.nombre,
    apellido: r.apellido,
    horarioEntrada: r.horario_entrada,
    horarioSalida: r.horario_salida,
    horarioSabadoInicio: r.horario_sabado_inicio,
    horarioSabadoFin: r.horario_sabado_fin,
    enTablero: r.en_tablero,
    colorBorde: r.color_borde,
    activo: r.activo,
  }))

  return { tiposProceso, maquinas, personal }
}

// ---------------------------------------------------------------------------
// TIPO DE PROCESO — guardar / eliminar
// ---------------------------------------------------------------------------

export type GuardarTipoProcesoInput = {
  id: number | null
  nombre: string
  llevaMaquina: boolean
  // Si NO lleva máquina:
  operarioIdealId: number | null
  suplenteIds: number[]
  // Si SÍ lleva máquina:
  maquinaIds: number[]
}

// Inserta o actualiza el tipo de proceso y reconcilia sus cruces. La estrategia
// de reconciliación es simple y segura para estos volúmenes: borra los cruces
// del tipo y reinserta el set deseado.
export async function guardarTipoProceso(
  input: GuardarTipoProcesoInput,
): Promise<{ error?: string }> {
  const base = {
    nombre: input.nombre.trim(),
    lleva_maquina: input.llevaMaquina,
  }

  let id = input.id
  if (id == null) {
    // orden = mayor actual + 10, para que quede al final de la lista.
    const { data: max } = await supabase
      .from('tipos_proceso')
      .select('orden')
      .order('orden', { ascending: false })
      .limit(1)
      .maybeSingle()
    const orden = (max?.orden ?? 0) + 10
    const { data, error } = await supabase
      .from('tipos_proceso')
      .insert({ ...base, orden })
      .select('id')
      .single()
    if (error) return { error: error.message }
    id = data.id
  } else {
    const { error } = await supabase
      .from('tipos_proceso')
      .update(base)
      .eq('id', id)
    if (error) return { error: error.message }
  }

  // A esta altura id siempre es un número; esta guarda además lo estrecha para
  // TypeScript al construir las filas de los cruces.
  if (id == null) return { error: 'No se pudo determinar el proceso guardado.' }

  // Cruce con máquinas: solo aplica si el proceso lleva máquina.
  const eMaq = await supabase
    .from('maquina_tipos_proceso')
    .delete()
    .eq('tipo_proceso_id', id)
  if (eMaq.error) return { error: eMaq.error.message }
  if (input.llevaMaquina && input.maquinaIds.length) {
    const filas = input.maquinaIds.map((maquina_id) => ({
      maquina_id,
      tipo_proceso_id: id,
    }))
    const { error } = await supabase
      .from('maquina_tipos_proceso')
      .insert(filas)
    if (error) return { error: error.message }
  }

  // Cruce con personal: solo aplica si el proceso NO lleva máquina.
  const ePers = await supabase
    .from('tipo_proceso_personal')
    .delete()
    .eq('tipo_proceso_id', id)
  if (ePers.error) return { error: ePers.error.message }
  if (!input.llevaMaquina) {
    const filas: { tipo_proceso_id: number; personal_id: number; rol: string }[] =
      []
    if (input.operarioIdealId != null) {
      filas.push({
        tipo_proceso_id: id,
        personal_id: input.operarioIdealId,
        rol: 'ideal',
      })
    }
    for (const pid of input.suplenteIds) {
      if (pid !== input.operarioIdealId) {
        filas.push({ tipo_proceso_id: id, personal_id: pid, rol: 'suplente' })
      }
    }
    if (filas.length) {
      const { error } = await supabase
        .from('tipo_proceso_personal')
        .insert(filas)
      if (error) return { error: error.message }
    }
  }

  return {}
}

// Elimina un tipo de proceso. Los cruces se borran solos por ON DELETE CASCADE.
export async function eliminarTipoProceso(
  id: number,
): Promise<{ error?: string }> {
  const { error } = await supabase.from('tipos_proceso').delete().eq('id', id)
  return error ? { error: error.message } : {}
}

// ---------------------------------------------------------------------------
// MÁQUINA — guardar
// ---------------------------------------------------------------------------

export type GuardarMaquinaInput = {
  id: number | null
  nombre: string
  fotoUrl: string | null // path existente que se conserva (o null si se quitó)
  fotoArchivo: File | null // foto nueva a subir (si hay)
  tipoProcesoIds: number[]
  operarioIdealId: number | null
  suplenteIds: number[]
}

// Inserta o actualiza la máquina, sube la foto si hay una nueva y reconcilia
// sus cruces (procesos que realiza + operarios ideal/suplente).
export async function guardarMaquina(
  input: GuardarMaquinaInput,
): Promise<{ error?: string }> {
  const base = { nombre: input.nombre.trim(), foto_url: input.fotoUrl }

  let id = input.id
  if (id == null) {
    const { data, error } = await supabase
      .from('maquinas')
      .insert(base)
      .select('id')
      .single()
    if (error) return { error: error.message }
    id = data.id
  } else {
    const { error } = await supabase.from('maquinas').update(base).eq('id', id)
    if (error) return { error: error.message }
  }
  if (id == null) return { error: 'No se pudo determinar la máquina guardada.' }

  // Foto nueva: subir a maquinas/{id}/... y guardar el path.
  if (input.fotoArchivo) {
    const ext =
      input.fotoArchivo.name.split('.').pop() ||
      input.fotoArchivo.type.split('/')[1] ||
      'png'
    const ruta = `maquinas/${id}/${Date.now()}.${ext}`
    const { error: eUp } = await supabase.storage
      .from(BUCKET)
      .upload(ruta, input.fotoArchivo, { upsert: true })
    if (!eUp) {
      await supabase.from('maquinas').update({ foto_url: ruta }).eq('id', id)
    }
  }

  // Cruce con procesos que realiza.
  const eMTP = await supabase
    .from('maquina_tipos_proceso')
    .delete()
    .eq('maquina_id', id)
  if (eMTP.error) return { error: eMTP.error.message }
  if (input.tipoProcesoIds.length) {
    const filas = input.tipoProcesoIds.map((tipo_proceso_id) => ({
      maquina_id: id,
      tipo_proceso_id,
    }))
    const { error } = await supabase
      .from('maquina_tipos_proceso')
      .insert(filas)
    if (error) return { error: error.message }
  }

  // Cruce con operarios (ideal + suplentes).
  const eMP = await supabase
    .from('maquina_personal')
    .delete()
    .eq('maquina_id', id)
  if (eMP.error) return { error: eMP.error.message }
  const filasP: { maquina_id: number; personal_id: number; rol: string }[] = []
  if (input.operarioIdealId != null) {
    filasP.push({
      maquina_id: id,
      personal_id: input.operarioIdealId,
      rol: 'ideal',
    })
  }
  for (const pid of input.suplenteIds) {
    if (pid !== input.operarioIdealId) {
      filasP.push({ maquina_id: id, personal_id: pid, rol: 'suplente' })
    }
  }
  if (filasP.length) {
    const { error } = await supabase.from('maquina_personal').insert(filasP)
    if (error) return { error: error.message }
  }

  return {}
}

// ---------------------------------------------------------------------------
// PERSONAL — guardar / inhabilitar
// ---------------------------------------------------------------------------

export type GuardarPersonalInput = {
  id: number | null
  nombre: string
  apellido: string | null
  horarioEntrada: string | null
  horarioSalida: string | null
  horarioSabadoInicio: string | null
  horarioSabadoFin: string | null
  enTablero: boolean
  colorBorde: string | null
  // Máquinas donde la persona es ideal / suplente (edición bidireccional).
  maquinasIdeal: number[]
  maquinasSuplente: number[]
  // Tipos de proceso SIN máquina que la persona "sabe hacer". Se guardan como
  // rol 'suplente'. IMPORTANTE: no debe incluir procesos donde la persona ya es
  // el ideal — esas filas se protegen y se editan desde el módulo Procesos.
  procesosSinMaquinaSuplente: number[]
}

// Inserta o actualiza una persona y reconcilia sus asignaciones:
//  - maquina_personal: sus filas ideal/suplente, con la regla de "un solo ideal
//    por máquina" (si pasa a ser ideal de una que ya tenía otro, ese otro baja a
//    suplente). El aviso al usuario lo hace el modal antes de llamar acá.
//  - tipo_proceso_personal: solo sus filas 'suplente' (las 'ideal', que se
//    definen desde Procesos, no se tocan).
export async function guardarPersonal(
  input: GuardarPersonalInput,
): Promise<{ error?: string }> {
  const base = {
    nombre: input.nombre.trim(),
    apellido: input.apellido?.trim() || null,
    horario_entrada: input.horarioEntrada,
    horario_salida: input.horarioSalida,
    horario_sabado_inicio: input.horarioSabadoInicio,
    horario_sabado_fin: input.horarioSabadoFin,
    en_tablero: input.enTablero,
    color_borde: input.colorBorde,
  }

  let id = input.id
  if (id == null) {
    const { data, error } = await supabase
      .from('personal')
      .insert({ ...base, activo: true })
      .select('id')
      .single()
    if (error) return { error: error.message }
    id = data.id
  } else {
    const { error } = await supabase.from('personal').update(base).eq('id', id)
    if (error) return { error: error.message }
  }
  if (id == null) return { error: 'No se pudo determinar la persona guardada.' }
  const pid = id // desde acá siempre es number (ayuda a TypeScript en los cruces)

  // --- maquina_personal ---
  // 1) Desplazar: en cada máquina donde esta persona pasa a ser ideal, si había
  //    otro ideal, ese otro baja a suplente.
  for (const maquinaId of input.maquinasIdeal) {
    const { error } = await supabase
      .from('maquina_personal')
      .update({ rol: 'suplente' })
      .eq('maquina_id', maquinaId)
      .eq('rol', 'ideal')
      .neq('personal_id', pid)
    if (error) return { error: error.message }
  }
  // 2) Limpiar las filas de ESTA persona y reinsertar el set deseado.
  const eDelMaq = await supabase
    .from('maquina_personal')
    .delete()
    .eq('personal_id', pid)
  if (eDelMaq.error) return { error: eDelMaq.error.message }

  const idealSet = new Set(input.maquinasIdeal)
  const filasMaq: { maquina_id: number; personal_id: number; rol: string }[] = []
  for (const maquinaId of input.maquinasIdeal) {
    filasMaq.push({ maquina_id: maquinaId, personal_id: pid, rol: 'ideal' })
  }
  for (const maquinaId of input.maquinasSuplente) {
    if (!idealSet.has(maquinaId)) {
      filasMaq.push({ maquina_id: maquinaId, personal_id: pid, rol: 'suplente' })
    }
  }
  if (filasMaq.length) {
    const { error } = await supabase.from('maquina_personal').insert(filasMaq)
    if (error) return { error: error.message }
  }

  // --- tipo_proceso_personal (solo las filas 'suplente' de esta persona) ---
  const eDelProc = await supabase
    .from('tipo_proceso_personal')
    .delete()
    .eq('personal_id', pid)
    .eq('rol', 'suplente')
  if (eDelProc.error) return { error: eDelProc.error.message }
  if (input.procesosSinMaquinaSuplente.length) {
    const filasProc = input.procesosSinMaquinaSuplente.map((tipo_proceso_id) => ({
      tipo_proceso_id,
      personal_id: pid,
      rol: 'suplente',
    }))
    const { error } = await supabase
      .from('tipo_proceso_personal')
      .insert(filasProc)
    if (error) return { error: error.message }
  }

  return {}
}

// Baja lógica: marca la persona como inactiva y le quita todas sus asignaciones
// (deja de ser ideal/suplente de máquinas y procesos), para no dejar referencias
// colgadas a alguien que ya no está. Si se rehabilita, se reasigna.
export async function inhabilitarPersonal(
  id: number,
): Promise<{ error?: string }> {
  const e1 = await supabase
    .from('maquina_personal')
    .delete()
    .eq('personal_id', id)
  if (e1.error) return { error: e1.error.message }
  const e2 = await supabase
    .from('tipo_proceso_personal')
    .delete()
    .eq('personal_id', id)
  if (e2.error) return { error: e2.error.message }
  const e3 = await supabase
    .from('personal')
    .update({ activo: false })
    .eq('id', id)
  return e3.error ? { error: e3.error.message } : {}
}
