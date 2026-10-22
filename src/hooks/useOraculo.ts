import { useMemo } from "react";
import { useHogar } from "@/contexts/HogarContext";
import { useFinanzas } from "@/hooks/useFinanzas";
import { useMoneda } from "@/hooks/useMoneda";
import { useCategorias } from "@/hooks/useCategorias";
import { enMeses, porcentaje } from "@/lib/formato";
import { analizar, type Analisis } from "@/lib/oraculo";

const claveDescartados = (mes: string) => `cuentas-de-dos:oraculo-descartados:${mes}`;

export function mesLocal(fecha = new Date()): string {
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}`;
}

/** Consejos descartados este mes en este navegador. */
export function leerDescartados(mes = mesLocal()): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(claveDescartados(mes)) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}

export function guardarDescartados(valor: Set<string>, mes = mesLocal()) {
  try {
    localStorage.setItem(claveDescartados(mes), JSON.stringify([...valor]));
  } catch {
    // Sin almacenamiento la memoria dura solo esta visita.
  }
}

/**
 * El análisis del oráculo sobre los datos de hoy, compartido por todas las
 * pantallas que lo usan (el teseracto, el aviso del menú, el resumen, la
 * reunión), para que todas digan lo mismo.
 */
export function useOraculo(): Analisis {
  const { movimientos, gastos, ingresos, deudas, metas, activos, decisiones, hogar, idA, idB, nombreDe } = useHogar();
  const f = useFinanzas();
  const { $ } = useMoneda();
  const { etiqueta } = useCategorias();
  return useMemo(
    () =>
      analizar({
        f,
        movimientos,
        gastos,
        ingresos,
        deudas,
        metas,
        activos,
        decisiones,
        hogar,
        idA,
        idB,
        nombreDe,
        etiqueta,
        $,
        meses: enMeses,
        pct: (n) => porcentaje(n),
      }),
    [f, movimientos, gastos, ingresos, deudas, metas, activos, decisiones, hogar, idA, idB, nombreDe, etiqueta, $],
  );
}
