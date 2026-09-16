import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useSesion } from "@/contexts/SesionContext";
import { Cargando } from "@/components/ui/Cargando";

/** Deja pasar solo con sesión iniciada; si no, manda a /acceso y recuerda
 *  a dónde iba para volver ahí después de entrar. */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { usuario, cargando } = useSesion();
  const ubicacion = useLocation();

  if (cargando) return <Cargando mensaje="Verificando tu sesión" />;
  if (!usuario) return <Navigate to="/acceso" state={{ desde: ubicacion.pathname }} replace />;

  return <>{children}</>;
}
