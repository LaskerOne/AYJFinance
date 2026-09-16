import { Link } from "react-router-dom";
import { BarraApilada, type Segmento } from "@/components/charts/BarraApilada";
import { Dona } from "@/components/charts/Dona";
import { BarraProgreso } from "@/components/charts/BarraProgreso";
import { FilaKpi } from "@/components/ui/Kpi";
import { Estado } from "@/components/ui/Etiqueta";
import { useFinanzas } from "@/hooks/useFinanzas";
import { useMoneda } from "@/hooks/useMoneda";
import { useHogar } from "@/contexts/HogarContext";
import { enMeses, porcentaje } from "@/lib/formato";
import { TarjetasPersonas } from "./components/TarjetasPersonas";
import { ReglaCincuenta } from "./components/ReglaCincuenta";
import { RepartoBote } from "./components/RepartoBote";
import css from "./Resumen.module.css";

export function Resumen() {
  const f = useFinanzas();
  const { $ } = useMoneda();
  const { movimientos } = useHogar();

  const flujo: Segmento[] = [
    { nombre: "Gastos de vida", valor: f.gastos, color: "--s-gasto" },
    { nombre: "Cuotas de deuda", valor: f.cuotas, color: "--s-deuda" },
    { nombre: "Aportes a metas", valor: f.aportes, color: "--s-ahorro" },
    { nombre: "Sin asignar", valor: Math.max(0, f.libre), color: "--s-libre" },
  ];

  const mesesColchon = f.mesesColchon;
  const estadoColchon = mesesColchon >= 6 ? "ok" : mesesColchon >= 3 ? "warn" : "crit";
  const textoColchon =
    mesesColchon >= 6 ? "Colchón sólido" : mesesColchon >= 3 ? "Vas por buen camino" : "Colchón corto";
  const falta6 = Math.max(0, f.costoVida * 6 - f.fondo);
  const mesesParaSeis = f.fondoAporte > 0 ? Math.ceil(falta6 / f.fondoAporte) : Infinity;

  const esteMes = movimientos.filter((m) => m.fecha.slice(0, 7) === new Date().toISOString().slice(0, 7));
  const gastadoEsteMes = esteMes
    .filter((m) => m.clase === "gasto")
    .reduce((s, m) => s + Number(m.monto), 0);

  return (
    <>
      <TarjetasPersonas finanzas={f} />

      <FilaKpi
        columnas={5}
        datos={[
          { etiqueta: "Entra", valor: $(f.ingreso), detalle: "Ingreso mensual de los dos" },
          { etiqueta: "Sale", valor: $(f.gastos), detalle: "Gastos de vida presupuestados" },
          { etiqueta: "Cuotas de deuda", valor: $(f.cuotas), detalle: `${$(f.deudaTotal)} pendientes` },
          {
            etiqueta: "Queda libre",
            valor: $(f.disponible),
            detalle: "Para metas y colchón",
            tono: f.disponible >= 0 ? "positivo" : "negativo",
            destacado: true,
          },
          {
            etiqueta: "Tasa de ahorro",
            valor: porcentaje(f.tasaAhorro),
            detalle: f.disponible >= 0 ? "De cada peso que entra" : "Estás gastando de más",
            tono: f.tasaAhorro >= 0.2 ? "positivo" : f.tasaAhorro < 0 ? "negativo" : "neutro",
            destacado: true,
          },
        ]}
      />

      <section className="panel">
        <header>
          <div>
            <h2>A dónde va cada peso del mes</h2>
            <p className="nota">Sobre el ingreso total, ya normalizado a valor mensual.</p>
          </div>
        </header>

        <BarraApilada segmentos={flujo} total={f.ingreso} etiqueta="Reparto del ingreso mensual" />

        <p className={css.pieFlujo}>
          De los gastos de vida, <b className="num">{$(f.gastosFijos)}</b> son fijos y{" "}
          <b className="num">{$(f.gastosVariables)}</b> variables.
          {esteMes.length > 0 && (
            <>
              {" "}
              Este mes llevan <b className="num">{$(gastadoEsteMes)}</b> ejecutados en{" "}
              <Link to="/movimientos">{esteMes.length} movimientos</Link>.
            </>
          )}
        </p>

        {f.libre < 0 && (
          <p className={css.alerta}>
            <Estado tono="crit">Descuadre</Estado> Los aportes a metas superan en{" "}
            <b className="num">{$(-f.libre)}</b> lo que queda después de gastos y cuotas.
          </p>
        )}
      </section>

      <div className="grid2">
        <section className="panel">
          <header>
            <div>
              <h2>Gastos por categoría</h2>
              <p className="nota">Sin incluir cuotas de deuda ni aportes a metas.</p>
            </div>
          </header>
          <Dona datos={f.porCategoria} total={f.gastos} titulo="Gastos por categoría" />
        </section>

        <section className="panel">
          <header>
            <div>
              <h2>Regla 50 / 30 / 20</h2>
              <p className="nota">Necesidades hasta 50 %, gustos hasta 30 %, ahorro desde 20 %.</p>
            </div>
          </header>
          <ReglaCincuenta finanzas={f} />
        </section>
      </div>

      <section className="panel">
        <header>
          <div>
            <h2>El bote común y el reparto</h2>
            <p className="nota">
              Gastos compartidos, más las cuotas y metas que están a nombre de los dos.
            </p>
          </div>
        </header>
        <RepartoBote finanzas={f} />
      </section>

      <section className="panel">
        <header>
          <div>
            <h2>Colchón de emergencia</h2>
            <p className="nota">Meses de vida que cubre el fondo marcado como emergencia.</p>
          </div>
        </header>

        {f.fondoObjetivo <= 0 && f.fondo <= 0 ? (
          <p className="vacio">
            Marca una meta como <b>fondo de emergencia</b> en la pestaña Metas para verla aquí.
          </p>
        ) : (
          <>
            <div className={css.colchonCabeza}>
              <span className={css.colchonNumero}>
                {mesesColchon.toFixed(1).replace(".", ",")}
              </span>
              <span className={css.colchonTexto}>meses de vida cubiertos</span>
              <Estado tono={estadoColchon}>{textoColchon}</Estado>
            </div>

            <BarraProgreso
              fraccion={mesesColchon / 6}
              color={estadoColchon === "ok" ? "--ok" : estadoColchon === "warn" ? "--warn" : "--crit"}
              marca={0.5}
              tituloMarca="3 meses"
              alto={14}
              etiqueta={`Colchón: ${mesesColchon.toFixed(1)} meses de seis`}
            />
            <p className={css.colchonEscala}>Escala hasta 6 meses · la marca está en 3</p>

            <div className={css.notaReparto}>
              <p>
                Vivir un mes cuesta <span className={css.mn}>{$(f.costoVida)}</span> entre gastos y
                cuotas.{" "}
                {mesesColchon >= 6
                  ? "Ya tienen más de seis meses cubiertos: el excedente rinde más en las otras metas."
                  : Number.isFinite(mesesParaSeis)
                    ? `Para llegar a seis meses faltan ${$(falta6)}, unos ${enMeses(mesesParaSeis)} al ritmo actual del fondo.`
                    : `Para llegar a seis meses faltan ${$(falta6)}. Asígnale un aporte mensual al fondo.`}
              </p>
            </div>
          </>
        )}
      </section>
    </>
  );
}
