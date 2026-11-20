import { describe, expect, it } from "vitest";
import { calcularFinanzas } from "@/lib/calculos";
import { analizar, evaluarDecision, intercalar, type EntradaOraculo, type Mensaje } from "@/lib/oraculo";
import { decision, deuda, gasto, hogar, ingreso, meta, movimiento } from "@/pruebas/fabricas";

/**
 * El oráculo depende de la fecha en casi todas sus reglas, así que cada
 * prueba fija `hoy`. Por defecto: 20 de septiembre de 2026.
 */
const HOY = new Date(2026, 8, 20);

type Datos = Partial<Omit<EntradaOraculo, "f">>;

/** Arma la entrada con unas finanzas coherentes con los datos que recibe. */
function entrada(d: Datos = {}): EntradaOraculo {
  const base = {
    movimientos: [],
    gastos: [],
    ingresos: [ingreso({ usuario_id: "a", monto: 5_000_000 })],
    deudas: [],
    metas: [],
    activos: [],
    decisiones: [],
    pendientes: [],
    hogar: hogar(),
    idA: "a",
    idB: null,
    nombreDe: (id: string | null) => (id === "a" ? "Ana" : id === "b" ? "Beto" : "Alguien"),
    etiqueta: (c: string) => c,
    $: (n: number) => `$${Math.round(n)}`,
    meses: (n: number) => `${n} meses`,
    pct: (n: number) => `${Math.round(n * 100)} %`,
    hoy: HOY,
    ...d,
  };
  const f = calcularFinanzas({
    ingresos: base.ingresos,
    gastos: base.gastos,
    deudas: base.deudas,
    metas: base.metas,
    idA: base.idA,
    idB: base.idB,
    reparto: base.hogar?.reparto ?? "proporcional",
  });
  return { ...base, f };
}

const ids = (ms: Mensaje[]) => ms.map((m) => m.id);
const buscar = (ms: Mensaje[], id: string) => ms.find((m) => m.id === id);

describe("analizar: invariantes", () => {
  // Un hogar con algo de todo, para que se disparen muchas reglas a la vez.
  const lleno = entrada({
    idB: "b",
    hogar: hogar({ reparto: "mitad", tasa_usura: 30, corte_ingresos: 29 }),
    gastos: [
      gasto({ id: "arriendo", categoria: "Vivienda", monto: 1_500_000, tipo: "fijo", dia_pago: 5 }),
      gasto({ id: "seguro", categoria: "Otros", monto: 600_000, frecuencia: "semestral" }),
    ],
    deudas: [
      deuda({ id: "tarjeta", nombre: "Tarjeta", saldo: 2_000_000, cuota: 200_000, tasa_ea: 35 }),
      deuda({ id: "moto", nombre: "Moto", saldo: 150, cuota: 100 }),
    ],
    metas: [meta({ id: "viaje", nombre: "Viaje", objetivo: 1_000_000 })],
    movimientos: [
      movimiento({ id: "m1", fecha: "2026-08-10", compartido: true, pagado_por: "a", monto: 300_000 }),
      movimiento({ id: "m2", fecha: "2026-09-02", categoria: "Ocio", monto: 400_000 }),
    ],
  });
  const r = analizar(lleno);

  it("los consejos salen ordenados por prioridad", () => {
    const p = r.consejos.map((c) => c.prioridad);
    expect(p).toEqual([...p].sort((a, b) => a - b));
  });

  it("los tips salen del más relevante al menos relevante", () => {
    const p = r.tips.map((t) => t.prioridad);
    expect(p).toEqual([...p].sort((a, b) => a - b));
  });

  it("no repite ids: la vista los usa como key", () => {
    const todos = ids([...r.consejos, ...r.tips]);
    expect(new Set(todos).size).toBe(todos.length);
  });

  it("cada mensaje está bien clasificado", () => {
    expect(r.consejos.every((c) => c.tipo === "consejo")).toBe(true);
    expect(r.tips.every((t) => t.tipo === "tip" && t.fuente === "educación")).toBe(true);
  });

  it("no modifica los datos que recibe", () => {
    const copia = structuredClone({ ...lleno, nombreDe: undefined, etiqueta: undefined, $: undefined, meses: undefined, pct: undefined });
    analizar(lleno);
    expect({ ...lleno, nombreDe: undefined, etiqueta: undefined, $: undefined, meses: undefined, pct: undefined }).toEqual(copia);
  });

  it("resume lo que leyó", () => {
    expect(r.lectura).toEqual({ movimientos: 2, meses: 2, deudas: 2, metas: 1, activos: 0 });
  });
});

describe("analizar: movimientos", () => {
  it("sin movimientos pide empezar a registrar", () => {
    expect(ids(analizar(entrada()).consejos)).toContain("sin-movimientos");
  });

  it("avisa si llevan cinco días o más sin registrar", () => {
    const atrasado = analizar(entrada({ movimientos: [movimiento({ fecha: "2026-09-10" })] }));
    const al_dia = analizar(entrada({ movimientos: [movimiento({ fecha: "2026-09-17" })] }));
    expect(buscar(atrasado.consejos, "registro-atrasado")?.titulo).toContain("10 días");
    expect(ids(al_dia.consejos)).not.toContain("registro-atrasado");
  });

  it("proyecta el cierre del mes y avisa si se pasa del presupuesto", () => {
    // 900 mil en 20 días → 1,35 M a fin de mes contra 1 M planeado.
    const r = analizar(
      entrada({
        gastos: [gasto({ monto: 1_000_000 })],
        movimientos: [movimiento({ fecha: "2026-09-19", monto: 900_000 })],
      }),
    );
    expect(buscar(r.consejos, "ritmo-alto")?.titulo).toContain("$1350000");
  });

  it("las compras extraordinarias no cuentan para el ritmo", () => {
    const r = analizar(
      entrada({
        gastos: [gasto({ monto: 1_000_000 })],
        movimientos: [movimiento({ fecha: "2026-09-19", monto: 900_000, extraordinario: true })],
      }),
    );
    expect(ids(r.consejos)).not.toContain("ritmo-alto");
  });
});

describe("analizar: pareja", () => {
  it("el bote sin saldar del mes pasado dice quién le debe a quién", () => {
    const r = analizar(
      entrada({
        idB: "b",
        hogar: hogar({ reparto: "mitad" }),
        movimientos: [movimiento({ fecha: "2026-08-10", compartido: true, pagado_por: "a", monto: 300_000 })],
      }),
    );
    const bote = buscar(r.consejos, "bote-pendiente");
    expect(bote?.cuerpo).toMatch(/^Beto le debe \$150000 a Ana/);
    expect(bote?.accion).toMatchObject({ tipo: "saldar-bote", mes: "2026-08", deudor: "b", monto: 150_000 });
  });

  it("sin pareja unida no hay bote que liquidar", () => {
    const r = analizar(
      entrada({ movimientos: [movimiento({ fecha: "2026-08-10", compartido: true, pagado_por: "a", monto: 300_000 })] }),
    );
    expect(ids(r.consejos)).not.toContain("bote-pendiente");
  });

  it("recuerda la reunión del mes desde el día 5 y la olvida cuando ya la hicieron", () => {
    expect(ids(analizar(entrada()).consejos)).toContain("sin-reunion");
    expect(ids(analizar(entrada({ hoy: new Date(2026, 8, 3) })).consejos)).not.toContain("sin-reunion");
    expect(ids(analizar(entrada({ decisiones: [decision({ periodo: "2026-09-01" })] })).consejos)).not.toContain(
      "sin-reunion",
    );
  });

  it("cuenta las decisiones del mes pasado sin cumplir", () => {
    const r = analizar(entrada({ decisiones: [decision({ periodo: "2026-08-01", texto: "Cocinar más" })] }));
    expect(buscar(r.consejos, "decisiones-pendientes")?.cuerpo).toContain("Cocinar más");
  });
});

describe("analizar: deudas", () => {
  it("una tasa por encima de la usura es lo más urgente", () => {
    const r = analizar(
      entrada({
        hogar: hogar({ tasa_usura: 30 }),
        deudas: [
          deuda({ id: "cara", nombre: "Cara", saldo: 1_000_000, cuota: 100_000, tasa_ea: 35 }),
          deuda({ id: "legal", nombre: "Legal", saldo: 1_000_000, cuota: 100_000, tasa_ea: 25 }),
        ],
      }),
    );
    expect(buscar(r.consejos, "usura-cara")).toMatchObject({ tono: "crit", prioridad: 5 });
    expect(ids(r.consejos)).not.toContain("usura-legal");
  });

  it("sin tasa de usura guardada no juzga ninguna deuda", () => {
    const r = analizar(entrada({ deudas: [deuda({ id: "x", saldo: 1_000, cuota: 100, tasa_ea: 90 })] }));
    expect(ids(r.consejos).some((id) => id.startsWith("usura-"))).toBe(false);
  });

  it("avisa de la deuda a la que le quedan una o dos cuotas", () => {
    const r = analizar(entrada({ deudas: [deuda({ id: "moto", nombre: "Moto", saldo: 150, cuota: 100 })] }));
    expect(buscar(r.consejos, "termina-moto")?.titulo).toContain("quedan 2 cuotas");
  });
});

describe("analizar: metas", () => {
  it("la meta que se completa con el próximo aporte propone mover ese aporte a otra", () => {
    const r = analizar(
      entrada({
        metas: [
          meta({ id: "casi", nombre: "Casi", objetivo: 1_000, acumulado: 900, aporte: 200 }),
          meta({ id: "otra", nombre: "Otra", objetivo: 5_000, acumulado: 0, aporte: 100 }),
          meta({ id: "lista", nombre: "Lista", objetivo: 100, acumulado: 100 }),
        ],
      }),
    );
    expect(buscar(r.consejos, "meta-cumple-casi")?.accion).toEqual({
      tipo: "mover-aporte",
      desdeId: "casi",
      aporte: 200,
      opciones: [{ id: "otra", nombre: "Otra" }],
    });
  });

  it("una meta sin aporte recibe una sugerencia de al menos 10 mil", () => {
    const r = analizar(entrada({ metas: [meta({ id: "m", objetivo: 12_000 })] }));
    const accion = buscar(r.consejos, "meta-sin-aporte-m")?.accion;
    expect(accion).toMatchObject({ tipo: "aporte-meta", metaId: "m" });
    expect(accion?.tipo === "aporte-meta" && accion.sugerido).toBeGreaterThanOrEqual(10_000);
  });

  it("el fondo de emergencia sin aporte no se marca como meta abandonada", () => {
    const r = analizar(entrada({ metas: [meta({ id: "f", objetivo: 1_000_000, es_emergencia: true })] }));
    expect(ids(r.consejos)).not.toContain("meta-sin-aporte-f");
  });
});

describe("analizar: un mes adelantados", () => {
  const conCorte = (hoy: Date) =>
    analizar(entrada({ hoy, hogar: hogar({ corte_ingresos: 29 }), gastos: [gasto({ monto: 2_000_000 })] }));

  it("propone una meta de media canasta mensual", () => {
    expect(buscar(conCorte(HOY).consejos, "mes-adelantado")?.accion).toMatchObject({
      tipo: "crear-meta",
      objetivo: 1_000_000,
    });
  });

  it.each([
    [new Date(2026, 8, 20), "octubre se paga con lo ganado en septiembre"],
    [new Date(2026, 11, 20), "enero se paga con lo ganado en diciembre"],
  ])("el ejemplo usa el mes en curso y el siguiente (%s)", (hoy, frase) => {
    expect(buscar(conCorte(hoy).consejos, "mes-adelantado")?.cuerpo).toContain(frase);
  });

  it("no aparece si ya crearon la meta", () => {
    const r = analizar(
      entrada({
        hogar: hogar({ corte_ingresos: 29 }),
        gastos: [gasto({ monto: 2_000_000 })],
        metas: [meta({ nombre: "Un mes adelantados", aporte: 100_000, objetivo: 1_000_000 })],
      }),
    );
    expect(ids(r.consejos)).not.toContain("mes-adelantado");
  });
});

describe("analizar: tips", () => {
  const conPrima = { ingresos: [ingreso({ usuario_id: "a", monto: 5_000_000, con_prestaciones: true })] };

  it("en noviembre, con prima en camino, el tip de la prima va primero", () => {
    const r = analizar(entrada({ ...conPrima, hoy: new Date(2026, 10, 10) }));
    expect(r.tips[0].id).toBe("tip-prima");
  });

  it("fuera de mayo y noviembre el tip de la prima no aparece", () => {
    expect(ids(analizar(entrada(conPrima)).tips)).not.toContain("tip-prima");
  });

  it("los tips de deudas solo salen si hay deudas", () => {
    expect(ids(analizar(entrada()).tips)).not.toContain("tip-avalancha-bola");
  });
});

describe("evaluarDecision", () => {
  const ctx = {
    ids: new Set<string>(),
    movimientos: [] as ReturnType<typeof movimiento>[],
    presupuestoMes: 0,
    etiqueta: (c: string) => c,
    $: (n: number) => `$${n}`,
    hoy: HOY,
  };

  it("las decisiones escritas a mano no se evalúan", () => {
    expect(evaluarDecision(decision({ origen: null }), ctx)).toBeNull();
  });

  it("mientras corre el mes siguiente, sigue en curso si el problema persiste", () => {
    const d = decision({ periodo: "2026-09-01", origen: "hormiga" });
    expect(evaluarDecision(d, { ...ctx, ids: new Set(["hormiga"]) })?.estado).toBe("en-curso");
    expect(evaluarDecision(d, ctx)?.estado).toBe("lograda");
  });

  it("una categoría que bajó al mes siguiente se da por lograda", () => {
    const d = decision({ periodo: "2026-07-01", origen: "categoria-sube-Ocio" });
    const baja = [
      movimiento({ fecha: "2026-07-10", categoria: "Ocio", monto: 300_000 }),
      movimiento({ fecha: "2026-08-10", categoria: "Ocio", monto: 100_000 }),
    ];
    const sube = [
      movimiento({ fecha: "2026-07-10", categoria: "Ocio", monto: 100_000 }),
      movimiento({ fecha: "2026-08-10", categoria: "Ocio", monto: 300_000 }),
    ];
    expect(evaluarDecision(d, { ...ctx, movimientos: baja })?.estado).toBe("lograda");
    expect(evaluarDecision(d, { ...ctx, movimientos: sube })?.estado).toBe("sigue");
  });

  it("los gastos hormiga solo cuentan las compras de 50 mil o menos", () => {
    const d = decision({ periodo: "2026-07-01", origen: "hormiga" });
    const movimientos = [
      movimiento({ fecha: "2026-07-10", monto: 40_000 }),
      movimiento({ fecha: "2026-08-10", monto: 20_000 }),
      movimiento({ fecha: "2026-08-11", monto: 900_000 }),
    ];
    expect(evaluarDecision(d, { ...ctx, movimientos })?.estado).toBe("lograda");
  });
});

describe("intercalar", () => {
  const m = (id: string) => ({ id }) as Mensaje;

  it("pone un tip cada dos consejos", () => {
    const salida = intercalar(["c1", "c2", "c3", "c4", "c5"].map(m), ["t1", "t2"].map(m));
    expect(ids(salida)).toEqual(["c1", "c2", "t1", "c3", "c4", "t2", "c5"]);
  });

  it("cuando se acaban los consejos siguen los tips", () => {
    expect(ids(intercalar([m("c1")], ["t1", "t2", "t3"].map(m)))).toEqual(["c1", "t1", "t2", "t3"]);
  });

  it("no pierde ni duplica mensajes", () => {
    const c = ["a", "b", "c"].map(m);
    const t = ["x", "y", "z", "w"].map(m);
    expect(intercalar(c, t)).toHaveLength(7);
  });
});
