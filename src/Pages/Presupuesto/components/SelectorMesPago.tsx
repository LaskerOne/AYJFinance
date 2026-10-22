import { MESES } from "@/lib/formato";
import type { Frecuencia } from "@/models/dominio";

/**
 * Mes en que se paga (o llega) algo que no es mensual. En lo mensual y
 * quincenal no aplica: pasa todos los meses. Para lo semestral, trimestral
 * y bimestral basta con uno de sus meses; la proyección calcula los demás.
 */
export function SelectorMesPago({
  frecuencia,
  valor,
  onCambio,
}: {
  frecuencia: Frecuencia;
  valor: number | null | undefined;
  onCambio: (mes: number | null) => void;
}) {
  if (frecuencia === "mensual" || frecuencia === "quincenal") {
    return <span style={{ color: "var(--ink-3)", paddingLeft: 8 }}>Todos</span>;
  }
  return (
    <select
      aria-label="Mes de pago"
      value={valor ?? ""}
      onChange={(e) => onCambio(e.target.value ? Number(e.target.value) : null)}
      style={valor ? undefined : { color: "var(--warn-ink)" }}
    >
      <option value="">Elegir…</option>
      {MESES.map((m, i) => (
        <option key={m} value={i + 1}>
          {m.charAt(0).toUpperCase() + m.slice(1)}
        </option>
      ))}
    </select>
  );
}
