import type { ReactNode } from "react";

/** Etiqueta de a quién pertenece una fila. El color viene del lado
 *  (yo / la pareja / los dos), nunca de un hex escrito a mano; «neutro» es
 *  para lo que no es de nadie en particular. */
export function Etiqueta({ lado, texto }: { lado: "a" | "b" | "comun" | "neutro"; texto: string }) {
  return <span className={`tag ${lado}`}>{texto}</span>;
}

export function Estado({
  tono,
  children,
}: {
  tono: "ok" | "warn" | "crit" | "neutro";
  children: ReactNode;
}) {
  const icono = tono === "ok" ? "✓" : tono === "warn" ? "!" : tono === "crit" ? "⚠" : "";
  return (
    <span className={`chip ${tono}`}>
      {icono && <span aria-hidden="true">{icono}</span>}
      {children}
    </span>
  );
}
