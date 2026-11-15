import { useMemo } from "react";
import { useHogar } from "@/contexts/HogarContext";
import { useFinanzas } from "@/hooks/useFinanzas";
import { recomendarAbono } from "@/lib/abonos";

/** La recomendación de abono a capital del oráculo para el hogar. */
export function useAbono() {
  const { deudas, hogar } = useHogar();
  const f = useFinanzas();
  const estrategia = hogar?.estrategia_deuda ?? "avalancha";
  return useMemo(
    () => recomendarAbono({ deudas, estrategia, libre: f.libre, mesesColchon: f.mesesColchon }),
    [deudas, estrategia, f.libre, f.mesesColchon],
  );
}
