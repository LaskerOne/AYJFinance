import type { JSX } from "react";

/**
 * Iconos de trazo propios: 20×20, stroke 1.7, sin librerías.
 * Heredan el color del texto (currentColor); la micro-animación al pasar el
 * mouse la pone el CSS de quien los usa.
 */
const TRAZOS: Record<string, JSX.Element> = {
  resumen: (
    <>
      <rect x="3" y="3" width="6.5" height="9" rx="1.5" />
      <rect x="12" y="3" width="5" height="5" rx="1.5" />
      <rect x="12" y="11" width="5" height="6" rx="1.5" />
      <rect x="3" y="15" width="6.5" height="2" rx="1" />
    </>
  ),
  movimientos: (
    <>
      <path d="M4 7h11m0 0-3-3m3 3-3 3" />
      <path d="M16 13H5m0 0 3-3m-3 3 3 3" />
    </>
  ),
  // Una hormiga: tres segmentos y patas. Por los gastos hormiga.
  habitos: (
    <>
      <circle cx="5.2" cy="10" r="2.2" />
      <ellipse cx="10" cy="10" rx="2" ry="1.8" />
      <ellipse cx="14.8" cy="10" rx="3" ry="2.3" />
      <path d="M9 8.4 7.5 5.5M11 8.4l1.5-2.9M9 11.6l-1.5 2.9M11 11.6l1.5 2.9M4.2 8 3 5.6" />
    </>
  ),
  presupuesto: (
    <>
      <path d="M4 5h12" />
      <path d="M4 10h12" />
      <path d="M4 15h12" />
      <circle cx="8" cy="5" r="1.8" fill="currentColor" stroke="none" />
      <circle cx="13" cy="10" r="1.8" fill="currentColor" stroke="none" />
      <circle cx="6.5" cy="15" r="1.8" fill="currentColor" stroke="none" />
    </>
  ),
  deudas: (
    <>
      <rect x="2.5" y="5" width="15" height="10.5" rx="2" />
      <path d="M2.5 8.5h15" />
      <path d="M5.5 12.5h4" />
    </>
  ),
  metas: (
    <>
      <circle cx="10" cy="10" r="7" />
      <circle cx="10" cy="10" r="3.2" />
      <circle cx="10" cy="10" r="0.6" fill="currentColor" stroke="none" />
    </>
  ),
  // Una curva que sube hacia adelante: lo que viene.
  proyeccion: (
    <>
      <path d="M3 16.5h14" />
      <path d="M4 13.5c2.5-.2 3.6-3.8 6-4 1.8-.1 2.4 1.6 4 1.2 1.2-.3 1.9-2.2 2.5-4.2" />
      <path d="M14.6 5.6 16.5 4.5l.7 2.1" />
    </>
  ),
  historico: (
    <>
      <circle cx="10" cy="10" r="7" />
      <path d="M10 6.2V10l2.6 1.8" />
    </>
  ),
  sugerencias: (
    <>
      <path d="M10 2.8 11.6 7l4.2 1.6-4.2 1.6L10 14.4 8.4 10.2 4.2 8.6 8.4 7Z" />
      <path d="M15.6 13.4l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7Z" />
    </>
  ),
  importar: (
    <>
      <path d="M10 3v9m0 0-3.2-3.2M10 12l3.2-3.2" />
      <path d="M3.5 14.5v1A1.5 1.5 0 0 0 5 17h10a1.5 1.5 0 0 0 1.5-1.5v-1" />
    </>
  ),
  ajustes: (
    <>
      <circle cx="10" cy="10" r="2.6" />
      <path d="M10 2.8v2.4M10 14.8v2.4M2.8 10h2.4M14.8 10h2.4M4.9 4.9l1.7 1.7M13.4 13.4l1.7 1.7M15.1 4.9l-1.7 1.7M6.6 13.4l-1.7 1.7" />
    </>
  ),
};

export type NombreIcono = keyof typeof TRAZOS;

export function Icono({ nombre, tamano = 20 }: { nombre: NombreIcono; tamano?: number }) {
  return (
    <svg
      width={tamano}
      height={tamano}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {TRAZOS[nombre]}
    </svg>
  );
}
