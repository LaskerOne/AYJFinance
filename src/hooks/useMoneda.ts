import { useCallback, useEffect, useMemo, useState } from "react";
import { useHogar } from "@/contexts/HogarContext";
import { moneda, monedaCorta, formateador } from "@/lib/formato";
import { asegurarTasa, suscribirTasa, tasaUSD } from "@/services/tasas";

/**
 * Formateadores atados a la moneda que eligió el hogar.
 *
 * Los montos se guardan SIEMPRE en COP. Cuando el hogar elige USD, todo lo
 * que se muestra se divide por la tasa del día, y lo que se escribe en los
 * campos se multiplica de vuelta. Mientras no haya tasa (primera visita sin
 * red), se sigue mostrando COP para no inventar cifras.
 */
export function useMoneda() {
  const { hogar } = useHogar();
  const elegido = hogar?.moneda ?? "COP";

  const [tasa, setTasa] = useState<number | null>(tasaUSD);
  useEffect(() => {
    if (elegido !== "USD") return;
    void asegurarTasa();
    return suscribirTasa(setTasa);
  }, [elegido]);

  const convierte = elegido === "USD" && tasa !== null && tasa > 0;
  const codigo = convierte ? "USD" : "COP";

  /** De pesos (como se guardan) a la moneda visible. */
  const aVista = useCallback(
    (valor: number) => (convierte ? valor / tasa : valor),
    [convierte, tasa],
  );
  /** De la moneda visible a pesos, para guardar. */
  const aPesos = useCallback(
    (valor: number) => (convierte ? Math.round(valor * tasa) : valor),
    [convierte, tasa],
  );

  const $ = useCallback((valor: number) => moneda(aVista(valor), codigo), [aVista, codigo]);
  const $corto = useCallback(
    (valor: number) => monedaCorta(aVista(valor), codigo),
    [aVista, codigo],
  );
  const plano = useMemo(() => formateador(codigo), [codigo]);

  return { codigo, elegido, tasa, convierte, aVista, aPesos, $, $corto, plano };
}
