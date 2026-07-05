// features/tablero/configTablero.ts
// -----------------------------------------------------------------------------
// Configuración del tablero: se lee de la tabla `configuraciones` (clave
// 'tablero') para no hardcodear la ventana horaria ni los parámetros de cascada.
// El día que exista el módulo Configuraciones, se edita desde ahí; hoy se lee.
// -----------------------------------------------------------------------------

import { supabase } from '../../shared/lib/supabaseClient'

export type ConfigTablero = {
  ventanaInicio: string   // 'HH:MM' — primer hora visible del día
  ventanaFin: string      // 'HH:MM' — última hora visible del día
  gapMin: number          // separación mínima entre bloques (cascada)
  maxSimultaneas: number  // máquinas que un operario maneja a la vez
  diasAtras: number       // días pasados visibles
  diasAdelante: number    // días futuros visibles
}

// Si falta la fila o alguna clave, se usan estos valores (los mismos de la semilla).
const DEFAULT: ConfigTablero = {
  ventanaInicio: '06:00',
  ventanaFin: '17:00',
  gapMin: 10,
  maxSimultaneas: 3,
  diasAtras: 2,
  diasAdelante: 7,
}

export async function cargarConfigTablero(): Promise<ConfigTablero> {
  const { data, error } = await supabase
    .from('configuraciones')
    .select('valor')
    .eq('clave', 'tablero')
    .maybeSingle()
  if (error) throw new Error(error.message)

  const v = (data?.valor ?? {}) as Record<string, unknown>
  return {
    ventanaInicio: (v.ventana_inicio as string) ?? DEFAULT.ventanaInicio,
    ventanaFin: (v.ventana_fin as string) ?? DEFAULT.ventanaFin,
    gapMin: Number(v.gap_min ?? DEFAULT.gapMin),
    maxSimultaneas: Number(v.max_simultaneas ?? DEFAULT.maxSimultaneas),
    diasAtras: Number(v.dias_atras ?? DEFAULT.diasAtras),
    diasAdelante: Number(v.dias_adelante ?? DEFAULT.diasAdelante),
  }
}
