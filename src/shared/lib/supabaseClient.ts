import { createClient } from '@supabase/supabase-js'

// La URL y la clave anon ya NO viven en el código: se leen de variables de
// entorno. Vite expone al navegador solo las variables que empiezan con VITE_.
//
// Los valores reales van en un archivo ".env.local" (en la raíz del proyecto),
// que NO se sube al repo. Hay un ".env.example" como plantilla.
//
// Recordatorio: la clave anon es PÚBLICA por diseño (igual termina visible en
// el navegador). Sacarla del código es higiene/orden, no la vuelve secreta.
// La seguridad real de los datos la da RLS.

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    'Faltan variables de entorno de Supabase. Creá un archivo ".env.local" en ' +
      'la raíz del proyecto con VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.',
  )
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
