import { describe, expect, it } from "vitest";
import { categoriaSugerida, reglaQueAplica } from "@/lib/categorizar";
import { clasificar } from "@/services/csv.service";
import { regla } from "@/pruebas/fabricas";

describe("reglaQueAplica", () => {
  it("sin reglas o con un concepto vacío no aplica ninguna", () => {
    expect(reglaQueAplica("Éxito Poblado", [])).toBeNull();
    expect(reglaQueAplica("", [regla({ patron: "exito" })])).toBeNull();
    expect(reglaQueAplica("   ", [regla({ patron: "exito" })])).toBeNull();
  });

  it("ignora tildes, mayúsculas y puntuación al comparar", () => {
    const r = regla({ patron: "exito poblado", categoria: "Mercado" });
    expect(reglaQueAplica("COMPRA ÉXITO-POBLADO 1234", [r])).toBe(r);
    expect(reglaQueAplica("compra exito*poblado", [r])).toBe(r);
  });

  it("gana el patrón más largo, sin importar el orden de las reglas", () => {
    const corta = regla({ id: "corta", patron: "exito", categoria: "Mercado" });
    const larga = regla({ id: "larga", patron: "exito poblado", categoria: "Ocio" });
    expect(reglaQueAplica("Exito Poblado", [corta, larga])).toBe(larga);
    expect(reglaQueAplica("Exito Poblado", [larga, corta])).toBe(larga);
    expect(reglaQueAplica("Exito Laureles", [larga, corta])).toBe(corta);
  });

  // Con `includes("")` un patrón vacío captura todo: sin esta guarda, una
  // regla corrupta reclasificaría cada movimiento importado.
  it("un patrón vacío o de solo símbolos nunca aplica", () => {
    expect(reglaQueAplica("Exito Poblado", [regla({ patron: "" })])).toBeNull();
    expect(reglaQueAplica("Exito Poblado", [regla({ patron: "  " })])).toBeNull();
    expect(reglaQueAplica("Exito Poblado", [regla({ patron: "***" })])).toBeNull();
  });

  it("no muta el arreglo de reglas que recibe", () => {
    const reglas = [regla({ id: "a", patron: "ab" }), regla({ id: "b", patron: "abcd" })];
    reglaQueAplica("abcd", reglas);
    expect(reglas.map((r) => r.id)).toEqual(["a", "b"]);
  });
});

describe("categoriaSugerida", () => {
  it("una regla aprendida pesa más que la etiqueta de hábito", () => {
    const r = regla({ patron: "rappi", categoria: "Mercado" });
    expect(categoriaSugerida("Rappi pedido", [r])).toEqual({ categoria: "Mercado", razon: "regla" });
  });

  it("sin regla, cae a la etiqueta de hábito", () => {
    expect(categoriaSugerida("Rappi pedido", [])).toMatchObject({ categoria: "Ocio", razon: "etiqueta" });
  });

  it("sin regla ni etiqueta no sugiere nada", () => {
    expect(categoriaSugerida("Zzzz qqqq", [])).toBeNull();
    expect(categoriaSugerida("", [regla()])).toBeNull();
  });
});

// El importador y las sugerencias deben dar la misma respuesta con la misma
// regla: antes cada uno tenía su copia y la puntuación los separaba.
describe("clasificar (importador) y categoriaSugerida coinciden en las reglas", () => {
  const casos = ["EXITO-POBLADO 1234", "Éxito Poblado", "compra exito*poblado", "EXITO  POBLADO"];

  it.each(casos)("«%s» cae en la misma categoría por regla", (concepto) => {
    const r = regla({ patron: "exito poblado", categoria: "Salud" });
    expect(clasificar(concepto, [r])).toEqual({ categoria: "Salud", porRegla: true });
    expect(categoriaSugerida(concepto, [r])).toEqual({ categoria: "Salud", razon: "regla" });
  });

  it("un patrón vacío no captura movimientos al importar", () => {
    expect(clasificar("Exito Poblado", [regla({ patron: "", categoria: "Salud" })]).porRegla).toBe(false);
  });
});
