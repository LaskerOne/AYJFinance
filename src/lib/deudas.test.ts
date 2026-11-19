import { describe, expect, it } from "vitest";
import {
  conAbonoUnico,
  mesEnQueBajaDe,
  mesesConSuCuota,
  ordenarPorEstrategia,
  simularDeudas,
  tasaMensual,
} from "@/lib/deudas";
import { deuda } from "@/pruebas/fabricas";

/** EA cuyo equivalente mes vencido es exactamente 1 %: 1,01^12 − 1. */
const EA_UNO_POR_CIENTO = (Math.pow(1.01, 12) - 1) * 100;

describe("tasaMensual", () => {
  it("una tasa de cero sigue siendo cero", () => {
    expect(tasaMensual(0)).toBe(0);
  });

  it("convierte EA a mes vencido por equivalencia, no dividiendo por 12", () => {
    expect(tasaMensual(EA_UNO_POR_CIENTO)).toBeCloseTo(0.01, 10);
    // 12 % EA no es 1 % mensual: dividir por 12 sobrestimaría el interés.
    expect(tasaMensual(12)).toBeLessThan(0.01);
  });
});

describe("mesesConSuCuota", () => {
  it("sin saldo no hay meses que pagar", () => {
    expect(mesesConSuCuota({ saldo: 0, cuota: 100, tasa_ea: 20 })).toBe(0);
  });

  it("sin cuota nunca termina", () => {
    expect(mesesConSuCuota({ saldo: 1_000, cuota: 0, tasa_ea: 20 })).toBe(Infinity);
  });

  it("sin interés es una división redondeada hacia arriba", () => {
    expect(mesesConSuCuota({ saldo: 1_000, cuota: 300, tasa_ea: 0 })).toBe(4);
  });

  it("si la cuota no cubre el interés, nunca termina", () => {
    expect(mesesConSuCuota({ saldo: 1_000_000, cuota: 9_000, tasa_ea: EA_UNO_POR_CIENTO })).toBe(Infinity);
  });

  it("con interés usa la fórmula cerrada de amortización", () => {
    // n = −ln(1 − 0,1) / ln(1,01) ≈ 10,59 → 11 cuotas.
    expect(mesesConSuCuota({ saldo: 1_000_000, cuota: 100_000, tasa_ea: EA_UNO_POR_CIENTO })).toBe(11);
  });
});

describe("simularDeudas", () => {
  it("sin deudas lo dice y no simula nada", () => {
    const s = simularDeudas([], 0, "avalancha", true);
    expect(s.sinDeudas).toBe(true);
    expect(s.meses).toBe(0);
  });

  it("sin interés, la serie baja cuota a cuota hasta cero", () => {
    const s = simularDeudas([deuda({ saldo: 1_000, cuota: 300 })], 0, "avalancha", false);
    expect(s.meses).toBe(4);
    expect(s.intereses).toBe(0);
    expect(s.serie).toEqual([1_000, 700, 400, 100, 0]);
    expect(s.estancado).toBe(false);
  });

  it("coincide con la fórmula cerrada cuando hay una sola deuda", () => {
    const d = deuda({ saldo: 1_000_000, cuota: 100_000, tasa_ea: EA_UNO_POR_CIENTO });
    expect(simularDeudas([d], 0, "avalancha", false).meses).toBe(mesesConSuCuota(d));
  });

  it("marca estancada una deuda cuya cuota no cubre el interés", () => {
    const s = simularDeudas([deuda({ saldo: 1_000_000, cuota: 5_000, tasa_ea: EA_UNO_POR_CIENTO })], 0, "bola", false);
    expect(s.estancado).toBe(true);
  });

  it("al reinvertir, la cuota que se libera va a la siguiente deuda", () => {
    const deudas = [
      deuda({ id: "chica", saldo: 100, cuota: 50 }),
      deuda({ id: "grande", saldo: 1_000, cuota: 100 }),
    ];
    const sin = simularDeudas(deudas, 0, "bola", false);
    const con = simularDeudas(deudas, 0, "bola", true);

    expect(sin.meses).toBe(10);
    expect(con.meses).toBe(8);
    // Mes 3: la chica ya está en cero y sus 50 van a la grande.
    expect(con.abonos[2]).toEqual([{ id: "grande", monto: 50 }]);
  });

  it("no modifica las deudas que recibe", () => {
    const deudas = [deuda({ saldo: 1_000, cuota: 300 })];
    simularDeudas(deudas, 500, "avalancha", true);
    expect(deudas[0].saldo).toBe(1_000);
  });

  it("avalancha nunca paga más interés que bola de nieve", () => {
    const deudas = [
      deuda({ id: "cara", saldo: 1_000_000, cuota: 50_000, tasa_ea: 40 }),
      deuda({ id: "chica", saldo: 500_000, cuota: 30_000, tasa_ea: 10 }),
    ];
    const avalancha = simularDeudas(deudas, 200_000, "avalancha", true);
    const bola = simularDeudas(deudas, 200_000, "bola", true);
    expect(avalancha.intereses).toBeLessThanOrEqual(bola.intereses);
  });
});

describe("ordenarPorEstrategia", () => {
  const deudas = [
    deuda({ id: "grande-barata", saldo: 5_000, tasa_ea: 10 }),
    deuda({ id: "chica-cara", saldo: 1_000, tasa_ea: 30 }),
    deuda({ id: "media-media", saldo: 3_000, tasa_ea: 20 }),
    deuda({ id: "pagada", saldo: 0, tasa_ea: 50 }),
  ];

  it("bola de nieve ataca primero el saldo más pequeño", () => {
    expect(ordenarPorEstrategia(deudas, "bola").map((d) => d.id)).toEqual([
      "chica-cara",
      "media-media",
      "grande-barata",
    ]);
  });

  it("avalancha ataca primero la tasa más alta y omite las pagadas", () => {
    expect(ordenarPorEstrategia(deudas, "avalancha").map((d) => d.id)).toEqual([
      "chica-cara",
      "media-media",
      "grande-barata",
    ]);
  });
});

describe("conAbonoUnico", () => {
  const deudas = [
    deuda({ id: "barata", saldo: 1_000, tasa_ea: 10 }),
    deuda({ id: "cara", saldo: 300, tasa_ea: 30 }),
  ];

  it("salda la prioritaria y pasa el sobrante a la siguiente, conservando el orden", () => {
    const tras = conAbonoUnico(deudas, 500, "avalancha");
    expect(tras.map((d) => [d.id, d.saldo])).toEqual([
      ["barata", 800],
      ["cara", 0],
    ]);
    expect(deudas[1].saldo).toBe(300);
  });

  it("un abono negativo no cambia nada", () => {
    expect(conAbonoUnico(deudas, -100, "avalancha")).toEqual(deudas);
  });
});

describe("mesEnQueBajaDe", () => {
  it("sin ingreso no hay respuesta", () => {
    expect(mesEnQueBajaDe([deuda({ saldo: 100, cuota: 10 })], 0, 0.3)).toBeNull();
  });

  it("si ya está por debajo del umbral, es el mes cero", () => {
    expect(mesEnQueBajaDe([deuda({ saldo: 1_000, cuota: 100 })], 1_000, 0.3)).toEqual({ mes: 0, deuda: null });
  });

  it("devuelve el mes en que termina la deuda que cruza el umbral", () => {
    const corta = deuda({ id: "corta", saldo: 1_000, cuota: 250 });
    const larga = deuda({ id: "larga", saldo: 10_000, cuota: 100 });
    // Cuotas 350 sobre 1.000 = 35 %. Al terminar la corta (mes 4) quedan 10 %.
    expect(mesEnQueBajaDe([larga, corta], 1_000, 0.3)).toEqual({ mes: 4, deuda: corta });
  });
});
