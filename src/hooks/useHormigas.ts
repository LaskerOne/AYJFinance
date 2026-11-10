import { useMemo, useState } from "react";
import { useHogar } from "@/contexts/HogarContext";
import { hormigasPorMes } from "@/lib/habitos";

const CLAVE_UMBRAL = "cuentas-de-dos:umbral-hormiga";
const UMBRAL_INICIAL = 50_000;

function leerUmbral(): number {
  try {
    const v = Number(localStorage.getItem(CLAVE_UMBRAL));
    return v >= 10_000 && v <= 200_000 ? v : UMBRAL_INICIAL;
  } catch {
    return UMBRAL_INICIAL;
  }
}

/**
 * Los gastos hormiga mes a mes con el umbral que el hogar eligió en Hábitos.
 * Histórico lee el mismo umbral: si en Hábitos lo suben a 80 000, la serie
 * del histórico cuenta lo mismo y las dos pantallas no se contradicen.
 */
export function useHormigas() {
  const { movimientos, hogar } = useHogar();
  const [umbral, setUmbralEstado] = useState(leerUmbral);

  const setUmbral = (v: number) => {
    setUmbralEstado(v);
    try {
      localStorage.setItem(CLAVE_UMBRAL, String(v));
    } catch {
      // Sin almacenamiento el umbral igual aplica durante esta visita.
    }
  };

  const corte = hogar?.corte_ingresos ?? null;
  const serie = useMemo(
    () => hormigasPorMes(movimientos, umbral, corte),
    [movimientos, umbral, corte],
  );

  return { umbral, setUmbral, serie };
}
