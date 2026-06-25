import { useState, useEffect } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './shared/lib/supabaseClient'
import BarraSecciones from './shared/components/BarraSecciones'
import Login from './shared/components/Login'
import './App.css'

function App() {
  // La sesión actual: null = nadie logueado.
  const [sesion, setSesion] = useState<Session | null>(null)
  // Mientras consultamos a Supabase por primera vez, mostramos "cargando".
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    // 1) Al arrancar la app, preguntamos si ya hay una sesión activa.
    supabase.auth.getSession().then(({ data }) => {
      setSesion(data.session)
      setCargando(false)
    })

    // 2) Nos quedamos escuchando cambios (login / logout) para reaccionar.
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_evento, nuevaSesion) => {
        setSesion(nuevaSesion)
      },
    )

    // 3) Al desmontar, dejamos de escuchar (buena práctica de limpieza).
    return () => listener.subscription.unsubscribe()
  }, [])

  if (cargando) {
    return <div className="app-cargando">Cargando…</div>
  }

  // Portero: sin sesión -> login; con sesión -> la app.
  if (!sesion) {
    return <Login />
  }

  return (
    <div className="app">
      <BarraSecciones />
    </div>
  )
}

export default App
