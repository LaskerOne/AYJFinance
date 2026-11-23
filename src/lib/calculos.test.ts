import { describe, expect, it } from "vitest";
import {
  calcularFinanzas,
  esGastoCorriente,
  esGastoExtraordinario,
  esGastoNoPlaneado,
  gastoMensual,
  ingresoMensual,
  totalesPorClase,
  type EntradaCalculo,
} from "@/lib/calculos";
import { deuda, gasto, ingreso, meta, movimiento } from "@/pruebas/fabricas";

describe("mensualización", () => {
  it("un ingreso quincenal vale el doble al mes", () => {
    expect(ingresoMensual({ monto: 2_000_000, frecuencia: "quincenal" })).toBe(4_000_000);
  });

  it("un seguro semestral de 600.000 cuenta como 100.000 al mes", () => {
    expect(gastoMensual({ monto: 600_000, frecuencia: "semestral" })).toBeCloseTo(100_000);
  });

  it("acepta montos que Postgres entrega como texto (numeric)", () => {
    // supabase-js devuelve `numeric` como string; el tipo dice number.
    expect(gastoMensual({ monto: "1200000" as unknown as number, frecuencia: "anual" })).toBeCloseTo(100_000);
  });
});

/**
 * Hogar de referencia: A gana 6 M, B gana 3 M (A aporta 2/3).
 * Común: arriendo 2 M, ocio 600 mil, una deuda de 500 mil de cuota y un
 * fondo de emergencia que recibe 400 mil. Cada uno tiene un gasto propio.
 */
function hogar(sobre: Partial<EntradaCalculo> = {}): EntradaCalculo {
  return {
    idA: "a",
    idB: "b",
    reparto: "proporcional",
    ingresos: [
      ingreso({ usuario_id: "a", monto: 6_000_000 }),
      ingreso({ usuario_id: "b", monto: 3_000_000 }),
    ],
    gastos: [
      gasto({ categoria: "Vivienda", monto: 2_000_000, tipo: "fijo" }),
      gasto({ categoria: "Ocio", monto: 600_000 }),
      gasto({ usuario_id: "a", categoria: "Personal", monto: 300_000 }),
      gasto({ usuario_id: "b", categoria: "Transporte", monto: 1_200_000, frecuencia: "semestral", tipo: "fijo" }),
    ],
    deudas: [deuda({ saldo: 10_000_000, cuota: 500_000 })],
    metas: [meta({ es_emergencia: true, aporte: 400_000, acumulado: 3_600_000, objetivo: 21_600_000 })],
    ...sobre,
  };
}

describe("calcularFinanzas", () => {
  it("suma ingresos y mide la participación de cada uno", () => {
    const f = calcularFinanzas(hogar());
    expect(f.ingreso).toBe(9_000_000);
    expect(f.participacionA).toBeCloseTo(2 / 3);
    expect(f.participacionB).toBeCloseTo(1 / 3);
  });

  it("mensualiza los gastos antes de sumarlos y separa fijos de variables", () => {
    const f = calcularFinanzas(hogar());
    expect(f.gastos).toBeCloseTo(3_100_000);
    expect(f.gastosFijos).toBeCloseTo(2_200_000);
    expect(f.gastosVariables).toBeCloseTo(900_000);
    expect(f.gastoComun).toBe(2_600_000);
    expect(f.gastoA).toBe(300_000);
    expect(f.gastoB).toBeCloseTo(200_000);
  });

  it("ordena las categorías de mayor a menor y omite las vacías", () => {
    const f = calcularFinanzas(hogar());
    expect(f.porCategoria.map((c) => c.categoria)).toEqual(["Vivienda", "Ocio", "Personal", "Transporte"]);
  });

  it("calcula disponible, libre y tasa de ahorro", () => {
    const f = calcularFinanzas(hogar());
    expect(f.disponible).toBeCloseTo(5_400_000);
    expect(f.libre).toBeCloseTo(5_000_000);
    expect(f.tasaAhorro).toBeCloseTo(0.6);
  });

  it("reparte el bote común en proporción al ingreso", () => {
    const f = calcularFinanzas(hogar());
    expect(f.bote).toBe(3_500_000);
    expect(f.boteA).toBeCloseTo(3_500_000 * (2 / 3));
    expect(f.boteB).toBeCloseTo(3_500_000 / 3);
  });

  it("con reparto mitad y mitad el bote se parte igual sin importar el ingreso", () => {
    const f = calcularFinanzas(hogar({ reparto: "mitad" }));
    expect(f.boteA).toBe(1_750_000);
    expect(f.boteB).toBe(1_750_000);
  });

  it.each(["proporcional", "mitad"] as const)(
    "lo que le queda a cada uno suma exactamente lo libre del hogar (reparto %s)",
    (reparto) => {
      // Invariante: el reparto mueve plata entre los dos, nunca la crea ni la pierde.
      const f = calcularFinanzas(hogar({ reparto }));
      expect(f.quedaA + f.quedaB).toBeCloseTo(f.libre);
    },
  );

  it("mide el colchón en meses de costo de vida", () => {
    const f = calcularFinanzas(hogar());
    expect(f.costoVida).toBeCloseTo(3_600_000);
    expect(f.fondo).toBe(3_600_000);
    expect(f.fondoObjetivo).toBe(21_600_000);
    expect(f.mesesColchon).toBeCloseTo(1);
  });

  it("sin ingresos no divide por cero", () => {
    const f = calcularFinanzas(hogar({ ingresos: [] }));
    expect(f.participacionA).toBe(0.5);
    expect(f.tasaAhorro).toBe(0);
    expect(f.regla.necesidades.fraccion).toBe(0);
  });

  it("sin pareja unida, los ingresos con usuario_id ajeno no se atribuyen a B", () => {
    const f = calcularFinanzas(hogar({ idB: null }));
    expect(f.ingresoB).toBe(0);
    expect(f.participacionA).toBe(1);
  });
});

describe("regla 50/30/20", () => {
  const conGastos = (...gastos: Parameters<typeof gasto>[0][]) =>
    calcularFinanzas({
      idA: "a",
      idB: null,
      reparto: "proporcional",
      ingresos: [ingreso({ usuario_id: "a", monto: 1_000_000 })],
      gastos: gastos.map((g) => gasto(g)),
      deudas: [],
      metas: [],
    }).regla;

  it("necesidades hasta 50 % están bien", () => {
    expect(conGastos({ categoria: "Vivienda", monto: 500_000 }).necesidades.estado).toBe("ok");
  });

  it("necesidades hasta 20 % por encima del objetivo son advertencia", () => {
    expect(conGastos({ categoria: "Vivienda", monto: 550_000 }).necesidades.estado).toBe("warn");
  });

  it("necesidades más allá de eso son críticas", () => {
    expect(conGastos({ categoria: "Vivienda", monto: 650_000 }).necesidades.estado).toBe("crit");
  });

  it("los gustos son todo lo no esencial", () => {
    const r = conGastos({ categoria: "Vivienda", monto: 400_000 }, { categoria: "Ocio", monto: 250_000 });
    expect(r.gustos.valor).toBe(250_000);
    expect(r.gustos.estado).toBe("ok");
  });

  it("un ahorro entre la mitad del objetivo y el objetivo es advertencia; menos, crítico", () => {
    expect(conGastos({ categoria: "Vivienda", monto: 850_000 }).ahorro.estado).toBe("warn");
    expect(conGastos({ categoria: "Vivienda", monto: 950_000 }).ahorro.estado).toBe("crit");
  });
});

describe("clases de gasto", () => {
  const corriente = movimiento({ clase: "gasto", extraordinario: false });
  const extra = movimiento({ clase: "gasto", extraordinario: true });
  const deFijo = movimiento({ clase: "gasto", gasto_id: "g1" });
  const dePendiente = movimiento({ clase: "gasto", pendiente_id: "p1" });
  const entrada = movimiento({ clase: "ingreso" });
  const traslado = movimiento({ clase: "transferencia" });

  it("corriente y extraordinario se excluyen entre sí y solo aplican a gastos", () => {
    for (const m of [corriente, extra, deFijo, dePendiente, entrada, traslado]) {
      expect(esGastoCorriente(m) && esGastoExtraordinario(m)).toBe(false);
      if (m.clase !== "gasto") {
        expect(esGastoCorriente(m) || esGastoExtraordinario(m)).toBe(false);
      } else {
        expect(esGastoCorriente(m) || esGastoExtraordinario(m)).toBe(true);
      }
    }
  });

  it("lo planeado es corriente pero no cuenta como no planeado", () => {
    expect(esGastoCorriente(deFijo)).toBe(true);
    expect(esGastoNoPlaneado(deFijo)).toBe(false);
    expect(esGastoNoPlaneado(dePendiente)).toBe(false);
    expect(esGastoNoPlaneado(corriente)).toBe(true);
  });

  it("todo gasto no planeado es corriente", () => {
    for (const m of [corriente, extra, deFijo, dePendiente, entrada, traslado]) {
      if (esGastoNoPlaneado(m)) expect(esGastoCorriente(m)).toBe(true);
    }
  });
});

describe("totalesPorClase", () => {
  const movs = [
    movimiento({ clase: "ingreso", monto: 3_000_000 }),
    movimiento({ clase: "gasto", monto: 200_000 }),
    movimiento({ clase: "gasto", monto: 800_000, extraordinario: true }),
    movimiento({ clase: "gasto", monto: 50_000, gasto_id: "g1" }),
    movimiento({ clase: "transferencia", monto: 400_000 }),
  ];

  it("suma ingresos y gastos, y aparta los extraordinarios", () => {
    expect(totalesPorClase(movs)).toEqual({
      ingresos: 3_000_000,
      gastos: 1_050_000,
      extraordinarios: 800_000,
      corrientes: 250_000,
    });
  });

  it("corrientes + extraordinarios es exactamente lo que salió", () => {
    const t = totalesPorClase(movs);
    expect(t.corrientes + t.extraordinarios).toBe(t.gastos);
  });

  it("coincide con sumar los predicados por separado", () => {
    const suma = (f: (m: (typeof movs)[number]) => boolean) =>
      movs.filter(f).reduce((s, m) => s + Number(m.monto), 0);
    const t = totalesPorClase(movs);
    expect(t.corrientes).toBe(suma(esGastoCorriente));
    expect(t.extraordinarios).toBe(suma(esGastoExtraordinario));
  });

  it("las transferencias no son ni ingreso ni gasto", () => {
    expect(totalesPorClase([movimiento({ clase: "transferencia", monto: 1 })])).toEqual({
      ingresos: 0,
      gastos: 0,
      extraordinarios: 0,
      corrientes: 0,
    });
  });

  it("sin movimientos todo es cero", () => {
    expect(totalesPorClase([])).toEqual({ ingresos: 0, gastos: 0, extraordinarios: 0, corrientes: 0 });
  });
});
