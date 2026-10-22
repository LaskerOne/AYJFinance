import { useMemo, useState } from "react";
import { CampoMoneda } from "@/components/ui/CampoMoneda";
import { Estado } from "@/components/ui/Etiqueta";
import { useHogar } from "@/contexts/HogarContext";
import { useFinanzas } from "@/hooks/useFinanzas";
import { useMoneda } from "@/hooks/useMoneda";
import { calcularFinanzas, type Finanzas } from "@/lib/calculos";
import { simularDeudas } from "@/lib/deudas";
import { aNumero, enMeses, porcentaje } from "@/lib/formato";
import type { GastoPresupuesto, Ingreso } from "@/models/dominio";
import css from "../Proyeccion.module.css";

/**
 * "¿Y si…?": se cambian supuestos (falta un ingreso, sube el arriendo,
 * inflación, un gasto o un ingreso nuevo) y se recalcula todo con el mismo
 * motor del resto de la aplicación. Nada de esto se guarda: es para ensayar.
 */
export function Escenarios() {
  const { ingresos, gastos, deudas, metas, idA, idB, hogar, nombreDe } = useHogar();
  const hoy = useFinanzas();
  const { $ } = useMoneda();

  const [sinIngresoDe, setSinIngresoDe] = useState<string | null>(null);
  const [vivienda, setVivienda] = useState(0);
  const [inflacion, setInflacion] = useState(0);
  const [gastoNuevo, setGastoNuevo] = useState(0);
  const [ingresoExtra, setIngresoExtra] = useState(0);

  const reparto = hogar?.reparto ?? "proporcional";
  const estrategia = hogar?.estrategia_deuda ?? "avalancha";
  const abono = Number(hogar?.abono_extra ?? 0);
  const tocado = sinIngresoDe || vivienda || inflacion || gastoNuevo || ingresoExtra;

  const esc: Finanzas = useMemo(() => {
    const ing: Ingreso[] = ingresos.filter((i) => !sinIngresoDe || i.usuario_id !== sinIngresoDe);
    if (ingresoExtra > 0) {
      ing.push({ id: "esc-ingreso", hogar_id: "", usuario_id: null, concepto: "Ingreso del escenario", monto: ingresoExtra, frecuencia: "mensual", orden: 0, creado_en: "" });
    }
    const gas: GastoPresupuesto[] = gastos.map((g) => {
      let monto = Number(g.monto);
      if (g.categoria === "Vivienda") monto *= 1 + vivienda / 100;
      monto *= 1 + inflacion / 100;
      return { ...g, monto };
    });
    if (gastoNuevo > 0) {
      gas.push({ id: "esc-gasto", hogar_id: "", usuario_id: null, categoria: "Otros", concepto: "Gasto del escenario", monto: gastoNuevo, frecuencia: "mensual", tipo: "fijo", orden: 0, creado_en: "" });
    }
    return calcularFinanzas({ ingresos: ing, gastos: gas, deudas, metas, idA, idB, reparto });
  }, [ingresos, gastos, deudas, metas, idA, idB, reparto, sinIngresoDe, vivienda, inflacion, gastoNuevo, ingresoExtra]);

  const planHoy = useMemo(() => simularDeudas(deudas, abono, estrategia, true), [deudas, abono, estrategia]);
  const planEsc = useMemo(
    () => simularDeudas(deudas, esc.disponible < 0 ? 0 : abono, estrategia, true),
    [deudas, abono, estrategia, esc.disponible],
  );
  const hayDeuda = deudas.some((d) => Number(d.saldo) > 0);

  const aguanta = (f: Finanzas) => (f.disponible >= 0 ? Infinity : f.fondo / -f.disponible);
  const textoAguanta = (f: Finanzas) => {
    const m = aguanta(f);
    return Number.isFinite(m) ? enMeses(Math.floor(m)) : "No hace falta";
  };

  const filas: Array<{ nombre: string; hoy: string; esc: string; peor: boolean }> = [
    {
      nombre: "Entra al mes",
      hoy: $(hoy.ingreso),
      esc: $(esc.ingreso),
      peor: esc.ingreso < hoy.ingreso,
    },
    {
      nombre: "Costo de vida (gastos + cuotas)",
      hoy: $(hoy.costoVida),
      esc: $(esc.costoVida),
      peor: esc.costoVida > hoy.costoVida,
    },
    {
      nombre: "Queda después de gastos y cuotas",
      hoy: $(hoy.disponible),
      esc: $(esc.disponible),
      peor: esc.disponible < hoy.disponible,
    },
    {
      nombre: "Endeudamiento",
      hoy: hoy.ingreso > 0 ? porcentaje(hoy.cuotas / hoy.ingreso) : "—",
      esc: esc.ingreso > 0 ? porcentaje(esc.cuotas / esc.ingreso) : "—",
      peor: esc.ingreso < hoy.ingreso,
    },
    {
      nombre: "Si falta plata, el colchón aguanta",
      hoy: textoAguanta(hoy),
      esc: textoAguanta(esc),
      peor: aguanta(esc) < aguanta(hoy),
    },
    ...(hayDeuda
      ? [
          {
            nombre: "Libres de deudas en",
            hoy: planHoy.estancado ? "Nunca" : enMeses(planHoy.meses),
            esc: planEsc.estancado ? "Nunca" : enMeses(planEsc.meses),
            peor: planEsc.meses > planHoy.meses || (planEsc.estancado && !planHoy.estancado),
          },
        ]
      : []),
  ];

  const veredicto =
    esc.disponible < 0 ? (
      <>
        <Estado tono="crit">Faltaría plata</Estado> En ese escenario saldrían{" "}
        <b>{$(-esc.disponible)}</b> más de lo que entra cada mes.{" "}
        {Number.isFinite(aguanta(esc))
          ? `Con el colchón actual aguantarían ${enMeses(Math.floor(aguanta(esc)))}.`
          : ""}{" "}
        Lo que protege aquí es el fondo de emergencia.
      </>
    ) : (
      <>
        <Estado tono={esc.disponible < hoy.disponible ? "warn" : "ok"}>
          {esc.disponible < hoy.disponible ? "Se aprieta" : "Se sostiene"}
        </Estado>{" "}
        Seguirían con <b>{$(esc.disponible)}</b> al mes después de gastos y cuotas
        {esc.disponible !== hoy.disponible && (
          <> ({esc.disponible < hoy.disponible ? "−" : "+"}{$(Math.abs(esc.disponible - hoy.disponible)).replace("−", "")} frente a hoy)</>
        )}
        .
      </>
    );

  return (
    <section className="panel">
      <header>
        <div>
          <h2>¿Y si…?</h2>
          <p className="nota">
            Ensayen lo que podría pasar y miren cómo cambia todo. No se guarda nada: es para
            prepararse, no para preocuparse.
          </p>
        </div>
        {tocado ? (
          <button
            className="pill ghost"
            onClick={() => {
              setSinIngresoDe(null);
              setVivienda(0);
              setInflacion(0);
              setGastoNuevo(0);
              setIngresoExtra(0);
            }}
          >
            Volver a hoy
          </button>
        ) : null}
      </header>

      <div className={css.escenario}>
        <div className={css.supuestos}>
          <div className={css.supuesto}>
            <span className="eyebrow">Si falta un ingreso</span>
            <div className="segmentado" role="group" aria-label="Ingreso que falta">
              {[
                { id: null, texto: "Ninguno" },
                { id: idA, texto: nombreDe(idA) },
                ...(idB ? [{ id: idB, texto: nombreDe(idB) }] : []),
              ].map((o) => (
                <button
                  key={o.id ?? "ninguno"}
                  type="button"
                  aria-pressed={sinIngresoDe === o.id}
                  onClick={() => setSinIngresoDe(o.id)}
                >
                  {o.texto}
                </button>
              ))}
            </div>
          </div>

          <label className={css.supuesto}>
            <span className="eyebrow">
              Sube la vivienda <b className="num">{vivienda} %</b>
            </span>
            <input
              type="range"
              min={0}
              max={40}
              step={1}
              value={vivienda}
              onChange={(e) => setVivienda(aNumero(e.target.value))}
              style={{ ["--lleno" as string]: `${(vivienda / 40) * 100}%` }}
            />
          </label>

          <label className={css.supuesto}>
            <span className="eyebrow">
              Inflación en todos los gastos <b className="num">{inflacion} %</b>
            </span>
            <input
              type="range"
              min={0}
              max={20}
              step={1}
              value={inflacion}
              onChange={(e) => setInflacion(aNumero(e.target.value))}
              style={{ ["--lleno" as string]: `${(inflacion / 20) * 100}%` }}
            />
          </label>

          <label className={css.supuesto}>
            <span className="eyebrow">Gasto nuevo al mes (carro, hijo, mascota…)</span>
            <CampoMoneda className="campo" valor={gastoNuevo} etiqueta="Gasto nuevo al mes" onCambio={setGastoNuevo} />
          </label>

          <label className={css.supuesto}>
            <span className="eyebrow">Ingreso extra al mes (aumento, independiente…)</span>
            <CampoMoneda className="campo" valor={ingresoExtra} etiqueta="Ingreso extra al mes" onCambio={setIngresoExtra} />
          </label>
        </div>

        <div className={css.resultado}>
          <p className={css.veredicto}>{veredicto}</p>
          <table className={css.comparacion}>
            <thead>
              <tr>
                <th />
                <th>Hoy</th>
                <th>Con el escenario</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((fila) => (
                <tr key={fila.nombre}>
                  <td>{fila.nombre}</td>
                  <td className="num">{fila.hoy}</td>
                  <td className="num" data-cambia={fila.hoy !== fila.esc} data-peor={fila.peor}>
                    {fila.esc}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
