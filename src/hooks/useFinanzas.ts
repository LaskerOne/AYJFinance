import { useMemo } from "react";
import { useHogar } from "@/contexts/HogarContext";
import { calcularFinanzas, type Finanzas } from "@/lib/calculos";

/** Los números derivados del presupuesto, recalculados solo cuando cambian
 *  los datos que los alimentan. */
export function useFinanzas(): Finanzas {
  const { ingresos, gastos, deudas, metas, idA, idB, hogar } = useHogar();

  return useMemo(
    () =>
      calcularFinanzas({
        ingresos,
        gastos,
        deudas,
        metas,
        idA,
        idB,
        reparto: hogar?.reparto ?? "proporcional",
      }),
    [ingresos, gastos, deudas, metas, idA, idB, hogar?.reparto],
  );
}
