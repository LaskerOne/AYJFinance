import { BarraApilada, LeyendaSegmentos, type Segmento } from "@/components/charts/BarraApilada";
import { useHogar } from "@/contexts/HogarContext";
import { useMoneda } from "@/hooks/useMoneda";
import { porcentaje, porcentajeEntero } from "@/lib/formato";
import type { Finanzas } from "@/lib/calculos";
import css from "../Resumen.module.css";

const LEYENDA: Segmento[] = [
  { nombre: "Bote común", valor: 0, color: "--comun" },
  { nombre: "Gastos propios", valor: 0, color: "--s-gasto" },
  { nombre: "Cuotas propias", valor: 0, color: "--s-deuda" },
  { nombre: "Metas propias", valor: 0, color: "--s-ahorro" },
  { nombre: "Le queda", valor: 0, color: "--s-libre" },
];

/**
 * El reparto del bote común: la pregunta que de verdad distingue unas
 * finanzas de pareja de un presupuesto individual.
 */
export function RepartoBote({ finanzas: f }: { finanzas: Finanzas }) {
  const { hogar, cambiarHogar, perfiles, idA, nombreDe } = useHogar();
  const { $ } = useMoneda();

  const nombreA = perfiles.find((p) => p.id === idA) ? nombreDe(idA) : "Tú";
  const parejaId = perfiles.find((p) => p.id !== idA)?.id ?? null;
  const nombreB = parejaId ? nombreDe(parejaId) : "Tu pareja";
  const esMitad = hogar?.reparto === "mitad";

  const barra = (
    nombre: string,
    ingreso: number,
    bote: number,
    gasto: number,
    cuota: number,
    meta: number,
    queda: number,
  ) => {
    const segmentos: Segmento[] = [
      { nombre: "Bote común", valor: bote, color: "--comun" },
      { nombre: "Gastos propios", valor: gasto, color: "--s-gasto" },
      { nombre: "Cuotas propias", valor: cuota, color: "--s-deuda" },
      { nombre: "Metas propias", valor: meta, color: "--s-ahorro" },
      { nombre: "Le queda", valor: Math.max(0, queda), color: "--s-libre" },
    ];
    const base = Math.max(ingreso, bote + gasto + cuota + meta);
    return (
      <div className={css.barraPersona}>
        <div className={css.barraCabeza}>
          <span className={css.barraNombre}>{nombre}</span>
          <span className={css.barraResto}>
            Aporta <b className="num">{$(bote)}</b> · le queda <b className="num">{$(queda)}</b>{" "}
            ({porcentaje(ingreso > 0 ? queda / ingreso : 0)})
          </span>
        </div>
        <BarraApilada
          segmentos={segmentos}
          total={base}
          etiqueta={`Cómo se reparte el ingreso de ${nombre}`}
          conLeyenda={false}
        />
      </div>
    );
  };

  const mitad = f.bote / 2;
  const diferencia = Math.abs(f.boteA - mitad);
  const quienPoneMas = f.boteA > mitad ? nombreA : nombreB;

  const brechaA = f.ingresoA > 0 ? f.quedaA / f.ingresoA : 0;
  const brechaB = f.ingresoB > 0 ? f.quedaB / f.ingresoB : 0;
  const parejo = Math.abs(brechaA - brechaB) < 0.05;

  return (
    <>
      <div className={css.cabeceraReparto}>
        <div className={css.cifrasBote}>
          <span className={css.cifra}>
            <span className="eyebrow">Bote común del mes</span>
            <span className={css.cifraValor}>{$(f.bote)}</span>
          </span>
          <span className={css.cifra}>
            <span className="eyebrow">Pone {nombreA}</span>
            <span className={`${css.cifraValor} ${css.tonoA}`}>{$(f.boteA)}</span>
          </span>
          <span className={css.cifra}>
            <span className="eyebrow">Pone {nombreB}</span>
            <span className={`${css.cifraValor} ${css.tonoB}`}>{$(f.boteB)}</span>
          </span>
        </div>

        <div className="segmentado" role="group" aria-label="Forma de repartir">
          <button
            type="button"
            aria-pressed={!esMitad}
            onClick={() => void cambiarHogar({ reparto: "proporcional" })}
          >
            Proporcional al ingreso
          </button>
          <button
            type="button"
            aria-pressed={esMitad}
            onClick={() => void cambiarHogar({ reparto: "mitad" })}
          >
            Mitad y mitad
          </button>
        </div>
      </div>

      {barra(nombreA, f.ingresoA, f.boteA, f.gastoA, f.cuotaA, f.aporteA, f.quedaA)}
      {barra(nombreB, f.ingresoB, f.boteB, f.gastoB, f.cuotaB, f.aporteB, f.quedaB)}

      <LeyendaSegmentos segmentos={LEYENDA} conValores={false} />

      <div className={css.notaReparto}>
        <p>
          {f.bote <= 0 ? (
            <>
              Marca gastos, cuotas o metas como <b>Compartido</b> para armar el bote común.
            </>
          ) : esMitad ? (
            <>
              A mitad y mitad cada uno pone <span className={css.mn}>{$(mitad)}</span>. Con reparto
              proporcional {nombreA} pondría{" "}
              <span className={css.mn}>{$(f.bote * f.participacionA)}</span> y {nombreB}{" "}
              <span className={css.mn}>{$(f.bote * f.participacionB)}</span> — una diferencia de{" "}
              <span className={css.mn}>{$(Math.abs(f.bote * f.participacionA - mitad))}</span> al
              mes.
            </>
          ) : (
            <>
              Cada uno pone en proporción a lo que gana: {nombreA} el{" "}
              {porcentajeEntero(f.participacionA)} y {nombreB} el{" "}
              {porcentajeEntero(f.participacionB)}. Frente a mitad y mitad, {quienPoneMas} aporta{" "}
              <span className={css.mn}>{$(diferencia)}</span> más al mes.
            </>
          )}{" "}
          {parejo
            ? "A los dos les queda una proporción parecida de su ingreso: el reparto está equilibrado."
            : `A ${brechaA > brechaB ? nombreA : nombreB} le queda una proporción bastante mayor de su ingreso (${porcentaje(Math.max(brechaA, brechaB))} frente a ${porcentaje(Math.min(brechaA, brechaB))}).`}
        </p>
      </div>
    </>
  );
}
