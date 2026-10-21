import { Link } from "react-router-dom";
import { EnlaceEditar } from "@/components/ui/EnlaceEditar";
import { BarraApilada, type Segmento } from "@/components/charts/BarraApilada";
import { AreaGlow } from "@/components/charts/AreaGlow";
import { BarrasRanking } from "@/components/charts/BarrasRanking";
import { BarraProgreso } from "@/components/charts/BarraProgreso";
import { FilaKpi } from "@/components/ui/Kpi";
import { Cifra } from "@/components/ui/Cifra";
import { Estado } from "@/components/ui/Etiqueta";
import { useFinanzas } from "@/hooks/useFinanzas";
import { useMoneda } from "@/hooks/useMoneda";
import { useCategorias } from "@/hooks/useCategorias";
import { useHogar } from "@/contexts/HogarContext";
import { enMeses, porcentaje } from "@/lib/formato";
import { TarjetasPersonas } from "./components/TarjetasPersonas";
import { ReglaCincuenta } from "./components/ReglaCincuenta";
import { RepartoBote } from "./components/RepartoBote";
import css from "./Resumen.module.css";

export function Resumen() {
  const f = useFinanzas();
  const { $ } = useMoneda();
  const { etiqueta } = useCategorias();
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

  // Gasto acumulado día a día del mes corriente, para el gráfico del héroe.
  const diasCorridos = Math.max(2, new Date().getDate());
  const porDia = Array.from({ length: diasCorridos }, () => 0);
  for (const m of esteMes) {
    if (m.clase !== "gasto") continue;
    const dia = Number(m.fecha.slice(8, 10));
    if (dia >= 1 && dia <= diasCorridos) porDia[dia - 1] += Number(m.monto);
  }
  const acumulado: number[] = [];
  for (const [i, v] of porDia.entries()) acumulado.push((acumulado[i - 1] ?? 0) + v);

  return (
    <>
      <section className={`panel hero ${css.heroMes}`}>
        <div className={css.heroCifras}>
          <span className="eyebrow">Queda libre este mes</span>
          <span className={`${css.heroNumero} ${f.disponible >= 0 ? css.heroPos : css.heroNeg}`}>
            <Cifra valor={f.disponible} formato={$} />
          </span>
          <span className={css.heroDetalle}>Para metas y colchón, después de gastos y cuotas.</span>
          <div className={css.heroChips}>
            <Estado tono={f.tasaAhorro >= 0.2 ? "ok" : f.tasaAhorro < 0 ? "crit" : "warn"}>
              Ahorro {porcentaje(f.tasaAhorro)}
            </Estado>
            <Estado tono={gastadoEsteMes <= f.gastos ? "ok" : "crit"}>
              Ejecutado {f.gastos > 0 ? porcentaje(gastadoEsteMes / f.gastos) : "—"} del presupuesto
            </Estado>
          </div>
        </div>
        <div className={css.heroGrafico}>
          <span className="eyebrow">Gasto acumulado del mes</span>
          <AreaGlow
            puntos={acumulado}
            etiqueta="Gasto acumulado del mes contra el presupuesto"
            etiquetaX={(i) => `día ${i + 1}`}
            referencia={f.gastos}
            etiquetaReferencia="presupuesto"
            color="--a-ink"
            alto={190}
          />
        </div>
      </section>

      <FilaKpi
        columnas={4}
        datos={[
          {
            etiqueta: "Entra",
            valor: <Cifra valor={f.ingreso} formato={$} />,
            detalle: "Ingreso mensual de los dos",
          },
          {
            etiqueta: "Sale",
            valor: <Cifra valor={f.gastos} formato={$} />,
            detalle: "Gastos de vida presupuestados",
          },
          {
            etiqueta: "Gastado este mes",
            valor: <Cifra valor={gastadoEsteMes} formato={$} />,
            detalle: `En ${esteMes.filter((m) => m.clase === "gasto").length} movimientos`,
            tono: gastadoEsteMes <= f.gastos ? "neutro" : "negativo",
          },
          {
            etiqueta: "Cuotas de deuda",
            valor: <Cifra valor={f.cuotas} formato={$} />,
            detalle: `${$(f.deudaTotal)} pendientes`,
          },
        ]}
      />

      <TarjetasPersonas finanzas={f} />

      <section className="panel">
        <header>
          <div>
            <h2>A dónde va cada peso del mes</h2>
            <p className="nota">Sobre el ingreso total, ya normalizado a valor mensual.</p>
          </div>
          <EnlaceEditar a="/presupuesto" texto="Editar en Presupuesto" />
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
            <EnlaceEditar a="/presupuesto" texto="Editar gastos" />
          </header>
          <BarrasRanking
            filas={f.porCategoria.map((c) => ({ nombre: etiqueta(c.categoria), valor: c.monto }))}
            total={f.gastos}
            etiqueta="Gastos por categoría, de mayor a menor"
          />
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
          <EnlaceEditar a="/presupuesto" texto="Editar en Presupuesto" />
        </header>
        <RepartoBote finanzas={f} />
      </section>

      <section className="panel">
        <header>
          <div>
            <h2>Colchón de emergencia</h2>
            <p className="nota">Meses de vida que cubre el fondo marcado como emergencia.</p>
          </div>
          <EnlaceEditar a="/metas" texto="Editar en Metas" />
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
