import type { Deuda, GastoPresupuesto, Movimiento, PendienteMes } from "@/models/dominio";
import { gastoMensual } from "@/lib/calculos";
import { mesContable } from "@/lib/contable";
import { fijosDelMes } from "@/lib/fijos";

/**
 * El plan de quincenas: responde "¿nos alcanza esta quincena?".
 *
 * El hogar cobra el 15 y a fin de mes. Con el corte de ingresos, el pago de
 * fin de mes cuenta para el mes siguiente y paga su primera quincena (días
 * 1–14); el pago de mitad de mes paga la segunda (del 15 al cierre). Este
 * módulo reparte los pagos del mes entre las dos quincenas por su día de
 * pago, estima el día a día y dice cuánto queda libre en cada una.
 */

export interface PagoQuincena {
  nombre: string;
  monto: number;
  /** Día del mes en que se paga; null = sin día definido (va a la primera). */
  dia: number | null;
  registrado: boolean;
}

export interface Quincena {
  /** "1" = días 1–14 · "2" = del 15 al fin de mes. */
  numero: 1 | 2;
  desde: string;
  hasta: string;
  /** Ingresos reales que la financian; si aún no llegan, el estimado. */
  ingreso: number;
  estimado: boolean;
  pagos: PagoQuincena[];
  totalPagos: number;
  /** Mercado, antojos y demás día a día, prorrateado por días. */
  diaADia: number;
  libre: number;
  /** Gasto real registrado con fecha dentro de la quincena. */
  gastado: number;
  actual: boolean;
}

export interface EntradaQuincenas {
  gastos: GastoPresupuesto[];
  deudas: Deuda[];
  movimientos: Movimiento[];
  pendientes: PendienteMes[];
  /** Ingreso mensual del presupuesto, ya mensualizado (f.ingreso). */
  ingresoPresupuesto: number;
  corte: number | null;
  /** "YYYY-MM" */
  periodo: string;
  /** "YYYY-MM-DD" */
  hoy: string;
}

export function planQuincenas(e: EntradaQuincenas): [Quincena, Quincena] {
  const [anio, mesN] = e.periodo.split("-").map(Number);
  const ultimo = new Date(anio, mesN, 0).getDate();
  const diaHoy = e.hoy.startsWith(e.periodo) ? Number(e.hoy.slice(8, 10)) : null;

  // --- los pagos del mes, con su día -------------------------------------
  const lista = fijosDelMes(e.gastos, e.movimientos, e.periodo, e.hoy);
  const pagos: PagoQuincena[] = lista.fijos.map((f) => ({
    nombre: f.gasto.concepto || f.gasto.categoria,
    monto: f.registrado ? Number(f.registrado.monto) : f.monto,
    dia: f.gasto.dia_pago ?? null,
    registrado: f.registrado !== null || f.parecido !== null,
  }));

  for (const d of e.deudas) {
    if (Number(d.saldo) <= 0.5 || Number(d.cuota) <= 0) continue;
    const extras = Number(d.seguro_mensual ?? 0) + Number(d.cuota_manejo ?? 0);
    pagos.push({
      nombre: `Cuota · ${d.nombre || "deuda"}`,
      monto: Number(d.cuota) + extras,
      dia: d.dia_pago ?? null,
      registrado: false,
    });
  }

  for (const p of e.pendientes) {
    if (!p.periodo.startsWith(e.periodo)) continue;
    pagos.push({
      nombre: p.concepto,
      monto: Number(p.monto),
      dia: null,
      registrado: e.movimientos.some((m) => m.pendiente_id === p.id),
    });
  }

  // --- los ingresos que financian cada quincena ---------------------------
  // El pago que viene del mes anterior (o de los primeros días) paga la
  // primera; el de mitad de mes (día 13 en adelante) paga la segunda.
  const delMes = e.movimientos.filter(
    (m) => m.clase === "ingreso" && mesContable(m, e.corte) === e.periodo,
  );
  let ingreso1 = 0;
  let ingreso2 = 0;
  for (const m of delMes) {
    const deAntes = m.fecha.slice(0, 7) < e.periodo;
    const dia = Number(m.fecha.slice(8, 10));
    if (deAntes || dia < 13) ingreso1 += Number(m.monto);
    else ingreso2 += Number(m.monto);
  }
  const mitad = e.ingresoPresupuesto / 2;
  const estimado1 = ingreso1 <= 0;
  const estimado2 = ingreso2 <= 0;

  // --- el día a día y el gasto real ---------------------------------------
  const variableMes = e.gastos
    .filter((g) => g.tipo === "variable")
    .reduce((s, g) => s + gastoMensual(g), 0);
  const dias1 = 14;
  const dias2 = ultimo - 14;

  const gastadoEn = (desdeDia: number, hastaDia: number) =>
    e.movimientos
      .filter((m) => {
        if (m.clase !== "gasto" || !m.fecha.startsWith(e.periodo)) return false;
        const d = Number(m.fecha.slice(8, 10));
        return d >= desdeDia && d <= hastaDia;
      })
      .reduce((s, m) => s + Number(m.monto), 0);

  const arma = (numero: 1 | 2): Quincena => {
    const [desdeDia, hastaDia] = numero === 1 ? [1, 14] : [15, ultimo];
    const propios = pagos.filter((p) =>
      numero === 1 ? p.dia === null || p.dia <= 14 : p.dia !== null && p.dia >= 15,
    );
    const totalPagos = propios.reduce((s, p) => s + p.monto, 0);
    const ingreso = numero === 1 ? (estimado1 ? mitad : ingreso1) : estimado2 ? mitad : ingreso2;
    const diaADia = variableMes * ((numero === 1 ? dias1 : dias2) / ultimo);
    return {
      numero,
      desde: `${e.periodo}-${String(desdeDia).padStart(2, "0")}`,
      hasta: `${e.periodo}-${String(hastaDia).padStart(2, "0")}`,
      ingreso,
      estimado: numero === 1 ? estimado1 : estimado2,
      pagos: propios.sort((x, y) => (x.dia ?? 0) - (y.dia ?? 0)),
      totalPagos,
      diaADia,
      libre: ingreso - totalPagos - diaADia,
      gastado: gastadoEn(desdeDia, hastaDia),
      actual: diaHoy !== null && diaHoy >= desdeDia && diaHoy <= hastaDia,
    };
  };

  return [arma(1), arma(2)];
}
