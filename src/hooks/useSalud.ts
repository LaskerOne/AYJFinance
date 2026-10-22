import { useCallback, useMemo } from "react";
import { useHogar } from "@/contexts/HogarContext";
import { useFinanzas } from "@/hooks/useFinanzas";
import { resumenPatrimonio } from "@/lib/patrimonio";
import { puntajeSalud } from "@/lib/salud";
import { cerrarMes, guardarPuntaje } from "@/services/coleccion.service";

/** Finanzas, patrimonio y puntaje de salud de hoy, calculados una vez. */
export function useSalud() {
  const { activos, deudas } = useHogar();
  const f = useFinanzas();
  const resumen = useMemo(() => resumenPatrimonio(activos, deudas), [activos, deudas]);
  const puntaje = useMemo(() => puntajeSalud(f, resumen), [f, resumen]);
  return { f, resumen, puntaje };
}

/**
 * Cierra un mes (YYYY-MM) y deja en el cierre el puntaje de salud de hoy.
 * Lo usan el Histórico y la reunión mensual, para que cerrar sea igual en
 * los dos lados.
 */
export function useCerrarMes() {
  const { hogar, recargar } = useHogar();
  const { puntaje } = useSalud();
  return useCallback(
    async (mes: string) => {
      if (!hogar) return;
      const periodo = `${mes}-01`;
      await cerrarMes(hogar.id, periodo);
      await guardarPuntaje(hogar.id, periodo, puntaje.total);
      await recargar();
    },
    [hogar, recargar, puntaje.total],
  );
}
