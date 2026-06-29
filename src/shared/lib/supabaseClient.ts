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
const SUPABASE_PUBLISHABLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNsbG52b21vbnZwc3djdGJhcWdnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIxMDMyMzksImV4cCI6MjA5NzY3OTIzOX0.OShZi1ORbSkiKNNLUAyuPlj8DHSUEhFf1nuasNjBNXs'

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)
