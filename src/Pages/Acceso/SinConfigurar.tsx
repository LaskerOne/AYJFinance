import css from "./Acceso.module.css";

/** Se muestra cuando falta el .env. Vale más una instrucción concreta que un
 *  error de red incomprensible en la consola. */
export function SinConfigurar() {
  return (
    <div className={css.pantalla}>
      <div className={css.tarjeta} style={{ maxWidth: 560 }}>
        <span className={css.logo} aria-hidden="true">CD</span>
        <h1 className={css.titulo}>Falta conectar Supabase</h1>
        <p className={css.lema} style={{ maxWidth: "46ch" }}>
          La aplicación está lista, pero todavía no sabe a qué base de datos hablarle.
        </p>

        <ol className={css.ayuda} style={{ marginTop: 22, paddingLeft: 18, lineHeight: 1.8 }}>
          <li>Crea un proyecto gratuito en supabase.com</li>
          <li>
            Ejecuta <code>supabase/migrations/0001_esquema.sql</code> y luego{" "}
            <code>0002_funciones.sql</code> en el SQL Editor
          </li>
          <li>
            Copia <code>.env.example</code> a <code>.env</code> y pega la URL y la clave anónima
            del proyecto
          </li>
          <li>
            Vuelve a arrancar con <code>npm run dev</code>
          </li>
        </ol>

        <p className={css.ayuda}>
          El README del repositorio tiene el paso a paso completo, incluido el despliegue en
          Vercel.
        </p>
      </div>
    </div>
  );
}
