import { useCallback, useMemo } from "react";
import { useHogar } from "@/contexts/HogarContext";
import { moneda, monedaCorta, formateador } from "@/lib/formato";

/** Formateadores ya atados a la moneda que eligió el hogar. */
export function useMoneda() {
  const { hogar } = useHogar();
  const codigo = hogar?.moneda ?? "COP";

  const $ = useCallback((valor: number) => moneda(valor, codigo), [codigo]);
  const $corto = useCallback((valor: number) => monedaCorta(valor, codigo), [codigo]);
  const plano = useMemo(() => formateador(codigo), [codigo]);

  return { codigo, $, $corto, plano };
}
