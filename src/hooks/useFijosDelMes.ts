import { useMemo } from "react";
import { useHogar } from "@/contexts/HogarContext";
import { fijosDelMes, type FijosDelMes } from "@/lib/fijos";
import { hoyISO } from "@/lib/formato";

/** Los gastos fijos que tocan en `periodo` ("YYYY-MM") y su estado de
 *  registro, recalculados solo cuando cambian el presupuesto o los movimientos. */
export function useFijosDelMes(periodo: string): FijosDelMes {
  const { gastos, movimientos } = useHogar();
  return useMemo(() => fijosDelMes(gastos, movimientos, periodo, hoyISO()), [gastos, movimientos, periodo]);
}
