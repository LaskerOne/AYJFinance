import { useState } from "react";
import { aEA, desdeEA, NOMBRE_FORMA, type FormaTasa } from "@/lib/credito";
import { aNumero } from "@/lib/formato";
import css from "../Credito.module.css";

const FORMAS: FormaTasa[] = ["ea", "mv", "nmv", "ntv"];

const EXPLICA: Record<FormaTasa, string> = {
  ea: "La que se usa para comparar: ya incluye el efecto de pagar intereses sobre intereses.",
  mv: "La que se cobra cada mes. La suelen anunciar las tarjetas y los préstamos de consumo.",
  nmv: "Es la mensual por 12, sin capitalizar. Se ve más baja que la E.A. equivalente.",
  ntv: "Usual en CDT y algunos créditos. Es la trimestral por 4, sin capitalizar.",
};

/**
 * Los bancos anuncian la misma tasa de cuatro maneras distintas y no todas
 * se pueden comparar a ojo. Se escribe en cualquier forma y se ven todas.
 */
export function Conversor() {
  const [valor, setValor] = useState(2);
  const [forma, setForma] = useState<FormaTasa>("mv");
  const ea = aEA(valor, forma);
  const todas = desdeEA(ea);

  return (
    <section className="panel">
      <header>
        <div>
          <h2>Traductor de tasas</h2>
          <p className="nota">
            «2 % mensual» y «26,8 % E.A.» son la misma tasa. Escriban la que les ofrecen, en la
            forma en que se la dijeron, y comparen siempre en E.A.
          </p>
        </div>
      </header>

      <div className={css.conversor}>
        <div className={css.entradaTasa}>
          <input
            className="campo n"
            inputMode="decimal"
            aria-label="Tasa ofrecida"
            defaultValue="2"
            onChange={(e) => setValor(aNumero(e.target.value))}
          />
          <span className={css.signoPct}>%</span>
          <select
            className="campo"
            aria-label="Forma de la tasa"
            value={forma}
            onChange={(e) => setForma(e.target.value as FormaTasa)}
          >
            {FORMAS.map((f) => (
              <option key={f} value={f}>
                {NOMBRE_FORMA[f]}
              </option>
            ))}
          </select>
        </div>

        <div className={css.formas}>
          {FORMAS.map((f) => (
            <div key={f} className={css.forma} data-principal={f === "ea"}>
              <span className="eyebrow">{NOMBRE_FORMA[f]}</span>
              <span className={`num ${css.formaValor}`}>
                {Number.isFinite(todas[f]) ? `${todas[f].toFixed(2).replace(".", ",")} %` : "—"}
              </span>
              <span className={css.formaExplica}>{EXPLICA[f]}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
