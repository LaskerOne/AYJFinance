import { describe, expect, it } from "vitest";
import { aNumero, enMeses, fechaCorta, moneda, monedaCorta, nombrePeriodo, porcentaje, primerDiaDelMes } from "@/lib/formato";

describe("aNumero", () => {
  // Es la puerta de todo lo que la persona escribe: un error aquí corrompe datos.
  it.each([
    ["4.800.000", 4_800_000],
    ["4,800,000", 4_800_000],
    ["4800000", 4_800_000],
    ["1.500", 1_500],
    ["1234,56", 1_234.56],
    ["1.234,56", 1_234.56],
    ["1,234.56", 1_234.56],
    ["$ 12.50", 12.5],
    ["-3.000", -3_000],
    ["", 0],
    ["abc", 0],
  ])("%j → %d", (entrada, esperado) => {
    expect(aNumero(entrada)).toBeCloseTo(esperado);
  });

  it("deja pasar números y convierte los no finitos en cero", () => {
    expect(aNumero(42)).toBe(42);
    expect(aNumero(Number.NaN)).toBe(0);
    expect(aNumero(Infinity)).toBe(0);
    expect(aNumero(null)).toBe(0);
    expect(aNumero(undefined)).toBe(0);
  });
});

describe("moneda", () => {
  it("formatea pesos con punto de miles y el signo menos tipográfico", () => {
    expect(moneda(4_800_000, "COP")).toBe("$ 4.800.000");
    expect(moneda(-4_800_000, "COP")).toBe("−$ 4.800.000");
  });

  it("muestra una raya para valores no finitos", () => {
    expect(moneda(Infinity, "COP")).toBe("—");
  });

  it("abrevia cifras grandes", () => {
    expect(monedaCorta(4_800_000, "COP")).toBe("$ 4,8 M");
    expect(monedaCorta(48_000_000, "COP")).toBe("$ 48 M");
    expect(monedaCorta(2_400, "COP")).toBe("$ 2 mil");
    expect(monedaCorta(1_500_000_000, "COP")).toBe("$ 1,5 MM");
  });
});

describe("textos de tiempo y porcentaje", () => {
  it.each([
    [1, "1 mes"],
    [5, "5 meses"],
    [12, "1 año"],
    [14, "1 año y 2 meses"],
    [24, "2 años"],
  ])("enMeses(%d) → %s", (n, texto) => {
    expect(enMeses(n)).toBe(texto);
  });

  it("enMeses de infinito es una raya", () => {
    expect(enMeses(Infinity)).toBe("—");
  });

  it("porcentaje usa coma decimal", () => {
    expect(porcentaje(0.1234)).toBe("12,3 %");
  });

  it("fechas ISO en palabras", () => {
    expect(fechaCorta("2026-09-15")).toBe("15 de septiembre");
    expect(nombrePeriodo("2026-09-01")).toBe("septiembre 2026");
    expect(primerDiaDelMes(new Date(2026, 1, 20))).toBe("2026-02-01");
  });
});
