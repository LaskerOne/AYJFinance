import { useCallback, useMemo } from "react";
import { useHogar } from "@/contexts/HogarContext";
import { useFinanzas } from "@/hooks/useFinanzas";
import { useMoneda } from "@/hooks/useMoneda";
import { useCategorias } from "@/hooks/useCategorias";
import { enMeses, porcentaje } from "@/lib/formato";
import { gastoMensual } from "@/lib/calculos";
import { analizar, evaluarDecision, type Analisis, type Evaluacion } from "@/lib/oraculo";
import type { Decision } from "@/models/dominio";

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

/**
 * Evalúa con los datos si una decisión adoptada del oráculo se cumplió.
 * Devuelve null para las decisiones escritas a mano.
 */
export function useEvaluarDecision(): (d: Decision) => Evaluacion | null {
  const { movimientos, gastos } = useHogar();
  const { $ } = useMoneda();
  const { etiqueta } = useCategorias();
  const analisis = useOraculo();
  const ids = useMemo(() => new Set(analisis.consejos.map((c) => c.id)), [analisis]);
  const presupuestoMes = useMemo(() => gastos.reduce((s, g) => s + gastoMensual(g), 0), [gastos]);
  return useCallback(
    (d: Decision) => evaluarDecision(d, { ids, movimientos, presupuestoMes, etiqueta, $ }),
    [ids, movimientos, presupuestoMes, etiqueta, $],
  );
}
