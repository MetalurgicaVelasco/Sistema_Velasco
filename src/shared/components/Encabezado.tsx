import { supabase } from '../lib/supabaseClient'

// `email` es una prop: el dato que App.tsx le pasa a este componente.
function Encabezado({ email }: { email?: string }) {
  async function cerrarSesion() {
    await supabase.auth.signOut()
    // No hace falta nada más: el "portero" de App.tsx detecta que ya no hay
    // sesión y vuelve a mostrar la pantalla de login automáticamente.
  }

  return (
    <header className="encabezado">
      <span className="encabezado-titulo">Sistema Velasco</span>
      <div className="encabezado-derecha">
        {email && <span className="encabezado-email">{email}</span>}
        <button
          type="button"
          className="encabezado-salir"
          onClick={cerrarSesion}
        >
          Cerrar sesión
        </button>
      </div>
    </header>
  )
}

export default Encabezado
