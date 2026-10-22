import { useMemo, useState } from "react";
import { LineaTiempo, type Serie } from "@/components/charts/LineaTiempo";
import { FilaKpi } from "@/components/ui/Kpi";
import { CampoMoneda } from "@/components/ui/CampoMoneda";
import { useHogar } from "@/contexts/HogarContext";
import { useFinanzas } from "@/hooks/useFinanzas";
import { useMoneda } from "@/hooks/useMoneda";
import { aNumero, dentroDe, enMeses } from "@/lib/formato";
import { libertadFinanciera, proyectarPatrimonio } from "@/lib/patrimonio";
import { TIPOS_ACTIVO } from "@/models/dominio";
import css from "../Patrimonio.module.css";

/**
 * Hacia dónde va el patrimonio con lo que tienen y aportan hoy, y la meta
 * de largo plazo que da sentido a todo lo demás: el número con el que
 * podrían vivir de sus inversiones.
 */
export function Futuro({ inflacion }: { inflacion: number }) {
  const { activos, deudas, hogar } = useHogar();
  const f = useFinanzas();
  const { $ } = useMoneda();

  const puntos = useMemo(
    () =>
      proyectarPatrimonio(activos, deudas, {
        anios: 10,
        inflacion,
        abono: Number(hogar?.abono_extra ?? 0),
        estrategia: hogar?.estrategia_deuda ?? "avalancha",
      }),
    [activos, deudas, inflacion, hogar?.abono_extra, hogar?.estrategia_deuda],
  );

  const series: Serie[] = [
    { nombre: "En pesos de cada año", puntos: puntos.map((p) => p.nominal), color: "--a" },
    { nombre: "En pesos de hoy", puntos: puntos.map((p) => p.real), color: "--ink-3", punteada: true },
  ];

  // Libertad financiera: con el gasto de vida (las deudas ya no estarían).
  const invertible = activos
    .filter((a) => TIPOS_ACTIVO[a.tipo].grupo !== "bienes")
    .reduce((s, a) => s + Number(a.valor), 0);
  const aportes = activos
    .filter((a) => TIPOS_ACTIVO[a.tipo].grupo !== "bienes")
    .reduce((s, a) => s + Number(a.aporte_mensual), 0);
  const [retiro, setRetiro] = useState(4);
  const [renta, setRenta] = useState(4);
  const [ahorro, setAhorro] = useState<number | null>(null);
  const ahorroUsado = ahorro ?? aportes;
  const lib = libertadFinanciera(f.gastos, retiro, invertible, ahorroUsado, renta);

  const en = (anio: number) => puntos.find((p) => p.anio === anio);

  return (
    <>
      <section className="panel">
        <header>
          <div>
            <h2>Hacia dónde va su patrimonio</h2>
            <p className="nota">
              Con lo que tienen, lo que le aportan cada mes a cada cosa y sus deudas bajando según
              el plan. La línea punteada descuenta la inflación: es lo que de verdad podrían comprar.
            </p>
          </div>
        </header>

        <FilaKpi
          columnas={3}
          datos={[1, 5, 10].map((anio) => {
            const p = en(anio);
            return {
              etiqueta: `En ${anio} ${anio === 1 ? "año" : "años"}`,
              valor: p ? $(p.nominal) : "—",
              detalle: p ? `${$(p.real)} en pesos de hoy` : "",
              tono: p && p.nominal < 0 ? "negativo" : "neutro",
            };
          })}
        />

        <div style={{ marginTop: 18 }}>
          <LineaTiempo
            series={series}
            etiqueta="Patrimonio neto proyectado a diez años"
            alto={210}
            etiquetaX={(i) => (i === 0 ? "hoy" : `año ${i}`)}
          />
          <div className={css.leyenda}>
            <span><span className={css.trazoSolido} /> En pesos de cada año</span>
            <span><span className={css.trazoPunteado} /> En pesos de hoy</span>
          </div>
        </div>
        <p className={css.pie}>
          Conservador a propósito: no supone que las cuotas que se liberan al terminar las deudas
          se vayan a ahorro. Si las redirigen, el patrimonio crece bastante más rápido.
        </p>
      </section>

      <section className="panel hero">
        <header>
          <div>
            <h2>Su número de libertad financiera</h2>
            <p className="nota">
              El capital que, retirando un porcentaje cada año, cubriría su gasto de vida sin
              depender de un sueldo. No es una meta para mañana: es la brújula del largo plazo.
            </p>
          </div>
        </header>

        <div className={css.libertad}>
          <div className={css.libertadCifra}>
            <span className="eyebrow">Necesitarían invertidos</span>
            <span className={`heroNumero heroPos ${css.libertadNumero}`}>{$(lib.objetivo)}</span>
            <span className="heroDetalle">
              {lib.meses === 0
                ? "Ya lo tienen. Felicitaciones."
                : Number.isFinite(lib.meses)
                  ? `Al ritmo elegido llegarían en ${enMeses(lib.meses)} (${dentroDe(lib.meses) || "muy lejos"}).`
                  : "Con ese ahorro no se alcanza: suban el aporte mensual."}
            </span>
          </div>

          <div className={css.libertadControles}>
            <div className={css.campoLab}>
              <span className="eyebrow">Cuánto retirarían al año</span>
              <div className="segmentado" role="group" aria-label="Tasa de retiro">
                {[3, 3.5, 4].map((t) => (
                  <button key={t} type="button" aria-pressed={retiro === t} onClick={() => setRetiro(t)}>
                    {String(t).replace(".", ",")} %
                  </button>
                ))}
              </div>
            </div>
            <label className={css.campoLab}>
              <span className="eyebrow">
                Rentabilidad real supuesta <b className="num">{String(renta).replace(".", ",")} %</b>
              </span>
              <input
                type="range"
                min={1}
                max={8}
                step={0.5}
                value={renta}
                onChange={(e) => setRenta(aNumero(e.target.value))}
                style={{ ["--lleno" as string]: `${((renta - 1) / 7) * 100}%` }}
              />
            </label>
            <label className={css.campoLab}>
              <span className="eyebrow">Ahorro para inversión al mes</span>
              <CampoMoneda
                className="campo"
                valor={ahorroUsado}
                etiqueta="Ahorro para inversión al mes"
                onCambio={setAhorro}
              />
            </label>
          </div>
        </div>
        <p className={css.pie}>
          Parte del gasto de vida presupuestado ({$(f.gastos)} al mes, sin cuotas: para entonces las
          deudas ya no estarían) y de lo que ya tienen fuera de bienes ({$(invertible)}). La regla
          del 4 % viene de estudios de mercados con inflación baja; con inflación más alta, como
          la colombiana, muchos prefieren 3 o 3,5 %.
        </p>
      </section>
    </>
  );
}
