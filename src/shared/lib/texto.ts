// Saca tildes y pasa a minúsculas, para comparar sin distinciones.
// 'normalize(NFD)' separa cada letra de su tilde; el replace borra las tildes.
export function normalizar(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

// "contiene" insensible a tildes y mayúsculas.
// Ej: contiene('América Pampa', 'america') -> true
export function contiene(texto: string, busqueda: string): boolean {
  return normalizar(texto).includes(normalizar(busqueda))
}
