// -----------------------------------------------------------------------------
// Tipos de operación: qué estaba haciendo el operario en un tramo.
//
// Son los mismos siete de la app de CNC que ya usan los operarios, con sus
// códigos y colores: cambiar el vocabulario ahora sería pedirles que reaprendan
// algo que ya tienen incorporado.
// -----------------------------------------------------------------------------

export type TipoOperacion = 'RD' | 'PR' | 'SE' | 'OP' | 'MA' | 'DE' | 'OT'

export type DefTipoOperacion = {
  id: TipoOperacion
  label: string // como se lee en pantalla
  corto: string // para la grilla de botones
  // Productivo = trabajo sobre la pieza. Los no productivos piden motivo.
  productivo: boolean
}

export const TIPOS_OPERACION: DefTipoOperacion[] = [
  { id: 'RD', label: 'Relevamiento y Diseño', corto: 'Relev. y Diseño', productivo: true },
  { id: 'PR', label: 'Programando', corto: 'Programando', productivo: true },
  { id: 'SE', label: 'Seteando', corto: 'Seteando', productivo: true },
  { id: 'OP', label: 'Operando', corto: 'Operando', productivo: true },
  { id: 'MA', label: 'Mantenimiento', corto: 'Mantenimiento', productivo: false },
  { id: 'DE', label: 'Descanso', corto: 'Descanso', productivo: false },
  { id: 'OT', label: 'Otra', corto: 'Otra', productivo: false },
]

const POR_ID = new Map(TIPOS_OPERACION.map((t) => [t.id, t] as const))

export function defTipo(id: TipoOperacion): DefTipoOperacion {
  return POR_ID.get(id) ?? TIPOS_OPERACION[TIPOS_OPERACION.length - 1]
}

export function esProductivo(id: TipoOperacion): boolean {
  return defTipo(id).productivo
}

// Solo una operación (OP) puede quedar corriendo sola en la máquina.
export function admiteAutomatico(id: TipoOperacion): boolean {
  return id === 'OP'
}
