import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase, hayConfiguracion } from "@/services/supabase";

interface ValorSesion {
  sesion: Session | null;
  usuario: User | null;
  correo: string;
  cargando: boolean;
  /** Envía el enlace mágico al correo indicado. */
  enviarEnlace: (correo: string) => Promise<void>;
  salir: () => Promise<void>;
}

const SesionContext = createContext<ValorSesion | null>(null);

export function SesionProvider({ children }: { children: ReactNode }) {
  const [sesion, setSesion] = useState<Session | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (!hayConfiguracion) {
      setCargando(false);
      return;
    }

    let vivo = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!vivo) return;
      setSesion(data.session);
      setCargando(false);
    });

    const { data: suscripcion } = supabase.auth.onAuthStateChange((_evento, nueva) => {
      setSesion(nueva);
      setCargando(false);
    });

    return () => {
      vivo = false;
      suscripcion.subscription.unsubscribe();
    };
  }, []);

  const valor = useMemo<ValorSesion>(
    () => ({
      sesion,
      usuario: sesion?.user ?? null,
      correo: sesion?.user?.email ?? "",
      cargando,
      enviarEnlace: async (correo: string) => {
        const { error } = await supabase.auth.signInWithOtp({
          email: correo.trim().toLowerCase(),
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
      },
      salir: async () => {
        await supabase.auth.signOut();
        setSesion(null);
      },
    }),
    [sesion, cargando],
  );

  return <SesionContext.Provider value={valor}>{children}</SesionContext.Provider>;
}

export function useSesion(): ValorSesion {
  const valor = useContext(SesionContext);
  if (!valor) throw new Error("useSesion debe usarse dentro de <SesionProvider>");
  return valor;
}
