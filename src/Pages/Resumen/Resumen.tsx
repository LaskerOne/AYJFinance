import { Link } from "react-router-dom";
import { EnlaceEditar } from "@/components/ui/EnlaceEditar";
import { AreaGlow } from "@/components/charts/AreaGlow";
import { BarrasRanking } from "@/components/charts/BarrasRanking";
import { FilaKpi } from "@/components/ui/Kpi";
import { Cifra } from "@/components/ui/Cifra";
import { Estado } from "@/components/ui/Etiqueta";
import { useFinanzas } from "@/hooks/useFinanzas";
import { useMoneda } from "@/hooks/useMoneda";
import { useCategorias } from "@/hooks/useCategorias";
import { useHogar } from "@/contexts/HogarContext";
import { porcentaje } from "@/lib/formato";
import { TarjetasPersonas } from "./components/TarjetasPersonas";
import { SaludFinanciera } from "./components/SaludFinanciera";
import { RepartoBote } from "./components/RepartoBote";
import css from "./Resumen.module.css";

export function Resumen() {
  const f = useFinanzas();
  const { $ } = useMoneda();
  const { etiqueta } = useCategorias();
  const { movimientos } = useHogar();

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
      <section className="panel hero heroGrid">
        <div className="heroCifras">
          <span className="eyebrow">Queda libre este mes</span>
          <span className={`heroNumero ${f.disponible >= 0 ? "heroPos" : "heroNeg"}`}>
            <Cifra valor={f.disponible} formato={$} />
          </span>
          <span className="heroDetalle">Para metas y colchón, después de gastos y cuotas.</span>
          <div className="heroChips">
            <Estado tono={f.tasaAhorro >= 0.2 ? "ok" : f.tasaAhorro < 0 ? "crit" : "warn"}>
              Ahorro {porcentaje(f.tasaAhorro)}
            </Estado>
            <Estado tono={gastadoEsteMes <= f.gastos ? "ok" : "crit"}>
              Ejecutado {f.gastos > 0 ? porcentaje(gastadoEsteMes / f.gastos) : "—"} del presupuesto
            </Estado>
          </div>
        </div>
        <div className="heroGrafico">
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

      {/* El reparto completo del ingreso vive en el héroe de Presupuesto;
          repetirlo aquí era contar lo mismo dos veces. El descuadre sí se
          queda: es una alerta, no un detalle. */}
      {f.libre < 0 && (
        <p className={css.alerta}>
          <Estado tono="crit">Descuadre</Estado> Los aportes a metas superan en{" "}
          <b className="num">{$(-f.libre)}</b> lo que queda después de gastos y cuotas.{" "}
          <Link to="/presupuesto">Revisar el presupuesto</Link>.
        </p>
      )}

      <SaludFinanciera finanzas={f} />

      <div>
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
    </>
  );
}
