import { useMemo } from "react";
import { BarrasRanking } from "@/components/charts/BarrasRanking";
import { Cifra } from "@/components/ui/Cifra";
import { Estado } from "@/components/ui/Etiqueta";
import { useHogar } from "@/contexts/HogarContext";
import { useMoneda } from "@/hooks/useMoneda";
import { costoDeDeudas } from "@/lib/credito";
import { CostoReal } from "./components/CostoReal";
import { Conversor } from "./components/Conversor";
import { AbonoCapital } from "./components/AbonoCapital";
import { CompraCartera } from "./components/CompraCartera";
import { TarjetaCuotas } from "./components/TarjetaCuotas";

/**
 * Laboratorio de crédito: lo que de verdad cuestan sus deudas y las
 * herramientas para decidir mejor la próxima (traducir tasas, abonar,
 * comprar cartera, diferir con tarjeta). Todo calcula con sus datos; nada
 * recomienda un banco o un producto.
 */
export function Credito() {
  const { deudas, hogar } = useHogar();
  const { $ } = useMoneda();

  const costos = useMemo(() => costoDeDeudas(deudas), [deudas]);
  const conCosto = costos.filter((c) => !c.restante.estancado);
  const total = conCosto.reduce((s, c) => s + c.restante.intereses + c.restante.cargos, 0);
  const masCara = costos
    .filter((c) => c.efectivaEA !== null)
    .reduce<(typeof costos)[number] | null>((p, c) => (!p || (c.efectivaEA ?? 0) > (p.efectivaEA ?? 0) ? c : p), null);
  const usura = hogar?.tasa_usura ? Number(hogar.tasa_usura) : null;
  const superan = usura === null ? 0 : costos.filter((c) => c.pactadaEA > usura).length;
  const estancadas = costos.length - conCosto.length;

  return (
    <>
      <section className="panel hero heroGrid">
        <div className="heroCifras">
          <span className="eyebrow">Les falta pagar en intereses y cargos</span>
          <span className="heroNumero heroVio">
            <Cifra valor={total} formato={$} />
          </span>
          <span className="heroDetalle">
            Lo que cuestan sus deudas de aquí al final, solo pagando las cuotas: es la plata que
            se va al banco y no a ustedes.
          </span>
          <div className="heroChips">
            {masCara && (
              <Estado tono="neutro">
                La más cara: {masCara.deuda.nombre || "sin nombre"} ·{" "}
                {(masCara.efectivaEA ?? 0).toFixed(1).replace(".", ",")} % E.A. real
              </Estado>
            )}
            {usura !== null &&
              (superan > 0 ? (
                <Estado tono="crit">
                  {superan} {superan === 1 ? "supera" : "superan"} la usura
                </Estado>
              ) : (
                <Estado tono="ok">Todas bajo la usura</Estado>
              ))}
            {estancadas > 0 && (
              <Estado tono="crit">
                {estancadas} con cuota que no cubre intereses
              </Estado>
            )}
          </div>
        </div>
        <div className="heroGrafico">
          <span className="eyebrow">Intereses y cargos pendientes por deuda</span>
          {conCosto.length > 0 ? (
            <BarrasRanking
              filas={conCosto.map((c) => ({
                nombre: c.deuda.nombre || "Sin nombre",
                valor: c.restante.intereses + c.restante.cargos,
              }))}
              total={total}
              etiqueta="Intereses y cargos pendientes por deuda"
            />
          ) : (
            <p className="vacio">Sin deudas con intereses pendientes.</p>
          )}
        </div>
      </section>

      <CostoReal costos={costos} />
      <AbonoCapital />
      <CompraCartera />
      <TarjetaCuotas />
      <Conversor />
    </>
  );
}
