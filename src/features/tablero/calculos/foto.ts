// features/tablero/calculos/foto.ts
// -----------------------------------------------------------------------------
// Las fotos se guardan como PATH dentro del bucket de Storage (ej.
// "items/12/1699.png"), no como URL. Para mostrarlas hay que resolver la URL
// pública. Este helper centraliza esa conversión para todo el tablero.
// -----------------------------------------------------------------------------

import { supabase } from '../../../shared/lib/supabaseClient'

const BUCKET = 'proyectos-fotos'

export function fotoPublica(path: string | null): string | null {
  if (!path) return null
  // Tolera que ya venga una URL completa (datos viejos).
  if (path.startsWith('http://') || path.startsWith('https://')) return path
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
}
