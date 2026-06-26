import { useState, useEffect } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './shared/lib/supabaseClient'
import BarraSecciones from './shared/components/BarraSecciones'
import type { Seleccion } from './shared/components/BarraSecciones'
import Encabezado from './shared/components/Encabezado'
import Login from './shared/components/Login'
import Empresas from './features/empresas/Empresas'
import './App.css'

function App() {
  const [sesion, setSesion] = useState<Session | null>(null)
  const [cargando, setCargando] = useState(true)
  // Qué módulo eligió el usuario en la barra (null = ninguno todavía).
  const [seleccion, setSeleccion] = useState<Seleccion | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSesion(data.session)
      setCargando(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_evento, nuevaSesion) => {
        setSesion(nuevaSesion)
      },
    )

    return () => listener.subscription.unsubscribe()
  }, [])

  // Decide qué mostrar en la zona de contenido según lo elegido en la barra.
  function renderContenido() {
    if (!seleccion) {
      return <div className="bienvenida">Elegí un módulo para empezar</div>
    }

    // Por ahora, el único módulo construido es Empresas (sección Empresas).
    if (seleccion.seccionId === 'empresas' && seleccion.moduloId === 'empresas') {
      return <Empresas />
    }

    // Todos los demás módulos: "en construcción".
    return (
      <div className="contenido">
        <div className="contenido-emoji">🚧</div>
        <div className="contenido-titulo">{seleccion.moduloTitulo}</div>
        <div className="contenido-texto">En construcción</div>
      </div>
    )
  }

  if (cargando) {
    return <div className="app-cargando">Cargando…</div>
  }

  if (!sesion) {
    return <Login />
  }

  return (
    <div className="app">
      <Encabezado email={sesion.user.email} />
      <BarraSecciones onSeleccion={setSeleccion} />
      {renderContenido()}
    </div>
  )
}

export default App
