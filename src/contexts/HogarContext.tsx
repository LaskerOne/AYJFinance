import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { supabase } from "@/services/supabase";
import { obtenerOCrearHogar, integrantes as leerIntegrantes } from "@/services/hogar.service";
import * as coleccion from "@/services/coleccion.service";
import { useSesion } from "./SesionContext";
import type {
  CierreMensual,
  Deuda,
  GastoPresupuesto,
  Hogar,
  Ingreso,
  MapaTablas,
  Meta,
  Movimiento,
  NombreTabla,
  Perfil,
  ReglaCategoria,
} from "@/models/dominio";

type Filas = { [K in NombreTabla]: MapaTablas[K][] };

const TABLAS: NombreTabla[] = [
  "ingresos",
  "gastos_presupuesto",
  "deudas",
  "metas",
  "movimientos",
  "reglas_categoria",
  "cierres_mensuales",
];

const ORDEN: Record<NombreTabla, { columna: string; ascendente?: boolean }> = {
  ingresos: { columna: "orden" },
  gastos_presupuesto: { columna: "orden" },
  deudas: { columna: "orden" },
  metas: { columna: "orden" },
  movimientos: { columna: "fecha", ascendente: false },
  reglas_categoria: { columna: "creada_en" },
  cierres_mensuales: { columna: "periodo" },
};

const VACIO: Filas = {
  ingresos: [],
  gastos_presupuesto: [],
  deudas: [],
  metas: [],
  movimientos: [],
  reglas_categoria: [],
  cierres_mensuales: [],
};

interface ValorHogar {
  hogar: Hogar | null;
  perfiles: Perfil[];
  /** Quien abrió la app. */
  idA: string | null;
  /** La pareja, cuando ya se unió. */
  idB: string | null;
  nombreDe: (usuarioId: string | null) => string;
  /** 'a' | 'b' | 'comun', para pintar la etiqueta del color correcto. */
  ladoDe: (usuarioId: string | null) => "a" | "b" | "comun";

  ingresos: Ingreso[];
  gastos: GastoPresupuesto[];
  deudas: Deuda[];
  metas: Meta[];
  movimientos: Movimiento[];
  reglas: ReglaCategoria[];
  cierres: CierreMensual[];

  cargando: boolean;
  error: string;
  enVivo: boolean;

  crear: <T extends NombreTabla>(tabla: T, fila: Record<string, unknown>) => Promise<void>;
  editar: (tabla: NombreTabla, id: string, cambios: Record<string, unknown>) => Promise<void>;
  borrar: (tabla: NombreTabla, id: string) => Promise<void>;
  crearVarias: (tabla: NombreTabla, filas: Record<string, unknown>[]) => Promise<number>;
  cambiarHogar: (cambios: Partial<Hogar>) => Promise<void>;
  recargar: () => Promise<void>;
}

const HogarContext = createContext<ValorHogar | null>(null);

export function HogarProvider({ children }: { children: ReactNode }) {
  const { usuario, correo } = useSesion();
  const [hogar, setHogar] = useState<Hogar | null>(null);
  const [perfiles, setPerfiles] = useState<Perfil[]>([]);
  const [filas, setFilas] = useState<Filas>(VACIO);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [enVivo, setEnVivo] = useState(false);

  const hogarRef = useRef<string | null>(null);

  const cargarTodo = useCallback(async (hogarId: string) => {
    const resultados = await Promise.all(
      TABLAS.map((t) => coleccion.listar(t, hogarId, ORDEN[t])),
    );
    const nuevas = { ...VACIO } as Filas;
    TABLAS.forEach((t, i) => {
      // El índice coincide porque Promise.all conserva el orden del arreglo.
      nuevas[t] = resultados[i] as never;
    });
    setFilas(nuevas);
  }, []);

  // ---- arranque: resolver hogar y traer datos --------------------------
  useEffect(() => {
    if (!usuario) {
      setHogar(null);
      setFilas(VACIO);
      setPerfiles([]);
      setCargando(false);
      hogarRef.current = null;
      return;
    }

    let vivo = true;
    setCargando(true);
    setError("");

    (async () => {
      try {
        const h = await obtenerOCrearHogar(usuario.id, correo);
        if (!vivo) return;
        setHogar(h);
        hogarRef.current = h.id;
        const [gente] = await Promise.all([leerIntegrantes(h.id), cargarTodo(h.id)]);
        if (!vivo) return;
        setPerfiles(gente);
      } catch (e) {
        if (vivo) setError(e instanceof Error ? e.message : "No se pudo abrir el hogar");
      } finally {
        if (vivo) setCargando(false);
      }
    })();

    return () => {
      vivo = false;
    };
  }, [usuario, correo, cargarTodo]);

  // ---- tiempo real: un solo canal para todo el hogar -------------------
  useEffect(() => {
    if (!hogar) return;

    const aplicar = (tabla: NombreTabla) => (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
      setFilas((previas) => {
        const lista = [...previas[tabla]] as Array<{ id: string }>;
        const nueva = payload.new as { id?: string } | null;
        const vieja = payload.old as { id?: string } | null;

        if (payload.eventType === "INSERT" && nueva?.id) {
          if (lista.some((f) => f.id === nueva.id)) return previas;
          return { ...previas, [tabla]: [...lista, nueva] as never };
        }
        if (payload.eventType === "UPDATE" && nueva?.id) {
          return {
            ...previas,
            [tabla]: lista.map((f) => (f.id === nueva.id ? nueva : f)) as never,
          };
        }
        if (payload.eventType === "DELETE" && vieja?.id) {
          return { ...previas, [tabla]: lista.filter((f) => f.id !== vieja.id) as never };
        }
        return previas;
      });
    };

    const canal = supabase.channel(`hogar:${hogar.id}`);

    for (const tabla of TABLAS) {
      canal.on(
        "postgres_changes",
        { event: "*", schema: "public", table: tabla, filter: `hogar_id=eq.${hogar.id}` },
        aplicar(tabla),
      );
    }

    canal.on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "hogares", filter: `id=eq.${hogar.id}` },
      (payload) => setHogar(payload.new as Hogar),
    );

    canal.on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "miembros", filter: `hogar_id=eq.${hogar.id}` },
      () => {
        void leerIntegrantes(hogar.id).then(setPerfiles);
      },
    );

    canal.subscribe((estado) => setEnVivo(estado === "SUBSCRIBED"));

    return () => {
      setEnVivo(false);
      void supabase.removeChannel(canal);
    };
  }, [hogar?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- acciones --------------------------------------------------------
  const conHogar = useCallback(<R,>(fn: (id: string) => Promise<R>): Promise<R> => {
    const id = hogarRef.current;
    if (!id) return Promise.reject(new Error("Todavía no hay un hogar abierto"));
    return fn(id);
  }, []);

  const crear = useCallback(
    async (tabla: NombreTabla, fila: Record<string, unknown>) => {
      await conHogar(async (hogarId) => {
        const creada = await coleccion.insertar(tabla, { ...fila, hogar_id: hogarId });
        // Pintado inmediato: no se espera al eco del WebSocket.
        setFilas((p) => {
          const lista = p[tabla] as Array<{ id: string }>;
          if (lista.some((f) => f.id === (creada as { id: string }).id)) return p;
          return { ...p, [tabla]: [...lista, creada] as never };
        });
      });
    },
    [conHogar],
  );

  const crearVarias = useCallback(
    async (tabla: NombreTabla, nuevas: Record<string, unknown>[]) => {
      return conHogar(async (hogarId) => {
        const total = await coleccion.insertarVarias(
          tabla,
          nuevas.map((f) => ({ ...f, hogar_id: hogarId })),
        );
        const frescas = await coleccion.listar(tabla, hogarId, ORDEN[tabla]);
        setFilas((p) => ({ ...p, [tabla]: frescas as never }));
        return total;
      });
    },
    [conHogar],
  );

  const editar = useCallback(
    async (tabla: NombreTabla, id: string, cambios: Record<string, unknown>) => {
      setFilas((p) => ({
        ...p,
        [tabla]: (p[tabla] as Array<{ id: string }>).map((f) =>
          f.id === id ? { ...f, ...cambios } : f,
        ) as never,
      }));
      await coleccion.actualizar(tabla, id, cambios);
    },
    [],
  );

  const borrar = useCallback(async (tabla: NombreTabla, id: string) => {
    setFilas((p) => ({
      ...p,
      [tabla]: (p[tabla] as Array<{ id: string }>).filter((f) => f.id !== id) as never,
    }));
    await coleccion.eliminar(tabla, id);
  }, []);

  const cambiarHogar = useCallback(
    async (cambios: Partial<Hogar>) => {
      if (!hogar) return;
      setHogar({ ...hogar, ...cambios });
      const { error: e } = await supabase.from("hogares").update(cambios).eq("id", hogar.id);
      if (e) throw e;
    },
    [hogar],
  );

  const recargar = useCallback(async () => {
    await conHogar(cargarTodo);
  }, [conHogar, cargarTodo]);

  // ---- identidades -----------------------------------------------------
  const idA = usuario?.id ?? null;
  const idB = useMemo(() => perfiles.find((p) => p.id !== idA)?.id ?? null, [perfiles, idA]);

  const nombreDe = useCallback(
    (usuarioId: string | null) => {
      if (usuarioId === null) return "Compartido";
      const perfil = perfiles.find((p) => p.id === usuarioId);
      if (!perfil) return "Alguien";
      return perfil.nombre || perfil.correo.split("@")[0];
    },
    [perfiles],
  );

  const ladoDe = useCallback(
    (usuarioId: string | null): "a" | "b" | "comun" => {
      if (usuarioId === null) return "comun";
      if (usuarioId === idA) return "a";
      return "b";
    },
    [idA],
  );

  const valor = useMemo<ValorHogar>(
    () => ({
      hogar,
      perfiles,
      idA,
      idB,
      nombreDe,
      ladoDe,
      ingresos: filas.ingresos,
      gastos: filas.gastos_presupuesto,
      deudas: filas.deudas,
      metas: filas.metas,
      movimientos: filas.movimientos,
      reglas: filas.reglas_categoria,
      cierres: filas.cierres_mensuales,
      cargando,
      error,
      enVivo,
      crear,
      editar,
      borrar,
      crearVarias,
      cambiarHogar,
      recargar,
    }),
    [
      hogar, perfiles, idA, idB, nombreDe, ladoDe, filas, cargando, error, enVivo,
      crear, editar, borrar, crearVarias, cambiarHogar, recargar,
    ],
  );

  return <HogarContext.Provider value={valor}>{children}</HogarContext.Provider>;
}

export function useHogar(): ValorHogar {
  const valor = useContext(HogarContext);
  if (!valor) throw new Error("useHogar debe usarse dentro de <HogarProvider>");
  return valor;
}
