import { useState } from "react";
import { CampoMoneda } from "@/components/ui/CampoMoneda";
import { useHogar } from "@/contexts/HogarContext";
import { useMoneda } from "@/hooks/useMoneda";
import { MESES, hoyISO, nombrePeriodo } from "@/lib/formato";
import type { Accion } from "@/lib/oraculo";
import css from "../Sugerencias.module.css";

function finDeMes(mes: string): string {
  const [a, m] = mes.split("-").map(Number);
  return `${mes}-${String(new Date(a, m, 0).getDate()).padStart(2, "0")}`;
}

/**
 * Resuelve el consejo ahí mismo: asignar un aporte, poner días o meses de
 * pago, saldar el bote, sumar al colchón o pasar un aporte a otra meta. Cada
 * acción usa las mismas escrituras que el resto de la app, así que se
 * sincroniza en vivo con la otra persona.
 */
export function AccionConsejo({ accion }: { accion: Accion }) {
  const { metas, crear, editar } = useHogar();
  const { $ } = useMoneda();
  const [hecho, setHecho] = useState(false);
  const [valor, setValor] = useState(() =>
    accion.tipo === "aporte-meta" ? accion.sugerido : accion.tipo === "sumar-colchon" ? accion.monto : 0,
  );
  const [destino, setDestino] = useState(accion.tipo === "mover-aporte" ? (accion.opciones[0]?.id ?? "") : "");

  if (hecho) return <p className={css.hecho}>✓ Hecho. Ya quedó guardado.</p>;

  const listo = async (trabajo: Promise<unknown>) => {
    await trabajo;
    setHecho(true);
  };

  switch (accion.tipo) {
    case "aporte-meta":
      return (
        <div className={css.accion}>
          <span className={css.accionTexto}>Aportarle cada mes</span>
          <CampoMoneda className="campo" valor={valor} etiqueta="Aporte mensual" onCambio={setValor} />
          <button className="pill primaria" disabled={valor <= 0} onClick={() => void listo(editar("metas", accion.metaId, { aporte: valor }))}>
            Asignar aporte
          </button>
        </div>
      );

    case "sumar-colchon":
      return (
        <div className={css.accion}>
          <span className={css.accionTexto}>Si ya lo pasaron, súmenlo al colchón</span>
          <CampoMoneda className="campo" valor={valor} etiqueta="Monto que pasaron al colchón" onCambio={setValor} />
          <button
            className="pill primaria"
            disabled={valor <= 0}
            onClick={() => {
              const meta = metas.find((m) => m.id === accion.metaId);
              if (meta) void listo(editar("metas", meta.id, { acumulado: Number(meta.acumulado) + valor }));
            }}
          >
            Sumar al colchón
          </button>
        </div>
      );

    case "saldar-bote":
      return (
        <div className={css.accion}>
          <button
            className="pill primaria"
            onClick={() =>
              void listo(
                crear("movimientos", {
                  fecha: accion.mes === hoyISO().slice(0, 7) ? hoyISO() : finDeMes(accion.mes),
                  concepto: `Liquidación del bote · ${nombrePeriodo(`${accion.mes}-01`)}`,
                  categoria: "Otros",
                  monto: accion.monto,
                  clase: "transferencia",
                  pagado_por: accion.deudor,
                  compartido: false,
                  extraordinario: false,
                  origen: "manual",
                }),
              )
            }
          >
            Registrar: {accion.texto}
          </button>
        </div>
      );

    case "mover-aporte":
      return accion.opciones.length === 0 ? null : (
        <div className={css.accion}>
          <span className={css.accionTexto}>Pasar sus {$(accion.aporte)} al mes a</span>
          <select className="campo" value={destino} onChange={(e) => setDestino(e.target.value)} aria-label="Meta que recibe el aporte">
            {accion.opciones.map((o) => (
              <option key={o.id} value={o.id}>
                {o.nombre}
              </option>
            ))}
          </select>
          <button
            className="pill primaria"
            disabled={!destino}
            onClick={() => {
              const otra = metas.find((m) => m.id === destino);
              if (!otra) return;
              void listo(
                Promise.all([
                  editar("metas", otra.id, { aporte: Number(otra.aporte) + accion.aporte }),
                  editar("metas", accion.desdeId, { aporte: 0 }),
                ]),
              );
            }}
          >
            Pasar el aporte
          </button>
        </div>
      );

    case "dias-pago":
      return (
        <div className={css.accionLista}>
          {accion.deudas.map((d) => (
            <label key={d.id} className={css.accionFila}>
              <span>{d.nombre}</span>
              <input
                className="campo n"
                inputMode="numeric"
                placeholder="Día"
                aria-label={`Día de pago de ${d.nombre}`}
                style={{ maxWidth: 80 }}
                onBlur={(e) => {
                  const v = Math.round(Number(e.target.value));
                  if (v >= 1 && v <= 31) void editar("deudas", d.id, { dia_pago: v });
                }}
              />
            </label>
          ))}
          <span className={css.accionTexto}>Se guarda al salir de cada casilla.</span>
        </div>
      );

    case "meses-pago":
      return (
        <div className={css.accionLista}>
          {accion.gastos.map((g) => (
            <label key={g.id} className={css.accionFila}>
              <span>{g.concepto}</span>
              <select
                className="campo"
                defaultValue=""
                aria-label={`Mes de pago de ${g.concepto}`}
                onChange={(e) => e.target.value && void editar("gastos_presupuesto", g.id, { mes_pago: Number(e.target.value) })}
                style={{ maxWidth: 160 }}
              >
                <option value="">Elegir mes…</option>
                {MESES.map((m, i) => (
                  <option key={m} value={i + 1}>
                    {m.charAt(0).toUpperCase() + m.slice(1)}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      );
  }
}
