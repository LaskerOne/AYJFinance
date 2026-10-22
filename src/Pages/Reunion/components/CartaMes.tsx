import { useMemo, useState } from "react";
import { useHogar } from "@/contexts/HogarContext";
import { useMoneda } from "@/hooks/useMoneda";
import { useCategorias } from "@/hooks/useCategorias";
import { useOraculo } from "@/hooks/useOraculo";
import { escribirCarta } from "@/lib/carta";
import { nombrePeriodo } from "@/lib/formato";
import css from "../Reunion.module.css";

/**
 * La carta del mes cerrado, para abrir la reunión: cómo les fue, contado en
 * prosa por el oráculo. Se puede copiar para mandarla por chat.
 */
export function CartaMes({ mes }: { mes: string }) {
  const { cierres, movimientos, decisiones, hogar } = useHogar();
  const { $ } = useMoneda();
  const { etiqueta } = useCategorias();
  const { consejos } = useOraculo();
  const [copiada, setCopiada] = useState(false);

  const ordenados = useMemo(() => [...cierres].sort((a, b) => (a.periodo < b.periodo ? -1 : 1)), [cierres]);
  const i = ordenados.findIndex((c) => c.periodo.startsWith(mes));
  const cierre = i >= 0 ? ordenados[i] : null;

  const carta = useMemo(
    () =>
      cierre
        ? escribirCarta({
            hogar: hogar?.nombre ?? "",
            cierre,
            anterior: i > 0 ? ordenados[i - 1] : null,
            movimientos: movimientos.filter((m) => m.fecha.startsWith(mes)),
            decisiones: decisiones.filter((d) => d.periodo.startsWith(mes)),
            consejo: consejos[0]?.titulo ?? null,
            etiqueta,
            $,
          })
        : null,
    [cierre, ordenados, i, movimientos, decisiones, consejos, hogar?.nombre, mes, etiqueta, $],
  );

  if (!carta) {
    return (
      <section className="panel">
        <header>
          <div>
            <h2>La carta de {nombrePeriodo(`${mes}-01`)}</h2>
            <p className="nota">
              Cuando cierren el mes (paso 3), el oráculo les escribe aquí cómo les fue.
            </p>
          </div>
        </header>
      </section>
    );
  }

  const copiar = async () => {
    const texto = [`${carta.titulo} · ${hogar?.nombre ?? ""}`.trim(), "", ...carta.parrafos, "", "— El oráculo de Cuentas de Dos"].join("\n\n");
    try {
      await navigator.clipboard.writeText(texto);
      setCopiada(true);
      window.setTimeout(() => setCopiada(false), 2500);
    } catch {
      // Sin permiso de portapapeles: no pasa nada, la carta sigue en pantalla.
    }
  };

  return (
    <section className={`panel ${css.carta}`}>
      <header>
        <div>
          <span className="eyebrow">Escrita por el oráculo con las cifras del cierre</span>
          <h2 className={css.cartaTitulo}>{carta.titulo}</h2>
        </div>
        <button className="pill" onClick={() => void copiar()}>
          {copiada ? "✓ Copiada" : "Copiar para compartir"}
        </button>
      </header>
      <div className={css.cartaCuerpo}>
        {hogar?.nombre && <p className={css.cartaSaludo}>Hola, {hogar.nombre}:</p>}
        {carta.parrafos.map((p, k) => (
          <p key={k} style={{ ["--i" as string]: String(k) }}>
            {p}
          </p>
        ))}
        <p className={css.cartaFirma}>— El oráculo</p>
      </div>
    </section>
  );
}
