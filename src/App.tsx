import { Navigate, Route, Routes } from "react-router-dom";
import { SesionProvider } from "@/contexts/SesionContext";
import { HogarProvider } from "@/contexts/HogarContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Layout } from "@/components/layout/Layout";
import { hayConfiguracion } from "@/services/supabase";

import { Acceso } from "@/Pages/Acceso/Acceso";
import { SinConfigurar } from "@/Pages/Acceso/SinConfigurar";
import { Resumen } from "@/Pages/Resumen/Resumen";
import { Movimientos } from "@/Pages/Movimientos/Movimientos";
import { Presupuesto } from "@/Pages/Presupuesto/Presupuesto";
import { Deudas } from "@/Pages/Deudas/Deudas";
import { Metas } from "@/Pages/Metas/Metas";
import { Historico } from "@/Pages/Historico/Historico";
import { Importar } from "@/Pages/Importar/Importar";
import { Ajustes } from "@/Pages/Ajustes/Ajustes";

export function App() {
  if (!hayConfiguracion) return <SinConfigurar />;

  return (
    <SesionProvider>
      <Routes>
        <Route path="/acceso" element={<Acceso />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <HogarProvider>
                <Layout />
              </HogarProvider>
            </ProtectedRoute>
          }
        >
          <Route index element={<Resumen />} />
          <Route path="movimientos" element={<Movimientos />} />
          <Route path="presupuesto" element={<Presupuesto />} />
          <Route path="deudas" element={<Deudas />} />
          <Route path="metas" element={<Metas />} />
          <Route path="historico" element={<Historico />} />
          <Route path="importar" element={<Importar />} />
          <Route path="ajustes" element={<Ajustes />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </SesionProvider>
  );
}
