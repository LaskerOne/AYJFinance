import { describe, expect, it } from "vitest";
import {
  caeEn,
  esPeriodico,
  esPuntual,
  faltaMesDePago,
  sinMesDePago,
  tocaEnMes,
} from "@/lib/proyeccion";
import { FRECUENCIAS, type Frecuencia } from "@/models/dominio";
import { gasto, ingreso } from "@/pruebas/fabricas";

const MESES = Array.from({ length: 12 }, (_, i) => i + 1);

describe("esPeriodico", () => {
  it("lo mensual y lo quincenal no son periódicos; lo demás sí", () => {
    expect(esPeriodico({ frecuencia: "mensual" })).toBe(false);
    expect(esPeriodico({ frecuencia: "quincenal" })).toBe(false);
    for (const f of ["bimestral", "trimestral", "semestral", "anual"] as Frecuencia[]) {
      expect(esPeriodico({ frecuencia: f })).toBe(true);
    }
  });

  // Si alguien agrega una frecuencia al catálogo sin darle ciclo, aquí se nota.
  it("toda frecuencia del catálogo tiene una respuesta definida", () => {
    for (const f of FRECUENCIAS) {
      expect(typeof esPeriodico({ frecuencia: f })).toBe("boolean");
    }
  });
});

describe("faltaMesDePago y esPuntual", () => {
  it("para cualquier frecuencia y mes de pago, nunca son ciertos a la vez", () => {
    for (const frecuencia of FRECUENCIAS) {
      for (const mes_pago of [null, 3]) {
        const item = { frecuencia, mes_pago };
        expect(faltaMesDePago(item) && esPuntual(item)).toBe(false);
        // Periódico es exactamente "le falta el mes" o "ya es puntual".
        expect(faltaMesDePago(item) || esPuntual(item)).toBe(esPeriodico(item));
      }
    }
  });

  it("lo mensual nunca pide mes de pago", () => {
    expect(faltaMesDePago({ frecuencia: "mensual", mes_pago: null })).toBe(false);
    expect(faltaMesDePago({ frecuencia: "quincenal" })).toBe(false);
  });
});

describe("tocaEnMes", () => {
  it("lo mensual toca todos los meses", () => {
    for (const mes of MESES) expect(tocaEnMes({ frecuencia: "mensual" }, mes)).toBe(true);
  });

  it("lo periódico toca tantas veces al año como indica su ciclo", () => {
    const veces = (frecuencia: Frecuencia) =>
      MESES.filter((mes) => tocaEnMes({ frecuencia, mes_pago: 2 }, mes)).length;
    expect(veces("anual")).toBe(1);
    expect(veces("semestral")).toBe(2);
    expect(veces("trimestral")).toBe(4);
    expect(veces("bimestral")).toBe(6);
  });

  it("lo periódico sin mes de pago no toca ningún mes", () => {
    for (const mes of MESES) expect(tocaEnMes({ frecuencia: "anual", mes_pago: null }, mes)).toBe(false);
  });

  it("coincide con caeEn para todo lo periódico", () => {
    for (const mes of MESES) {
      const item = { frecuencia: "semestral" as Frecuencia, mes_pago: 6 };
      expect(tocaEnMes(item, mes)).toBe(caeEn(item, mes));
    }
  });
});

describe("sinMesDePago", () => {
  it("cuenta ingresos y gastos periódicos sin mes, e ignora lo mensual", () => {
    const ingresos = [ingreso({ frecuencia: "anual", mes_pago: null }), ingreso({ frecuencia: "mensual" })];
    const gastos = [
      gasto({ frecuencia: "semestral", mes_pago: null }),
      gasto({ frecuencia: "anual", mes_pago: 3 }),
      gasto({ frecuencia: "quincenal" }),
    ];
    expect(sinMesDePago(ingresos, gastos)).toBe(2);
  });
});
