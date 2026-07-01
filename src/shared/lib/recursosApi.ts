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
