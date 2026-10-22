import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AreaGlow } from "@/components/charts/AreaGlow";
import { CampoMoneda } from "@/components/ui/CampoMoneda";
import { FilaKpi } from "@/components/ui/Kpi";
import { useHogar } from "@/contexts/HogarContext";
import { useMoneda } from "@/hooks/useMoneda";
import { compraConTarjeta } from "@/lib/credito";
import { aNumero, porcentaje } from "@/lib/formato";
import css from "../Credito.module.css";

/**
 * «¿A cuántas cuotas?» es la pregunta que más plata cuesta sin que se note.
 * Se ve lo que suma cada número de cuotas, para que diferir sea una decisión
 * y no un reflejo.
 */
export function TarjetaCuotas() {
  const { deudas } = useHogar();
  const { $ } = useMoneda();
  const tasaInicial = Math.max(25, ...deudas.map((d) => Number(d.tasa_ea)));

  // ?compra=N llega desde una respuesta del oráculo.
  const [params] = useSearchParams();
  const compraPedida = Number(params.get("compra"));
  const [monto, setMonto] = useState(compraPedida > 0 ? compraPedida : 1_000_000);
  const seccion = useRef<HTMLElement>(null);
  useEffect(() => {
    if (compraPedida > 0) seccion.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [compraPedida]);
  const [ea, setEa] = useState(Math.round(tasaInicial * 10) / 10);
  const [cuotas, setCuotas] = useState(12);

  const r = compraConTarjeta(monto, ea, cuotas);
  const curva = useMemo(
    () => Array.from({ length: 36 }, (_, i) => compraConTarjeta(monto, ea, i + 1).intereses),
    [monto, ea],
  );

  return (
    <section className="panel" ref={seccion}>
      <header>
        <div>
          <h2>Con tarjeta: ¿a cuántas cuotas?</h2>
          <p className="nota">
            A una cuota normalmente no hay intereses. Desde dos, se cobran sobre lo que queda
            debiendo cada mes. Así crece lo que pagan de más según el número de cuotas.
          </p>
        </div>
      </header>

      <div className={css.tarjetaEntrada}>
        <label className={css.campoLab}>
          <span className="eyebrow">Valor de la compra</span>
          <CampoMoneda className="campo" valor={monto} etiqueta="Valor de la compra" onCambio={setMonto} />
        </label>
        <label className={css.campoLab}>
          <span className="eyebrow">Tasa de la tarjeta (% E.A.)</span>
          <input
            className="campo n"
            inputMode="decimal"
            defaultValue={String(ea).replace(".", ",")}
            onChange={(e) => setEa(aNumero(e.target.value))}
          />
        </label>
        <label className={css.campoLab} style={{ flex: "2 1 260px" }}>
          <span className="eyebrow">
            Cuotas: <b className="num">{cuotas}</b>
          </span>
          <input
            type="range"
            min={1}
            max={36}
            step={1}
            value={cuotas}
            onChange={(e) => setCuotas(aNumero(e.target.value))}
            style={{ ["--lleno" as string]: `${((cuotas - 1) / 35) * 100}%` }}
          />
        </label>
      </div>

      <FilaKpi
        columnas={3}
        datos={[
          {
            etiqueta: "Pagan de más en intereses",
            valor: $(r.intereses),
            detalle: monto > 0 ? `${porcentaje(r.intereses / monto)} sobre el valor de la compra` : "",
            tono: r.intereses > 0 ? "negativo" : "positivo",
          },
          {
            etiqueta: "Primera cuota",
            valor: $(r.primeraCuota),
            detalle: cuotas > 1 ? `y va bajando hasta ${$(r.ultimaCuota)}` : "Un solo pago",
          },
          {
            etiqueta: "Total que pagan",
            valor: $(r.total),
            detalle: `por una compra de ${$(monto)}`,
          },
        ]}
      />

      <div style={{ marginTop: 18 }}>
        <span className="eyebrow">Intereses según el número de cuotas</span>
        <AreaGlow
          puntos={curva}
          etiqueta="Intereses totales de la compra de 1 a 36 cuotas"
          etiquetaX={(i) => `${i + 1} ${i === 0 ? "cuota" : "cuotas"}`}
          color="--a-ink"
          alto={170}
        />
      </div>
      <p className={css.pie}>
        Cálculo como lo liquida la mayoría de bancos en Colombia: abono fijo a capital más
        intereses sobre el saldo. Algunas tarjetas tienen cuotas fijas o promociones sin interés;
        revisen el extracto. Si la cuota de manejo depende de usar la tarjeta, súmenla aparte.
      </p>
    </section>
  );
}
