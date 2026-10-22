import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useSesion } from "@/contexts/SesionContext";
import { useHogar } from "@/contexts/HogarContext";
import { Cargando } from "@/components/ui/Cargando";
import { SelectorTema } from "@/components/ui/SelectorTema";
import { Icono, type NombreIcono } from "@/components/ui/Icono";
import { useMoneda } from "@/hooks/useMoneda";
import { MONEDAS, moneda as fmtMoneda } from "@/lib/formato";
import css from "./Layout.module.css";

const SECCIONES: { ruta: string; texto: string; icono: NombreIcono; exacta?: boolean }[] = [
  { ruta: "/", texto: "Resumen", icono: "resumen", exacta: true },
  { ruta: "/movimientos", texto: "Movimientos", icono: "movimientos" },
  { ruta: "/habitos", texto: "Hábitos", icono: "habitos" },
  { ruta: "/presupuesto", texto: "Presupuesto", icono: "presupuesto" },
  { ruta: "/deudas", texto: "Deudas", icono: "deudas" },
  { ruta: "/credito", texto: "Laboratorio de crédito", icono: "credito" },
  { ruta: "/metas", texto: "Metas", icono: "metas" },
  { ruta: "/proyeccion", texto: "Proyección", icono: "proyeccion" },
  { ruta: "/historico", texto: "Histórico", icono: "historico" },
  { ruta: "/sugerencias", texto: "Sugerencias", icono: "sugerencias" },
  { ruta: "/importar", texto: "Importar", icono: "importar" },
  { ruta: "/ajustes", texto: "Ajustes", icono: "ajustes" },
];

/** Cuando el hogar mira en USD, dice con qué tasa se está convirtiendo. */
function IndicadorTasa() {
  const { elegido, convierte, tasa } = useMoneda();
  if (elegido !== "USD") return null;
  return (
    <span className={css.tasa} title="Tasa del día, de open.er-api.com">
      {convierte && tasa
        ? `1 US$ ≈ ${fmtMoneda(tasa, "COP")}`
        : "Sin tasa aún · mostrando COP"}
    </span>
  );
}

export function Layout() {
  const { salir, correo } = useSesion();
  const { pathname } = useLocation();
  const {
    hogar,
    cargando,
    error,
    errorEscritura,
    descartarErrorEscritura,
    enVivo,
    cambiarHogar,
    perfiles,
  } = useHogar();

  if (cargando) return <Cargando mensaje="Abriendo su hogar" />;

  if (error) {
    return (
      <div className={css.errorCaja}>
        <div className="panel">
          <h2>No se pudo abrir el hogar</h2>
          <p className="nota" style={{ marginTop: 8 }}>{error}</p>
          <button className="pill" style={{ marginTop: 16 }} onClick={() => void salir()}>
            Cerrar sesión y reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={css.app}>
      <aside className={css.lateral}>
        <div className={css.marca}>
          <span className={css.logo} aria-hidden="true">CD</span>
          <div className={css.marcaTexto}>
            <h1 className={css.titulo}>{hogar?.nombre ?? "Cuentas de Dos"}</h1>
            <p className={css.sub}>
              {perfiles.length > 1
                ? perfiles.map((p) => p.nombre || p.correo.split("@")[0]).join(" y ")
                : "Invita a tu pareja desde Ajustes"}
            </p>
          </div>
        </div>

        <nav className={css.nav} aria-label="Secciones">
          {SECCIONES.map((s) => (
            <NavLink
              key={s.ruta}
              to={s.ruta}
              end={s.exacta}
              className={({ isActive }) => `${css.enlace} ${isActive ? css.activo : ""}`}
            >
              <span className={css.icono}>
                <Icono nombre={s.icono} tamano={18} />
              </span>
              {s.texto}
            </NavLink>
          ))}
        </nav>

        <div className={css.pieLateral}>
          <span
            className={`${css.vivo} ${enVivo ? css.vivoOn : ""}`}
            title={enVivo ? "Cambios en vivo" : "Sin conexión en vivo"}
          >
            <span className={css.punto} />
            {enVivo ? "Sincronizado en vivo" : "Sin conexión en vivo"}
          </span>
          <span className={css.correo} title={correo}>
            {correo}
          </span>
        </div>
      </aside>

      <div className={css.principal}>
        <header className={css.topbar}>
          <IndicadorTasa />
          <select
            className="pill"
            aria-label="Moneda"
            value={hogar?.moneda ?? "COP"}
            onChange={(e) => void cambiarHogar({ moneda: e.target.value })}
          >
            {MONEDAS.map((m) => (
              <option key={m.codigo} value={m.codigo}>
                {m.etiqueta}
              </option>
            ))}
          </select>

          <SelectorTema />

          <button className="pill ghost" onClick={() => void salir()} title={correo}>
            Salir
          </button>
        </header>

        {errorEscritura && (
          <div className={css.avisoError} role="alert">
            <div>
              <strong>No se pudo guardar el cambio.</strong>
              <p className={css.detalleError}>{errorEscritura}</p>
            </div>
            <button className="pill" onClick={descartarErrorEscritura}>
              Entendido
            </button>
          </div>
        )}

        {/* La clave por ruta remonta el contenido al navegar, y con él
            vuelve a correr la cascada de entrada: esa es la transición. */}
        <main className={css.contenido} key={pathname}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
