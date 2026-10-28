// -----------------------------------------------------------------------------
// Tipos de operación: qué estaba haciendo el operario en un tramo.
//
// Son los mismos siete de la app de CNC que ya usan los operarios, con sus
// códigos y colores: cambiar el vocabulario ahora sería pedirles que reaprendan
// algo que ya tienen incorporado.
//
// Además de los siete hay uno propio de este sistema, PA (Pausa): una
// interrupción con su motivo. El descanso (DE) se elige desde el mismo botón de
// Pausa, pero conserva su código para que los datos sigan diciendo lo mismo que
// en la app de CNC.
// -----------------------------------------------------------------------------

export type TipoOperacion = 'RD' | 'PR' | 'SE' | 'OP' | 'MA' | 'DE' | 'OT' | 'PA'

export type DefTipoOperacion = {
  id: TipoOperacion
  label: string // como se lee en pantalla
  corto: string // para la grilla de botones
  // Productivo = trabajo sobre la pieza.
  productivo: boolean
  // ¿Tiene botón propio en la grilla? DE y PA no: se eligen desde "Pausa".
  enGrilla: boolean
}

export const TIPOS_OPERACION: DefTipoOperacion[] = [
  { id: 'RD', label: 'Relevamiento y Diseño', corto: 'Relev. y Diseño', productivo: true, enGrilla: true },
  { id: 'PR', label: 'Programando', corto: 'Programando', productivo: true, enGrilla: true },
  { id: 'SE', label: 'Seteando', corto: 'Seteando', productivo: true, enGrilla: true },
  { id: 'OP', label: 'Operando', corto: 'Operando', productivo: true, enGrilla: true },
  { id: 'MA', label: 'Mantenimiento', corto: 'Mantenimiento', productivo: false, enGrilla: true },
  { id: 'OT', label: 'Otra', corto: 'Otra', productivo: false, enGrilla: true },
  { id: 'DE', label: 'Descanso', corto: 'Descanso', productivo: false, enGrilla: false },
  { id: 'PA', label: 'Pausa', corto: 'Pausa', productivo: false, enGrilla: false },
]

// Los que tienen botón propio en la grilla "¿Qué estás haciendo?".
export const TIPOS_GRILLA = TIPOS_OPERACION.filter((t) => t.enGrilla)

// Una pausa es un tramo PA, salvo el descanso, que se guarda como DE.
export function tipoDePausa(motivo: string): TipoOperacion {
  return motivo === 'descanso' ? 'DE' : 'PA'
}

export function esPausa(id: TipoOperacion | undefined): boolean {
  return id === 'PA' || id === 'DE'
}

const POR_ID = new Map(TIPOS_OPERACION.map((t) => [t.id, t] as const))

export function defTipo(id: TipoOperacion): DefTipoOperacion {
  return POR_ID.get(id) ?? (POR_ID.get('OT') as DefTipoOperacion)
}

export function esProductivo(id: TipoOperacion): boolean {
  return defTipo(id).productivo
}

// Solo una operación (OP) puede quedar corriendo sola en la máquina.
export function admiteAutomatico(id: TipoOperacion): boolean {
  return id === 'OP'
}
