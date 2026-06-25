import { createClient } from '@supabase/supabase-js'

// Conexión al proyecto Supabase "Sistema Velasco".
//
// La "publishable key" (también llamada "anon key") es PÚBLICA: está pensada
// para usarse en el navegador. Los datos quedan protegidos por las reglas de
// seguridad de la base (RLS) de Supabase, no por ocultar esta clave.
//
// ⚠ Acá NUNCA va la "secret key" (service_role) ni la contraseña de Postgres.
//   Esos son secretos y no pueden vivir en el navegador.
//
// 👉 Reemplazá los dos valores de abajo por los de tu proyecto:
//    - SUPABASE_URL              -> el "Project URL" / "API URL"
//    - SUPABASE_PUBLISHABLE_KEY  -> la "publishable key" (anon / public)

const SUPABASE_URL = 'https://cllnvomonvpswctbaqgg.supabase.co'
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_o4_CsCNEJHR3jV09zkYKxQ_HoSnx83F'

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)
