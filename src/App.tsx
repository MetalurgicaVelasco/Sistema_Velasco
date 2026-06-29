import { useState, useEffect } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './shared/lib/supabaseClient'
import BarraSecciones from './shared/components/BarraSecciones'
import type { Seleccion } from './shared/components/BarraSecciones'
import Encabezado from './shared/components/Encabezado'
import Login from './shared/components/Login'
import Empresas from './features/empresas/Empresas'
import Proyectos from './features/produccion/Proyectos'
import './App.css'

function App() {
  const [sesion, setSesion] = useState<Session | null>(null)
  const [cargando, setCargando] = useState(true)
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

  function renderContenido() {
    if (!seleccion) {
      return <div className="bienvenida">Elegí un módulo para empezar</div>
    }

    if (seleccion.seccionId === 'empresas' && seleccion.moduloId === 'empresas') {
      return <Empresas />
    }

    if (
      seleccion.seccionId === 'produccion' &&
      seleccion.moduloId === 'proyectos'
    ) {
      return <Proyectos />
    }

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
      <main className="contenido-area">{renderContenido()}</main>
    </div>
  )
}

export default App
