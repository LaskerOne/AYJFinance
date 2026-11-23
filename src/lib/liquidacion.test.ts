import { describe, expect, it } from "vitest";
import { finDeMes, liquidarMes, movimientoDeLiquidacion } from "@/lib/liquidacion";
import { movimiento } from "@/pruebas/fabricas";

const compartido = (pagado_por: string | null, monto: number) =>
  movimiento({ clase: "gasto", compartido: true, pagado_por, monto });
const transferencia = (pagado_por: string, monto: number) =>
  movimiento({ clase: "transferencia", pagado_por, monto });

describe("liquidarMes", () => {
  it("mitad y mitad: si A pagó más, B le debe la diferencia hasta la mitad", () => {
    const l = liquidarMes([compartido("a", 300_000), compartido("b", 100_000)], "a", "b", "mitad", 0.9);
    expect(l.parteA).toBe(0.5);
    expect(l.tocaA).toBe(200_000);
    expect(l.neto).toBe(100_000);
  });

  it("proporcional: lo que le toca a cada uno sigue su participación", () => {
    const l = liquidarMes([compartido("a", 300_000), compartido("b", 100_000)], "a", "b", "proporcional", 0.75);
    expect(l.tocaA).toBe(300_000);
    expect(l.neto).toBe(0);
  });

  it("una transferencia de B a A cancela la deuda de B", () => {
    const l = liquidarMes(
      [compartido("a", 300_000), compartido("b", 100_000), transferencia("b", 100_000)],
      "a",
      "b",
      "mitad",
      0.5,
    );
    expect(l.transferidoBA).toBe(100_000);
    expect(l.neto).toBe(0);
  });

  it("una transferencia de A a B la aumenta", () => {
    const l = liquidarMes([compartido("a", 200_000), transferencia("a", 50_000)], "a", "b", "mitad", 0.5);
    expect(l.neto).toBe(150_000);
  });

  it("cuenta aparte los compartidos sin quién los pagó y no los reparte", () => {
    const l = liquidarMes(
      [compartido("a", 100_000), compartido(null, 40_000), compartido("intruso", 10_000)],
      "a",
      "b",
      "mitad",
      0.5,
    );
    expect(l.totalCompartido).toBe(100_000);
    expect(l.sinAtribuir).toBe(2);
    expect(l.sinAtribuirMonto).toBe(50_000);
  });

  it("ignora gastos no compartidos e ingresos", () => {
    const l = liquidarMes(
      [
        movimiento({ clase: "gasto", compartido: false, pagado_por: "a", monto: 999 }),
        movimiento({ clase: "ingreso", compartido: true, pagado_por: "a", monto: 999 }),
      ],
      "a",
      "b",
      "mitad",
      0.5,
    );
    expect(l.totalCompartido).toBe(0);
    expect(l.neto).toBe(0);
  });
});

describe("finDeMes", () => {
  it("conoce la longitud de cada mes, incluido febrero bisiesto", () => {
    expect(finDeMes("2026-01")).toBe("2026-01-31");
    expect(finDeMes("2026-04")).toBe("2026-04-30");
    expect(finDeMes("2026-02")).toBe("2026-02-28");
    expect(finDeMes("2028-02")).toBe("2028-02-29");
    expect(finDeMes("2026-12")).toBe("2026-12-31");
  });
});

describe("movimientoDeLiquidacion", () => {
  const base = { deudor: "ana", monto: 150_000 };

  it("si se salda el mes en curso, lleva la fecha de hoy", () => {
    expect(movimientoDeLiquidacion({ ...base, mes: "2026-11", hoy: "2026-11-23" }).fecha).toBe("2026-11-23");
  });

  it("si se salda un mes pasado, queda en su último día para contar en ese mes", () => {
    expect(movimientoDeLiquidacion({ ...base, mes: "2026-10", hoy: "2026-11-23" }).fecha).toBe("2026-10-31");
    expect(movimientoDeLiquidacion({ ...base, mes: "2025-12", hoy: "2026-01-05" }).fecha).toBe("2025-12-31");
  });

  it("es una transferencia de quien debe: ni gasto, ni del bote, ni extraordinaria", () => {
    const m = movimientoDeLiquidacion({ ...base, mes: "2026-10", hoy: "2026-11-23" });
    expect(m).toMatchObject({
      clase: "transferencia",
      pagado_por: "ana",
      monto: 150_000,
      compartido: false,
      extraordinario: false,
      origen: "manual",
    });
    expect(m.concepto).toContain("Liquidación del bote");
  });
});
