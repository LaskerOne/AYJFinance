import { useHogar } from "@/contexts/HogarContext";
import { leerDescartados, mesLocal, useOraculo } from "@/hooks/useOraculo";
import css from "./Layout.module.css";

/** Consejos urgentes que aún no han atendido: ni adoptados ni descartados. */
export function useUrgentes() {
  const { consejos } = useOraculo();
  const { decisiones } = useHogar();
  const mes = mesLocal();
  const descartados = leerDescartados(mes);
  const adoptados = new Set(decisiones.filter((d) => d.periodo.startsWith(mes)).map((d) => d.origen));
  return consejos.filter(
    (c) => (c.tono === "crit" || c.tono === "warn") && !descartados.has(c.id) && !adoptados.has(c.id),
  );
}

/** El puntito con el número en el menú: el oráculo tiene algo que decir. */
export function ContadorOraculo() {
  const n = useUrgentes().length;
  if (n === 0) return null;
  return (
    <span className={css.contador} aria-label={`${n} ${n === 1 ? "consejo urgente" : "consejos urgentes"}`}>
      {n}
    </span>
  );
}
