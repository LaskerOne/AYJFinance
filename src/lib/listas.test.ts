import { describe, expect, it } from "vitest";
import {
  aplicarCambioRemoto,
  fusionarPorId,
  insertarSiFalta,
  quitarPorId,
  reemplazarPorId,
} from "@/lib/listas";

type Fila = { id: string; monto: number };
const a: Fila = { id: "a", monto: 1 };
const b: Fila = { id: "b", monto: 2 };

describe("insertarSiFalta", () => {
  it("agrega al final una fila nueva", () => {
    expect(insertarSiFalta([a], b)).toEqual([a, b]);
  });

  // El eco del WebSocket repite lo que uno mismo acaba de insertar.
  it("insertar la misma fila dos veces no la duplica", () => {
    const una = insertarSiFalta([], a);
    const dos = insertarSiFalta(una, { ...a });
    expect(dos).toHaveLength(1);
    expect(dos).toBe(una);
  });
});

describe("reemplazarPorId y fusionarPorId", () => {
  it("cambian solo la fila con ese id", () => {
    expect(reemplazarPorId([a, b], { id: "b", monto: 9 })).toEqual([a, { id: "b", monto: 9 }]);
    expect(fusionarPorId([a, b], "a", { monto: 7 })).toEqual([{ id: "a", monto: 7 }, b]);
  });

  it("si el id no está, devuelven la misma lista sin agregar nada", () => {
    const lista = [a];
    expect(reemplazarPorId(lista, b)).toBe(lista);
    expect(fusionarPorId(lista, "zz", { monto: 3 })).toBe(lista);
  });
});

describe("quitarPorId", () => {
  it("quita la fila y deja las demás en su orden", () => {
    expect(quitarPorId([a, b], "a")).toEqual([b]);
  });

  it("quitar algo que no está devuelve la misma lista", () => {
    const lista = [a];
    expect(quitarPorId(lista, "zz")).toBe(lista);
  });
});

describe("las funciones no mutan la lista que reciben", () => {
  it.each([
    ["insertarSiFalta", (l: Fila[]) => insertarSiFalta(l, b)],
    ["reemplazarPorId", (l: Fila[]) => reemplazarPorId(l, { id: "a", monto: 5 })],
    ["fusionarPorId", (l: Fila[]) => fusionarPorId(l, "a", { monto: 5 })],
    ["quitarPorId", (l: Fila[]) => quitarPorId(l, "a")],
  ])("%s", (_nombre, cambio) => {
    const lista = [{ ...a }];
    const copia = structuredClone(lista);
    cambio(lista);
    expect(lista).toEqual(copia);
  });
});

describe("aplicarCambioRemoto", () => {
  it("INSERT, UPDATE y DELETE se aplican por id", () => {
    let lista: Fila[] = [];
    lista = aplicarCambioRemoto(lista, { tipo: "INSERT", nueva: a, vieja: null });
    lista = aplicarCambioRemoto(lista, { tipo: "INSERT", nueva: b, vieja: null });
    const actualizada: Fila = { id: "a", monto: 5 };
    lista = aplicarCambioRemoto(lista, { tipo: "UPDATE", nueva: actualizada, vieja: a });
    lista = aplicarCambioRemoto(lista, { tipo: "DELETE", nueva: null, vieja: { id: "b" } });
    expect(lista).toEqual([{ id: "a", monto: 5 }]);
  });

  it("el eco de una inserción propia no cambia nada", () => {
    const lista = insertarSiFalta([], a);
    expect(aplicarCambioRemoto(lista, { tipo: "INSERT", nueva: { ...a }, vieja: null })).toBe(lista);
  });

  it("un evento sin id se ignora", () => {
    const lista = [a];
    expect(aplicarCambioRemoto(lista, { tipo: "INSERT", nueva: {}, vieja: null })).toBe(lista);
    expect(aplicarCambioRemoto(lista, { tipo: "DELETE", nueva: null, vieja: null })).toBe(lista);
  });

  // Crear, recibir el eco y borrar, en cualquier orden de llegada del eco,
  // termina sin la fila: no queda un fantasma en pantalla.
  it("crear, borrar y recibir tarde el eco del INSERT no resucita la fila si llega su DELETE", () => {
    let lista: Fila[] = insertarSiFalta([], a);
    lista = quitarPorId(lista, "a");
    lista = aplicarCambioRemoto(lista, { tipo: "INSERT", nueva: a, vieja: null });
    lista = aplicarCambioRemoto(lista, { tipo: "DELETE", nueva: null, vieja: { id: "a" } });
    expect(lista).toEqual([]);
  });
});
