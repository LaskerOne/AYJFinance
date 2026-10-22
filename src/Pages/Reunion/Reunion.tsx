import { useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Estado } from "@/components/ui/Etiqueta";
import { useHogar } from "@/contexts/HogarContext";
import { useMoneda } from "@/hooks/useMoneda";
import { useCerrarMes, useSalud } from "@/hooks/useSalud";
import { liquidarMes } from "@/lib/liquidacion";
import { generarSugerencias } from "@/lib/sugerencias";
import { enMeses, nombrePeriodo, porcentaje } from "@/lib/formato";
import { mensajeDeError } from "@/services/supabase";
import { Decisiones } from "./components/Decisiones";
import { CartaMes } from "./components/CartaMes";
import css from "./Reunion.module.css";

function mesLocal(delta = 0): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + delta);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function Paso({
  n,
  titulo,
  listo,
  estado,
  children,
}: {
  n: number;
  titulo: string;
  listo: boolean;
  estado: string;
  children: ReactNode;
}) {
  return (
    <li className={css.paso} data-listo={listo} style={{ ["--i" as string]: String(n) }}>
      <span className={css.pasoNumero} aria-hidden="true">
        {listo ? "✓" : n}
      </span>
      <div className={css.pasoCuerpo}>
        <div className={css.pasoCabeza}>
          <h3 className={css.pasoTitulo}>{titulo}</h3>
          <Estado tono={listo ? "ok" : "warn"}>{estado}</Estado>
        </div>
        {children}
      </div>
    </li>
  );
}

/**
 * La reunión de plata del mes, guiada: revisar cómo les fue, saldar el bote,
 * cerrar el mes, mirar la salud, revisar lo que acordaron y acordar lo
 * próximo. Media hora al mes que vale más que cualquier gráfico.
 */
export function Reunion() {
  const { movimientos, cierres, decisiones, deudas, metas, hogar, idA, idB, nombreDe, crear } = useHogar();
  const { $ } = useMoneda();
  const { f, puntaje } = useSalud();
  const cerrar = useCerrarMes();
  const [cerrando, setCerrando] = useState(false);
  const [error, setError] = useState("");

  const mesHoy = mesLocal(0);
  const mesPasado = mesLocal(-1);
  const nombrePasado = nombrePeriodo(`${mesPasado}-01`);
  const nombreHoy = nombrePeriodo(`${mesHoy}-01`);

  const movsPasado = useMemo(() => movimientos.filter((m) => m.fecha.startsWith(mesPasado)), [movimientos, mesPasado]);
  const entro = movsPasado.filter((m) => m.clase === "ingreso").reduce((s, m) => s + Number(m.monto), 0);
  const salio = movsPasado.filter((m) => m.clase === "gasto").reduce((s, m) => s + Number(m.monto), 0);

  const reparto = hogar?.reparto ?? "proporcional";
  const liq = liquidarMes(movsPasado, idA, idB, reparto, f.participacionA);
  const hayBote = liq.totalCompartido > 0;
  const saldado = Math.abs(liq.neto) < 1;

  const cierrePasado = cierres.find((c) => c.periodo.startsWith(mesPasado));
  const cierreAnterior = [...cierres]
    .filter((c) => c.puntaje !== null && c.puntaje !== undefined && !c.periodo.startsWith(mesPasado))
    .sort((a, b) => (a.periodo < b.periodo ? 1 : -1))[0];

  const decisionesPasado = decisiones.filter((d) => d.periodo.startsWith(mesPasado));
  const decisionesHoy = decisiones.filter((d) => d.periodo.startsWith(mesHoy));
  const pendientesPasado = decisionesPasado.filter((d) => !d.cumplida).length;

  const sugerencias = useMemo(
    () =>
      generarSugerencias({
        finanzas: f,
        deudas,
        metas,
        estrategia: hogar?.estrategia_deuda ?? "avalancha",
        fmt: { moneda: $, meses: enMeses, pct: (n) => porcentaje(n) },
      })
        .filter((s) => !decisionesHoy.some((d) => d.origen === s.id))
        .slice(0, 3),
    [f, deudas, metas, hogar?.estrategia_deuda, $, decisionesHoy],
  );

  const nuevaDecision = (texto = "", origen: string | null = null) =>
    crear("decisiones", {
      periodo: `${mesHoy}-01`,
      texto,
      responsable: null,
      cumplida: false,
      origen,
      orden: decisionesHoy.length + 1,
    });

  const listos = [
    movsPasado.length > 0,
    !hayBote || saldado,
    Boolean(cierrePasado),
    true,
    pendientesPasado === 0,
    decisionesHoy.length > 0,
  ];
  const cuantos = listos.filter(Boolean).length;

  return (
    <>
      <section className="panel hero">
        <header>
          <div>
            <h2>Reunión de {nombreHoy}</h2>
            <p className="nota">
              Media hora al mes, los dos juntos: miran cómo les fue en {nombrePasado}, dejan las
              cuentas claras y acuerdan qué hacer en {nombreHoy}. La app va marcando lo que ya está.
            </p>
          </div>
          <span className="eyebrow">
            {cuantos} de {listos.length} pasos
          </span>
        </header>
        <div className="barra" style={{ height: 10 }} aria-hidden="true">
          <div className="fill" style={{ width: `${(cuantos / listos.length) * 100}%`, background: "var(--a)" }} />
        </div>
      </section>

      <CartaMes mes={mesPasado} />

      <ol className={css.pasos}>
        <Paso n={1} titulo={`Cómo les fue en ${nombrePasado}`} listo={listos[0]} estado={listos[0] ? "Revisado" : "Sin movimientos"}>
          {movsPasado.length > 0 ? (
            <p className={css.texto}>
              Entró <b>{$(entro)}</b>, salió <b>{$(salio)}</b>: el mes cerró en{" "}
              <b className={entro - salio >= 0 ? css.bien : css.mal}>{$(entro - salio)}</b>, en {movsPasado.length}{" "}
              movimientos. Miren en <Link to="/movimientos">Movimientos</Link> qué categorías se pasaron del presupuesto y
              por qué.
            </p>
          ) : (
            <p className={css.texto}>
              No hay movimientos registrados en {nombrePasado}. Anótenlos o importen el extracto antes de seguir: sin eso,
              la reunión se queda en suposiciones.
            </p>
          )}
        </Paso>

        <Paso n={2} titulo="Cuentas claras del bote" listo={listos[1]} estado={!hayBote ? "Nada que liquidar" : saldado ? "A paz y salvo" : "Pendiente"}>
          <p className={css.texto}>
            {!hayBote ? (
              <>En {nombrePasado} no hubo gastos del bote común.</>
            ) : saldado ? (
              <>El bote de {nombrePasado} quedó saldado.</>
            ) : (
              <>
                <b>{nombreDe(liq.neto > 0 ? idB : idA)}</b> le debe <b>{$(Math.abs(liq.neto))}</b> a{" "}
                <b>{nombreDe(liq.neto > 0 ? idA : idB)}</b> por el bote de {nombrePasado}. Regístrenlo en{" "}
                <Link to="/movimientos">Movimientos</Link> (vayan a {nombrePasado}).
              </>
            )}
          </p>
        </Paso>

        <Paso n={3} titulo={`Cerrar ${nombrePasado}`} listo={listos[2]} estado={cierrePasado ? "Cerrado" : "Por cerrar"}>
          {cierrePasado ? (
            <p className={css.texto}>
              Ya quedó en el <Link to="/historico">Histórico</Link>. Si corrigieron movimientos después, pueden volver a
              cerrarlo desde allá y se recalcula.
            </p>
          ) : (
            <div className={css.accion}>
              <p className={css.texto}>Cerrarlo congela sus cifras y el puntaje de salud de hoy en el histórico.</p>
              <button
                className="pill primaria"
                disabled={cerrando}
                onClick={async () => {
                  setError("");
                  setCerrando(true);
                  try {
                    await cerrar(mesPasado);
                  } catch (e) {
                    setError(mensajeDeError(e));
                  } finally {
                    setCerrando(false);
                  }
                }}
              >
                {cerrando ? "Cerrando…" : `Cerrar ${nombrePasado}`}
              </button>
              {error && <p className={css.error}>{error}</p>}
            </div>
          )}
        </Paso>

        <Paso n={4} titulo="Cómo está su salud financiera" listo estado={`${puntaje.total} / 100`}>
          <p className={css.texto}>
            Su puntaje hoy es <b>{puntaje.total}</b>
            {cierreAnterior ? (
              <>
                {" "}
                ({puntaje.total - Number(cierreAnterior.puntaje) >= 0 ? "+" : "−"}
                {Math.abs(puntaje.total - Number(cierreAnterior.puntaje))} desde el cierre de{" "}
                {nombrePeriodo(cierreAnterior.periodo)})
              </>
            ) : null}
            . Lo que más le resta:{" "}
            <b>{[...puntaje.partes].sort((a, b) => a.puntos - b.puntos)[0].nombre.toLowerCase()}</b>. Miren su{" "}
            <Link to="/ruta">ruta</Link> para saber cuál es el siguiente paso.
          </p>
        </Paso>

        <Paso
          n={5}
          titulo={`Lo que acordaron para ${nombrePasado}`}
          listo={listos[4]}
          estado={decisionesPasado.length === 0 ? "Sin acuerdos" : pendientesPasado === 0 ? "Todo cumplido" : `${pendientesPasado} pendientes`}
        >
          {decisionesPasado.length === 0 ? (
            <p className={css.texto}>No registraron decisiones el mes pasado. Esta reunión es un buen comienzo.</p>
          ) : (
            <>
              <p className={css.texto}>Marquen lo que cumplieron. Lo que no, decidan si sigue o se suelta.</p>
              <Decisiones lista={decisionesPasado} soloMarcar />
            </>
          )}
        </Paso>

        <Paso
          n={6}
          titulo={`Sus decisiones para ${nombreHoy}`}
          listo={listos[5]}
          estado={decisionesHoy.length === 0 ? "Por acordar" : `${decisionesHoy.length} acordadas`}
        >
          <p className={css.texto}>
            Pocas y concretas: con tres basta. Cada una con quién se encarga.
          </p>
          {decisionesHoy.length > 0 && <Decisiones lista={decisionesHoy} />}
          <button className="agregar" onClick={() => void nuevaDecision()}>
            + Agregar decisión
          </button>

          {sugerencias.length > 0 && (
            <div className={css.sugeridas}>
              <span className="eyebrow">Lo que sugiere la app, con sus números</span>
              {sugerencias.map((s) => (
                <div key={s.id} className={css.sugerida}>
                  <div>
                    <b>{s.titulo}</b>
                    {s.impacto && <span className={css.impacto}> · {s.impacto}</span>}
                  </div>
                  <button className="pill" onClick={() => void nuevaDecision(s.titulo, s.id)}>
                    Adoptar
                  </button>
                </div>
              ))}
            </div>
          )}
        </Paso>
      </ol>
    </>
  );
}
