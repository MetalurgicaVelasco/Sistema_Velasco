import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'

function Login() {
  // Guardamos lo que el usuario escribe en cada campo.
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  // Estado para mostrar errores y para deshabilitar el botón mientras procesa.
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)

  async function iniciarSesion() {
    setError(null)
    setCargando(true)

    // Le pedimos a Supabase que valide email + contraseña.
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    setCargando(false)

    if (error) {
      // Mensaje genérico para no revelar si el mail existe o no.
      setError('Email o contraseña incorrectos.')
    }
    // Si sale bien, no hace falta hacer nada acá: el "portero" de App.tsx
    // detecta la nueva sesión y muestra la app automáticamente.
  }

  return (
    <div className="login-pantalla">
      <div className="login-caja">
        <h1 className="login-titulo">Sistema Velasco</h1>

        <label className="login-label">
          Email
          <input
            type="email"
            className="login-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
          />
        </label>

        <label className="login-label">
          Contraseña
          <input
            type="password"
            className="login-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </label>

        {error && <p className="login-error">{error}</p>}

        <button
          type="button"
          className="login-boton"
          onClick={iniciarSesion}
          disabled={cargando}
        >
          {cargando ? 'Entrando…' : 'Iniciar sesión'}
        </button>
      </div>
    </div>
  )
}

export default Login
