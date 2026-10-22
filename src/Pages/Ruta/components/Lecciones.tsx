import { useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useHogar } from "@/contexts/HogarContext";
import { useMoneda } from "@/hooks/useMoneda";
import type { Finanzas } from "@/lib/calculos";
import { compraConTarjeta, costoDeDeudas } from "@/lib/credito";
import { gastosHormiga } from "@/lib/habitos";
import { rentabilidad } from "@/lib/patrimonio";
import css from "../Ruta.module.css";

const CLAVE = "cuentas-de-dos:lecciones-vistas";

function leerVistas(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(CLAVE) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}

interface Leccion {
  id: string;
  nivel: number;
  titulo: string;
  idea: ReactNode;
  conSusNumeros: ReactNode;
  hacer: ReactNode;
}

/** Valor futuro de aportar `m` cada mes durante `anios` a una tasa anual real. */
function valorFuturo(m: number, anualPct: number, anios: number): number {
  const i = Math.pow(1 + anualPct / 100, 1 / 12) - 1;
  const n = anios * 12;
  return i === 0 ? m * n : m * ((Math.pow(1 + i, n) - 1) / i);
}

/**
 * Lecciones cortas donde el ejemplo son ellos: su deuda, su colchón, sus
 * gastos pequeños. Cada una se liga a un nivel de la ruta, y las del nivel
 * en que están salen marcadas. Lo visto se recuerda en este navegador.
 */
export function Lecciones({ f, actual, inflacion }: { f: Finanzas; actual: number; inflacion: number }) {
  const { deudas, movimientos, activos } = useHogar();
  const { $ } = useMoneda();
  const [vistas, setVistas] = useState(leerVistas);

  const marcar = (id: string) => {
    const nuevas = new Set(vistas).add(id);
    setVistas(nuevas);
    try {
      localStorage.setItem(CLAVE, JSON.stringify([...nuevas]));
    } catch {
      // Sin almacenamiento, se olvida al recargar: no pasa nada.
    }
  };

  const lecciones = useMemo<Leccion[]>(() => {
    const costos = costoDeDeudas(deudas).filter((c) => !c.restante.estancado);
    const interesesPendientes = costos.reduce((s, c) => s + c.restante.intereses + c.restante.cargos, 0);
    const tasaMax = Math.max(0, ...deudas.filter((d) => Number(d.saldo) > 0).map((d) => Number(d.tasa_ea)));
    const mejorActivo = Math.max(
      0,
      ...activos.map((a) => rentabilidad(a, inflacion)?.neta ?? 0),
    );
    const tasaAhorro = mejorActivo > 0 ? mejorActivo : 10;
    const mensual = f.libre > 0 ? f.libre : 200_000;
    const fondo = f.fondo > 0 ? f.fondo : 1_000_000;
    const hormiga = gastosHormiga(movimientos, 50_000);
    const imprevisto = compraConTarjeta(f.costoVida, tasaMax > 0 ? tasaMax : 28, 12);

    return [
      {
        id: "hormiga",
        nivel: 1,
        titulo: "Los gastos pequeños se miden al año",
        idea: <>Una compra de $20.000 no mueve nada. Repetida tres veces por semana es otra cosa: el cerebro no suma lo que es pequeño.</>,
        conSusNumeros:
          hormiga.mensual > 0 ? (
            <>
              Sus compras de hasta $50.000 promedian <b>{$(hormiga.mensual)}</b> al mes: <b>{$(hormiga.anual)}</b> al año.
            </>
          ) : (
            <>Todavía no hay suficientes movimientos para medirlo.</>
          ),
        hacer: (
          <>
            Decidan cuánto de eso vale la pena y miren a dónde llegaría el resto en <Link to="/habitos">Hábitos</Link>.
          </>
        ),
      },
      {
        id: "colchon-primero",
        nivel: 2,
        titulo: "Por qué el colchón va antes que todo",
        idea: <>Sin colchón, cualquier imprevisto se paga con tarjeta. Y la tarjeta convierte un problema de un mes en uno de un año.</>,
        conSusNumeros: (
          <>
            Un imprevisto del tamaño de un mes de su vida (<b>{$(f.costoVida)}</b>) pagado con tarjeta a 12 cuotas
            {tasaMax > 0 ? ` a su tasa más alta (${String(tasaMax).replace(".", ",")} %)` : " al 28 %"} les costaría{" "}
            <b>{$(imprevisto.intereses)}</b> solo en intereses.
          </>
        ),
        hacer: <>Junten primero un mes de gastos en una cuenta aparte, aunque las otras metas esperen.</>,
      },
      {
        id: "compuesto-contra",
        nivel: 3,
        titulo: "El interés compuesto, en contra",
        idea: <>Una deuda cobra intereses sobre lo que se debe; mientras más se tarda en pagar, más intereses paga cada peso.</>,
        conSusNumeros:
          interesesPendientes > 0 ? (
            <>
              Solo pagando las cuotas, le entregarán a los bancos <b>{$(interesesPendientes)}</b> más en intereses y cargos.
            </>
          ) : (
            <>Hoy no tienen intereses pendientes. Esa es la mejor posición posible.</>
          ),
        hacer: (
          <>
            Cada peso extra a la deuda más cara rinde su tasa, garantizado. Vean cuánto en el{" "}
            <Link to="/credito">Laboratorio de crédito</Link>.
          </>
        ),
      },
      {
        id: "regla-72",
        nivel: 3,
        titulo: "La regla del 72",
        idea: <>Dividan 72 por la tasa anual y les da, aproximadamente, en cuántos años se duplica algo. Sirve para la plata que crece y para la que se debe.</>,
        conSusNumeros: (
          <>
            {tasaMax > 0 && (
              <>
                Una deuda al {String(tasaMax).replace(".", ",")} % que no se paga se duplica en unos{" "}
                <b>{(72 / tasaMax).toFixed(1).replace(".", ",")} años</b>.{" "}
              </>
            )}
            Una inversión al {tasaAhorro.toFixed(1).replace(".", ",")} % neto se duplica en unos{" "}
            <b>{(72 / tasaAhorro).toFixed(1).replace(".", ",")} años</b>.
          </>
        ),
        hacer: <>Usen el 72 para preguntarle a cualquier oferta: ¿en cuánto tiempo se duplica, a favor o en contra?</>,
      },
      {
        id: "inflacion",
        nivel: 4,
        titulo: "La inflación se come lo que no rinde",
        idea: <>La plata quieta no pierde pesos, pierde lo que puede comprar. Por eso el colchón también debe rendir algo.</>,
        conSusNumeros: (
          <>
            {$(fondo)} guardados sin rendimiento, con inflación del {String(inflacion).replace(".", ",")} %, en cinco años
            comprarían lo que hoy compran <b>{$(fondo / Math.pow(1 + inflacion / 100, 5))}</b>.
          </>
        ),
        hacer: (
          <>
            Tengan el colchón en una cuenta de alto rendimiento o un fondo a la vista: disponible y ganándole algo a la inflación.
            Comparen en <Link to="/patrimonio">Patrimonio</Link>.
          </>
        ),
      },
      {
        id: "compuesto-favor",
        nivel: 5,
        titulo: "El interés compuesto, a favor",
        idea: <>Lo que más pesa al invertir no es la tasa: es el tiempo. Los rendimientos generan sus propios rendimientos.</>,
        conSusNumeros: (
          <>
            Invertir {$(mensual)} al mes a un 4 % real llega a <b>{$(valorFuturo(mensual, 4, 10))}</b> en 10 años,{" "}
            <b>{$(valorFuturo(mensual, 4, 20))}</b> en 20 y <b>{$(valorFuturo(mensual, 4, 30))}</b> en 30, en pesos de hoy.
          </>
        ),
        hacer: <>Empiecen pronto aunque sea poco: diez años de ventaja valen más que duplicar el aporte después.</>,
      },
    ];
  }, [deudas, movimientos, activos, f, inflacion, $]);

  return (
    <div className={css.lecciones}>
      {lecciones.map((l) => {
        const suya = l.nivel === actual;
        return (
          <details key={l.id} className={css.leccion} data-suya={suya} onToggle={(e) => e.currentTarget.open && marcar(l.id)}>
            <summary className={css.leccionCabeza}>
              <span className={css.leccionFlecha} aria-hidden="true">▸</span>
              <span className={css.leccionTitulo}>{l.titulo}</span>
              {suya && <span className={css.leccionSuya}>Para su nivel</span>}
              {vistas.has(l.id) && <span className={css.leccionVista}>Vista</span>}
            </summary>
            <div className={css.leccionCuerpo}>
              <p>{l.idea}</p>
              <p className={css.leccionNumeros}>
                <span className="eyebrow">Con sus números</span>
                {l.conSusNumeros}
              </p>
              <p className={css.leccionHacer}>{l.hacer}</p>
            </div>
          </details>
        );
      })}
    </div>
  );
}
