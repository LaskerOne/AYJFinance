import { useMemo } from "react";
import { BarraApilada } from "@/components/charts/BarraApilada";
import { Cifra } from "@/components/ui/Cifra";
import { Estado } from "@/components/ui/Etiqueta";
import { useHogar } from "@/contexts/HogarContext";
import { useFinanzas } from "@/hooks/useFinanzas";
import { useMoneda } from "@/hooks/useMoneda";
import { resumenPatrimonio } from "@/lib/patrimonio";
import { NOMBRE_GRUPO } from "@/models/dominio";
import { TablaActivos } from "./components/TablaActivos";
import { RentaReal } from "./components/RentaReal";
import { Futuro } from "./components/Futuro";
import { PorHorizonte } from "./components/PorHorizonte";

/** Supuesto mientras el hogar no guarde la inflación de referencia. */
const INFLACION_SUPUESTA = 5;

/**
 * Patrimonio: lo que tienen menos lo que deben, cuánto rinde de verdad lo
 * que tienen, hacia dónde va, y dónde conviene guardar la plata de cada
 * meta. Es la pantalla que conecta el día a día con el largo plazo.
 */
export function Patrimonio() {
  const { activos, deudas, hogar } = useHogar();
  const f = useFinanzas();
  const { $ } = useMoneda();

  const r = useMemo(() => resumenPatrimonio(activos, deudas), [activos, deudas]);
  const inflacion = hogar?.inflacion_ref ? Number(hogar.inflacion_ref) : INFLACION_SUPUESTA;
  const supuesta = !hogar?.inflacion_ref;
  const mesesLiquido = f.costoVida > 0 ? r.porGrupo.liquido / f.costoVida : 0;

  return (
    <>
      <section className="panel hero heroGrid">
        <div className="heroCifras">
          <span className="eyebrow">Patrimonio neto</span>
          <span className={`heroNumero ${r.neto >= 0 ? "heroPos" : "heroNeg"}`}>
            <Cifra valor={r.neto} formato={$} />
          </span>
          <span className="heroDetalle">
            Lo que tienen menos lo que deben. Es la cifra que, mes a mes, dice si de verdad están
            avanzando.
          </span>
          <div className="heroChips">
            <Estado tono="neutro">Tienen {$(r.activos)}</Estado>
            <Estado tono="neutro">Deben {$(r.deudas)}</Estado>
            {activos.length > 0 && (
              <Estado tono={mesesLiquido >= 3 ? "ok" : mesesLiquido >= 1 ? "warn" : "crit"}>
                Lo disponible cubre {mesesLiquido.toFixed(1).replace(".", ",")} meses
              </Estado>
            )}
          </div>
        </div>
        <div className="heroGrafico">
          <span className="eyebrow">Cómo está compuesto lo que tienen</span>
          {r.activos > 0 ? (
            <BarraApilada
              segmentos={[
                { nombre: NOMBRE_GRUPO.liquido, valor: r.porGrupo.liquido, color: "--s-ahorro" },
                { nombre: NOMBRE_GRUPO.invertido, valor: r.porGrupo.invertido, color: "--a" },
                { nombre: NOMBRE_GRUPO.retiro, valor: r.porGrupo.retiro, color: "--b" },
                { nombre: NOMBRE_GRUPO.bienes, valor: r.porGrupo.bienes, color: "--s-libre" },
              ].filter((s) => s.valor > 0)}
              total={r.activos}
              alto={18}
              etiqueta="Activos por grupo"
            />
          ) : (
            <p className="vacio">
              Registren abajo lo que tienen: cuentas, inversiones, cesantías, pensión y bienes.
            </p>
          )}
        </div>
      </section>

      <TablaActivos />
      <RentaReal inflacion={inflacion} supuesta={supuesta} />
      <Futuro inflacion={inflacion} />
      <PorHorizonte />
    </>
  );
}
